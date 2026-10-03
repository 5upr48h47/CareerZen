import { run } from './db.js';

export async function audit(req, action, resourceType = null, resourceId = null, metadata = {}) {
  try {
    await run(
      `INSERT INTO audit_logs (actor_id, action, resource_type, resource_id, metadata, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user?.id || null,
        action,
        resourceType,
        resourceId == null ? null : String(resourceId),
        JSON.stringify(metadata),
        req.ip || null,
        req.get('user-agent') || null
      ]
    );
  } catch (err) {
    console.error('Audit log failed:', err.message);
  }
}

export function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  next();
}
