import crypto from 'crypto';
import { get, run } from './db.js';
import { generateToken } from './auth.js';

const pending = new Map();
let discoveryCache = null;
let discoveryExpires = 0;
let jwksCache = new Map();
let jwksExpires = 0;

const b64url = (buf) => Buffer.from(buf).toString('base64url');
const decode = (value) => JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));

function config() {
  return {
    issuer: process.env.OIDC_ISSUER?.replace(/\/$/, ''),
    clientId: process.env.OIDC_CLIENT_ID,
    clientSecret: process.env.OIDC_CLIENT_SECRET,
    redirectUri: process.env.OIDC_REDIRECT_URI,
    adminGroup: process.env.OIDC_ADMIN_GROUP,
    adminEmails: new Set((process.env.OIDC_ADMIN_EMAILS || '').split(',').map(v => v.trim().toLowerCase()).filter(Boolean))
  };
}

export function oidcConfigured() {
  const c = config();
  return Boolean(c.issuer && c.clientId && c.clientSecret && c.redirectUri);
}

async function discovery() {
  const c = config();
  if (!oidcConfigured()) throw new Error('SSO is not configured');
  if (discoveryCache && Date.now() < discoveryExpires) return discoveryCache;
  const r = await fetch(`${c.issuer}/.well-known/openid-configuration`);
  if (!r.ok) throw new Error(`OIDC discovery failed (${r.status})`);
  discoveryCache = await r.json();
  discoveryExpires = Date.now() + 60 * 60 * 1000;
  return discoveryCache;
}

async function jwks(jwksUri) {
  if (Date.now() < jwksExpires && jwksCache.size) return jwksCache;
  const r = await fetch(jwksUri);
  if (!r.ok) throw new Error(`OIDC JWKS failed (${r.status})`);
  const data = await r.json();
  jwksCache = new Map((data.keys || []).map(k => [k.kid, k]));
  jwksExpires = Date.now() + 15 * 60 * 1000;
  return jwksCache;
}

function verifyJwtSignature(token, jwk) {
  const [h, p, s] = token.split('.');
  if (!h || !p || !s) throw new Error('Malformed ID token');
  const header = decode(h);
  if (header.alg !== 'RS256') throw new Error('Unsupported ID token algorithm');
  const key = crypto.createPublicKey({ key: jwk, format: 'jwk' });
  const ok = crypto.verify('RSA-SHA256', Buffer.from(`${h}.${p}`), key, Buffer.from(s, 'base64url'));
  if (!ok) throw new Error('Invalid ID token signature');
  return { header, claims: decode(p) };
}

async function verifyIdToken(token, nonce, meta) {
  const c = config();
  const d = await discovery();
  const parts = token.split('.');
  const header = decode(parts[0]);
  let keys = await jwks(d.jwks_uri);
  let jwk = keys.get(header.kid);
  if (!jwk) { jwksExpires = 0; keys = await jwks(d.jwks_uri); jwk = keys.get(header.kid); }
  if (!jwk) throw new Error('Signing key not found');
  const { claims } = verifyJwtSignature(token, jwk);
  if (claims.iss !== c.issuer) throw new Error('Invalid token issuer');
  if (!Array.isArray(claims.aud) ? claims.aud !== c.clientId : !claims.aud.includes(c.clientId)) throw new Error('Invalid token audience');
  if (claims.exp && claims.exp < Math.floor(Date.now() / 1000)) throw new Error('ID token expired');
  if (nonce && claims.nonce !== nonce) throw new Error('Invalid token nonce');
  if (meta.accessToken && claims.at_hash) {
    const digest = crypto.createHash('sha256').update(meta.accessToken).digest();
    if (claims.at_hash !== b64url(digest.subarray(0, digest.length / 2))) throw new Error('Invalid at_hash');
  }
  return claims;
}

function hasAdminClaim(claims) {
  const c = config();
  const groups = []
    .concat(claims.groups || [])
    .concat(claims.roles || [])
    .concat(claims['http://schemas.microsoft.com/ws/2008/06/identity/claims/groupsid'] || []);
  const email = String(claims.email || claims.preferred_username || '').toLowerCase();
  return (c.adminGroup && groups.includes(c.adminGroup)) || c.adminEmails.has(email);
}

export async function startAdminSso() {
  const d = await discovery();
  const c = config();
  const state = b64url(crypto.randomBytes(32));
  const nonce = b64url(crypto.randomBytes(32));
  const verifier = b64url(crypto.randomBytes(48));
  const challenge = b64url(crypto.createHash('sha256').update(verifier).digest());
  pending.set(state, { nonce, verifier, createdAt: Date.now() });
  setTimeout(() => pending.delete(state), 10 * 60 * 1000);
  const params = new URLSearchParams({
    client_id: c.clientId,
    response_type: 'code',
    redirect_uri: c.redirectUri,
    scope: 'openid profile email groups',
    state,
    nonce,
    code_challenge: challenge,
    code_challenge_method: 'S256'
  });
  return `${d.authorization_endpoint}?${params.toString()}`;
}

export async function finishAdminSso(code, state) {
  const c = config();
  const pendingAuth = pending.get(state);
  pending.delete(state);
  if (!pendingAuth || Date.now() - pendingAuth.createdAt > 10 * 60 * 1000) throw new Error('Invalid or expired SSO state');
  const d = await discovery();
  const body = new URLSearchParams({
    grant_type: 'authorization_code', code, redirect_uri: c.redirectUri,
    client_id: c.clientId, client_secret: c.clientSecret, code_verifier: pendingAuth.verifier
  });
  const r = await fetch(d.token_endpoint, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
  const tokenData = await r.json();
  if (!r.ok) throw new Error(tokenData.error_description || 'SSO token exchange failed');
  const claims = await verifyIdToken(tokenData.id_token, pendingAuth.nonce, tokenData);
  const email = String(claims.email || claims.preferred_username || '').trim().toLowerCase();
  if (!email || !hasAdminClaim(claims)) throw new Error('Your SSO account is not authorized for CareerZen administration');

  let user = await get('SELECT id, username, email, role FROM users WHERE sso_subject = ? OR email = ?', [claims.sub, email]);
  if (!user) {
    const base = (claims.preferred_username || email.split('@')[0] || `admin${Date.now()}`).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 24) || `admin${Date.now()}`;
    const username = `${base}_${Date.now().toString().slice(-5)}`;
    const result = await run(`INSERT INTO users (username, email, role, auth_provider, email_verified, is_active, sso_subject) VALUES (?, ?, 'admin', 'sso', 1, 1, ?)`, [username, email, claims.sub]);
    await run(`INSERT INTO profiles (user_id, full_name, headline, location, education, experience, projects, social_links, updated_at) VALUES (?, ?, ?, ?, '[]', '[]', '[]', '{}', CURRENT_TIMESTAMP) ON CONFLICT(user_id) DO NOTHING`, [result.id, claims.name || email, 'CareerZen Administrator', 'SSO']);
    user = { id: result.id, username, email, role: 'admin' };
  } else {
    if (user.role !== 'admin') throw new Error('This account exists but is not mapped to the CareerZen admin role');
    await run(`UPDATE users SET auth_provider='sso', email_verified=1, sso_subject=?, last_login_at=CURRENT_TIMESTAMP WHERE id=?`, [claims.sub, user.id]);
  }
  if (user.role !== 'admin') throw new Error('Admin role required');
  await run(`UPDATE users SET last_login_at=CURRENT_TIMESTAMP WHERE id=?`, [user.id]);
  return { token: generateToken(user), user: { id: user.id, username: user.username, email: user.email, role: user.role, auth_provider: 'sso' } };
}
