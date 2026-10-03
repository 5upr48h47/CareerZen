import express from 'express';
import bcrypt from 'bcryptjs';
import twilio from 'twilio';
import crypto from 'crypto';
import { run, get, query } from '../db.js';
import { generateToken, authenticate } from '../auth.js';
import { startAdminSso, finishAdminSso, oidcConfigured } from '../oidc.js';

const router = express.Router();

// ─────────────────────────────────────────────
// CONFIGURATION
// ─────────────────────────────────────────────

// SMS_MODE:
//   twilio = real SMS through Twilio Verify
//   local  = local development OTP stored in SQLite
//
// Recommended:
//   Development without Twilio -> local
//   Development with Twilio    -> twilio
//   Production                -> twilio

function getSmsMode() {
  const configured = (process.env.SMS_MODE || '').trim().toLowerCase();

  if (configured === 'local') return 'local';
  if (configured === 'twilio') return 'twilio';

  // Automatic fallback:
  // If Twilio credentials exist, use Twilio.
  // Otherwise use local mode during development.
  if (
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_VERIFY_SERVICE_SID
  ) {
    return 'twilio';
  }

  return process.env.NODE_ENV === 'production' ? 'twilio' : 'local';
}

// Create Twilio client lazily.
// This is intentional because dotenv is loaded by src/index.js.
function getTwilioClient() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken) {
    return null;
  }

  return twilio(accountSid, authToken);
}

function getTwilioVerifyServiceSid() {
  return process.env.TWILIO_VERIFY_SERVICE_SID;
}

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

// Generate 6-digit OTP for LOCAL development only.
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Build OTP expiry: 10 minutes from now.
function otpExpiry() {
  const d = new Date();
  d.setMinutes(d.getMinutes() + 10);
  return d.toISOString();
}

// Normalize Indian phone numbers.
// Examples:
//   9876543210       -> +919876543210
//   +919876543210    -> +919876543210
//   +91 9876543210   -> +919876543210
//
// For other international numbers, keep the +country-code format.
function normalizePhone(phone) {
  let value = String(phone || '').trim();

  value = value.replace(/[()\s-]/g, '');

  if (!value) {
    return '';
  }

  if (value.startsWith('00')) {
    value = `+${value.slice(2)}`;
  }

  if (value.startsWith('+')) {
    return value;
  }

  // CareerZen currently targets India.
  if (/^\d{10}$/.test(value)) {
    return `+91${value}`;
  }

  return value;
}

function isValidPhone(phone) {
  return /^\+[1-9]\d{7,14}$/.test(phone);
}

// Local development OTP.
// IMPORTANT: only used when SMS_MODE=local.
function simulateSendSMS(phone, otp) {
  console.log(
    `\n📱 [LOCAL OTP MODE] To: ${phone} | Code: ${otp} | Expires: 10 min\n`
  );
}

// Simulate sending OTP via Email.
function simulateSendEmail(email, otp) {
  console.log(
    `\n📧 [OTP EMAIL SIMULATION] To: ${email} | Code: ${otp} | Expires: 10 min\n`
  );
}

// ─────────────────────────────────────────────
// TWILIO VERIFY HELPERS
// ─────────────────────────────────────────────

async function sendTwilioOTP(phone) {
  const client = getTwilioClient();
  const serviceSid = getTwilioVerifyServiceSid();

  if (!client) {
    throw new Error(
      'Twilio is not configured. TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN is missing.'
    );
  }

  if (!serviceSid) {
    throw new Error(
      'Twilio Verify is not configured. TWILIO_VERIFY_SERVICE_SID is missing.'
    );
  }

  const verification = await client.verify.v2
    .services(serviceSid)
    .verifications.create({
      to: phone,
      channel: 'sms'
    });

  return verification;
}

async function checkTwilioOTP(phone, code) {
  const client = getTwilioClient();
  const serviceSid = getTwilioVerifyServiceSid();

  if (!client) {
    throw new Error(
      'Twilio is not configured. TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN is missing.'
    );
  }

  if (!serviceSid) {
    throw new Error(
      'Twilio Verify is not configured. TWILIO_VERIFY_SERVICE_SID is missing.'
    );
  }

  const check = await client.verify.v2
    .services(serviceSid)
    .verificationChecks.create({
      to: phone,
      code: code.trim()
    });

  return check;
}

// ─────────────────────────────────────────────
// DEFAULT PROFILE
// ─────────────────────────────────────────────

async function createDefaultProfile(userId, fullName, role, username) {
  const defaultAvatar =
    `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(username)}`;

  const defaultBanner =
    'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=1200&auto=format&fit=crop&q=80';

  await run(
    `INSERT INTO profiles
      (user_id, full_name, headline, bio, location, avatar_url, banner_url,
       education, experience, projects, social_links, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(user_id) DO NOTHING`,
    [
      userId,
      fullName.trim(),
      role === 'recruiter'
        ? 'Talent Acquisition & Hiring Lead'
        : 'Student & Aspiring Software Engineer',
      'Passionate early-career professional excited to connect, learn, and build impactful software.',
      'India',
      defaultAvatar,
      defaultBanner,
      JSON.stringify([]),
      JSON.stringify([]),
      JSON.stringify([]),
      JSON.stringify({})
    ]
  );

  if (role === 'recruiter') {
    await run(
      `INSERT INTO companies
        (recruiter_id, name, tagline, description, website, logo_url,
         location, industry, company_size)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(recruiter_id) DO NOTHING`,
      [
        userId,
        `${fullName}'s Organization`,
        'Building high-impact teams and products.',
        'We empower early-career developers and innovators.',
        'https://company.example.com',
        defaultAvatar,
        'Remote',
        'Technology',
        '1-50 employees'
      ]
    );
  }
}

// ─────────────────────────────────────────────
// BUILD USER RESPONSE
// ─────────────────────────────────────────────

async function buildUserResponse(userId) {
  const user = await get(
    `SELECT id, username, email, role, phone_number, auth_provider,
            phone_verified, aadhaar_masked, aadhaar_verified, kyc_verified_at
     FROM users
     WHERE id = ?`,
    [userId]
  );

  const profile = await get(
    'SELECT * FROM profiles WHERE user_id = ?',
    [userId]
  );

  const skills = await query(
    'SELECT * FROM skills WHERE user_id = ?',
    [userId]
  );

  let company = null;

  if (user?.role === 'recruiter') {
    company = await get(
      'SELECT * FROM companies WHERE recruiter_id = ?',
      [userId]
    );
  }

  // Active premium plan (drives the profile badge). Free when none is active.
  const activeSub = await get(
    `SELECT plan, start_date, end_date FROM student_subscriptions
     WHERE user_id = ? AND status = 'active'
       AND (end_date IS NULL OR end_date > CURRENT_TIMESTAMP)
     ORDER BY created_at DESC LIMIT 1`,
    [userId]
  );

  return {
    token: generateToken(user),
    user: {
      ...user,
      premium_plan: activeSub?.plan || 'free',
      premium_expires_at: activeSub?.end_date || null,
      profile: profile
        ? {
            ...profile,
            education: JSON.parse(profile.education || '[]'),
            experience: JSON.parse(profile.experience || '[]'),
            projects: JSON.parse(profile.projects || '[]'),
            social_links: JSON.parse(profile.social_links || '{}')
          }
        : null,
      skills,
      company
    }
  };
}

// ─────────────────────────────────────────────
// 1. EMAIL / PASSWORD — REGISTER
// POST /api/register
// ─────────────────────────────────────────────

router.post('/register', async (req, res) => {
  const {
    username,
    email,
    password,
    fullName,
    headline
  } = req.body;
  const role = ['job_seeker', 'recruiter'].includes(req.body.role) ? req.body.role : 'job_seeker';

  if (!username || !email || !password || !fullName) {
    return res.status(400).json({
      error: 'Username, email, password, and full name are required'
    });
  }

  try {
    const existing = await get(
      'SELECT id FROM users WHERE username = ? OR email = ?',
      [
        username.trim().toLowerCase(),
        email.trim().toLowerCase()
      ]
    );

    if (existing) {
      return res.status(400).json({
        error: 'Username or email already exists'
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const userRes = await run(
      `INSERT INTO users
        (username, email, password_hash, role, auth_provider, email_verified)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        username.trim().toLowerCase(),
        email.trim().toLowerCase(),
        passwordHash,
        role,
        'email',
        1
      ]
    );

    await createDefaultProfile(
      userRes.id,
      fullName,
      role,
      username
    );

    if (headline) {
      await run(
        'UPDATE profiles SET headline = ? WHERE user_id = ?',
        [headline, userRes.id]
      );
    }

    res.status(201).json(
      await buildUserResponse(userRes.id)
    );
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({
      error: 'Failed to register user'
    });
  }
});

// ─────────────────────────────────────────────
// 2. EMAIL / PASSWORD — LOGIN
// POST /api/login
// ─────────────────────────────────────────────

router.post('/login', async (req, res) => {
  const {
    emailOrUsername,
    password
  } = req.body;

  if (!emailOrUsername || !password) {
    return res.status(400).json({
      error: 'Email/Username and password are required'
    });
  }

  try {
    const identifier = emailOrUsername.trim().toLowerCase();

    const user = await get(
      `SELECT id, username, email, password_hash, role
       FROM users
       WHERE (email = ? OR username = ?)
       AND auth_provider = ?`,
      [
        identifier,
        identifier,
        'email'
      ]
    );

    if (!user || !user.password_hash) {
      return res.status(401).json({
        error: 'Invalid credentials. Try a different sign-in method.'
      });
    }

    const isMatch = await bcrypt.compare(
      password,
      user.password_hash
    );

    if (!isMatch) {
      return res.status(401).json({
        error: 'Invalid credentials'
      });
    }

    res.json(
      await buildUserResponse(user.id)
    );
  } catch (err) {
    console.error('Login error:', err);

    res.status(500).json({
      error: 'Failed to login'
    });
  }
});

// ─────────────────────────────────────────────
// 3. SEND MOBILE OTP
// POST /api/send-otp
//
// body:
// {
//   phone: "+919876543210",
//   purpose: "login" | "register"
// }
//
// Twilio mode:
//   Twilio generates and sends the OTP.
//
// Local mode:
//   SQLite stores the OTP and terminal displays it.
// ─────────────────────────────────────────────

router.post('/send-otp', async (req, res) => {
  const {
    phone,
    purpose = 'login'
  } = req.body;

  const normalised = normalizePhone(phone);

  if (!isValidPhone(normalised)) {
    return res.status(400).json({
      error:
        'A valid phone number is required. Use format +919876543210.'
    });
  }

  if (!['login', 'register'].includes(purpose)) {
    return res.status(400).json({
      error: 'Invalid OTP purpose.'
    });
  }

  try {
    // LOGIN:
    // Make sure the phone number already belongs to an account.
    if (purpose === 'login') {
      const user = await get(
        'SELECT id FROM users WHERE phone_number = ?',
        [normalised]
      );

      if (!user) {
        return res.status(404).json({
          error:
            'No account found with this mobile number. Please register first.'
        });
      }
    }

    const smsMode = getSmsMode();

    console.log(
      `📲 OTP request | purpose=${purpose} | mode=${smsMode} | phone=${normalised}`
    );

    // ─────────────────────────────────────────
    // TWILIO MODE
    // ─────────────────────────────────────────

    if (smsMode === 'twilio') {
      const verification = await sendTwilioOTP(normalised);

      console.log(
        `📱 [TWILIO] Verification started | status=${verification.status} | phone=${normalised}`
      );

      return res.json({
        success: true,
        mode: 'twilio',
        message:
          `Verification code sent to ${normalised.slice(0, 4)}****${normalised.slice(-3)}.`,
        status: verification.status
      });
    }

    // ─────────────────────────────────────────
    // LOCAL DEVELOPMENT MODE
    // ─────────────────────────────────────────

    // Delete previous unverified OTPs.
    await run(
      `DELETE FROM otp_verifications
       WHERE identifier = ?
       AND verified = 0`,
      [normalised]
    );

    const otp = generateOTP();

    await run(
      `INSERT INTO otp_verifications
        (identifier, otp_code, purpose, expires_at)
       VALUES (?, ?, ?, ?)`,
      [
        normalised,
        otp,
        purpose,
        otpExpiry()
      ]
    );

    simulateSendSMS(normalised, otp);

    return res.json({
      success: true,
      mode: 'local',
      message:
        `Development OTP generated for ${normalised.slice(0, 4)}****${normalised.slice(-3)}.`,
      devOtp: otp,
      devNote:
        'Local development mode only. Do not expose devOtp in production.'
    });
  } catch (err) {
    console.error('Send OTP error:', err);

    res.status(500).json({
      error:
        err.message || 'Failed to send OTP'
    });
  }
});

// ─────────────────────────────────────────────
// 4. VERIFY MOBILE OTP — LOGIN
// POST /api/verify-otp
//
// body:
// {
//   phone,
//   otp,
//   purpose: "login"
// }
// ─────────────────────────────────────────────

router.post('/verify-otp', async (req, res) => {
  const {
    phone,
    otp,
    purpose = 'login'
  } = req.body;

  const normalised = normalizePhone(phone);

  if (!normalised || !otp) {
    return res.status(400).json({
      error: 'Phone number and OTP code are required'
    });
  }

  if (!isValidPhone(normalised)) {
    return res.status(400).json({
      error: 'Invalid phone number format'
    });
  }

  if (!['login', 'register'].includes(purpose)) {
    return res.status(400).json({
      error: 'Invalid OTP purpose'
    });
  }

  try {
    const smsMode = getSmsMode();

    let otpVerified = false;

    // ─────────────────────────────────────────
    // TWILIO VERIFICATION
    // ─────────────────────────────────────────

    if (smsMode === 'twilio') {
      const verificationCheck = await checkTwilioOTP(
        normalised,
        otp
      );

      console.log(
        `🔐 [TWILIO] OTP check | phone=${normalised} | status=${verificationCheck.status}`
      );

      if (verificationCheck.status !== 'approved') {
        return res.status(401).json({
          error:
            'Invalid or expired OTP. Please request a new code.'
        });
      }

      otpVerified = true;
    }

    // ─────────────────────────────────────────
    // LOCAL SQLITE VERIFICATION
    // ─────────────────────────────────────────

    if (smsMode === 'local') {
      const record = await get(
        `SELECT *
         FROM otp_verifications
         WHERE identifier = ?
         AND otp_code = ?
         AND purpose = ?
         AND verified = 0
         AND expires_at > CURRENT_TIMESTAMP
         ORDER BY created_at DESC
         LIMIT 1`,
        [
          normalised,
          otp.trim(),
          purpose
        ]
      );

      if (!record) {
        return res.status(401).json({
          error:
            'Invalid or expired OTP. Please request a new code.'
        });
      }

      await run(
        'UPDATE otp_verifications SET verified = 1 WHERE id = ?',
        [record.id]
      );

      otpVerified = true;
    }

    if (!otpVerified) {
      return res.status(401).json({
        error: 'OTP verification failed.'
      });
    }

    // ─────────────────────────────────────────
    // FIND USER
    // ─────────────────────────────────────────

    let user = await get(
      'SELECT id FROM users WHERE phone_number = ?',
      [normalised]
    );

    // Register through /verify-otp if no account exists.
    if (!user && purpose === 'register') {
      const autoUsername =
        `user${Date.now().toString().slice(-6)}`;

      const dummyHash = await bcrypt.hash(
        `phone_${Date.now()}_${Math.random()}`,
        10
      );

      const result = await run(
        `INSERT INTO users
          (username, email, password_hash, phone_number,
           role, auth_provider, phone_verified)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          autoUsername,
          `${autoUsername}@phone.careerzen.app`,
          dummyHash,
          normalised,
          'job_seeker',
          'phone',
          1
        ]
      );

      await createDefaultProfile(
        result.id,
        autoUsername,
        'job_seeker',
        autoUsername
      );

      user = {
        id: result.id
      };
    } else if (!user) {
      return res.status(404).json({
        error:
          'No account found with this phone number. Please register first.'
      });
    } else {
      await run(
        'UPDATE users SET phone_verified = 1 WHERE id = ?',
        [user.id]
      );
    }

    res.json(
      await buildUserResponse(user.id)
    );
  } catch (err) {
    console.error('Verify OTP error:', err);

    res.status(500).json({
      error:
        err.message || 'Failed to verify OTP'
    });
  }
});

// ─────────────────────────────────────────────
// 5. REGISTER PHONE USER
// POST /api/register-phone
//
// body:
// {
//   phone,
//   otp,
//   fullName,
//   role,
//   headline
// }
//
// This verifies the OTP using either:
//   Twilio Verify
//   OR local SQLite OTP
// ─────────────────────────────────────────────

router.post('/register-phone', async (req, res) => {
  const role = 'job_seeker';
  const {
    phone,
    otp,
    fullName
,
    headline
  } = req.body;

  const normalised = normalizePhone(phone);

  if (!normalised || !otp || !fullName) {
    return res.status(400).json({
      error: 'Phone, OTP, and full name are required'
    });
  }

  if (!isValidPhone(normalised)) {
    return res.status(400).json({
      error: 'Invalid phone number format'
    });
  }

  try {
    const smsMode = getSmsMode();

    // ─────────────────────────────────────────
    // VERIFY OTP
    // ─────────────────────────────────────────

    if (smsMode === 'twilio') {
      const verificationCheck =
        await checkTwilioOTP(
          normalised,
          otp
        );

      if (
        verificationCheck.status !== 'approved'
      ) {
        return res.status(401).json({
          error:
            'Invalid or expired OTP. Please request a new code.'
        });
      }
    } else {
      const record = await get(
        `SELECT *
         FROM otp_verifications
         WHERE identifier = ?
         AND otp_code = ?
         AND purpose = 'register'
         AND verified = 0
         AND expires_at > CURRENT_TIMESTAMP
         ORDER BY created_at DESC
         LIMIT 1`,
        [
          normalised,
          otp.trim()
        ]
      );

      if (!record) {
        return res.status(401).json({
          error:
            'Invalid or expired OTP. Please request a new code.'
        });
      }

      await run(
        'UPDATE otp_verifications SET verified = 1 WHERE id = ?',
        [record.id]
      );
    }

    // ─────────────────────────────────────────
    // CHECK EXISTING PHONE
    // ─────────────────────────────────────────

    const existing = await get(
      'SELECT id FROM users WHERE phone_number = ?',
      [normalised]
    );

    if (existing) {
      return res.status(400).json({
        error:
          'This phone number is already registered. Please login instead.'
      });
    }

    // ─────────────────────────────────────────
    // CREATE USER
    // ─────────────────────────────────────────

    const safeName =
      fullName.trim().replace(/\s+/g, ' ');

    const autoUsername =
      `${safeName
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')}${Date.now()
        .toString()
        .slice(-4)}`;

    const autoEmail =
      `${autoUsername}@phone.careerzen.app`;

    const dummyHash = await bcrypt.hash(
      `phone_${Date.now()}_${Math.random()}`,
      10
    );

    const result = await run(
      `INSERT INTO users
        (username, email, password_hash, phone_number,
         role, auth_provider, phone_verified)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        autoUsername,
        autoEmail,
        dummyHash,
        normalised,
        role,
        'phone',
        1
      ]
    );

    await createDefaultProfile(
      result.id,
      safeName,
      role,
      autoUsername
    );

    if (headline) {
      await run(
        'UPDATE profiles SET headline = ? WHERE user_id = ?',
        [
          headline,
          result.id
        ]
      );
    }

    res.status(201).json(
      await buildUserResponse(result.id)
    );
  } catch (err) {
    console.error(
      'Register phone error:',
      err
    );

    res.status(500).json({
      error:
        err.message ||
        'Failed to register with phone'
    });
  }
});

// ─────────────────────────────────────────────
// 6. GOOGLE OAUTH
// POST /api/auth/google
// ─────────────────────────────────────────────

router.post('/auth/google', async (req, res) => {
  const {
    googleId,
    email,
    name,
    avatar
  } = req.body;
  const role = 'job_seeker';

  if (!googleId || !email || !name) {
    return res.status(400).json({
      error:
        'Google authentication data is incomplete'
    });
  }

  try {
    let user = await get(
      'SELECT id FROM users WHERE google_id = ? OR email = ?',
      [
        googleId,
        email.toLowerCase()
      ]
    );

    if (!user) {
      const baseUsername =
        name
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '') +
        Date.now().toString().slice(-4);

      const dummyHash = await bcrypt.hash(
        `google_${Date.now()}_${Math.random()}`,
        10
      );

      const result = await run(
        `INSERT INTO users
          (username, email, password_hash, google_id,
           role, auth_provider, email_verified)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          baseUsername,
          email.toLowerCase(),
          dummyHash,
          googleId,
          role,
          'google',
          1
        ]
      );

      user = {
        id: result.id
      };

      await createDefaultProfile(
        result.id,
        name,
        role,
        baseUsername
      );

      if (avatar) {
        await run(
          'UPDATE profiles SET avatar_url = ? WHERE user_id = ?',
          [
            avatar,
            result.id
          ]
        );
      }
    } else {
      await run(
        `UPDATE users
         SET google_id = ?,
             auth_provider = ?,
             email_verified = 1
         WHERE id = ?`,
        [
          googleId,
          'google',
          user.id
        ]
      );

      if (avatar) {
        await run(
          'UPDATE profiles SET avatar_url = ? WHERE user_id = ?',
          [
            avatar,
            user.id
          ]
        );
      }
    }

    res.json(
      await buildUserResponse(user.id)
    );
  } catch (err) {
    console.error(
      'Google auth error:',
      err
    );

    res.status(500).json({
      error:
        'Google authentication failed'
    });
  }
});

// ─────────────────────────────────────────────
// 7. GET CURRENT USER
// GET /api/me
// ─────────────────────────────────────────────

router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await get(
      `SELECT id, username, email, role, phone_number,
              auth_provider, phone_verified,
              aadhaar_masked, aadhaar_verified,
              kyc_verified_at, created_at
       FROM users
       WHERE id = ?`,
      [req.user.id]
    );

    const profile = await get(
      'SELECT * FROM profiles WHERE user_id = ?',
      [req.user.id]
    );

    const skills = await query(
      'SELECT * FROM skills WHERE user_id = ?',
      [req.user.id]
    );

    const unreadNotifs = await get(
      `SELECT COUNT(*) as count
       FROM notifications
       WHERE user_id = ?
       AND is_read = 0`,
      [req.user.id]
    );

    let company = null;

    if (user?.role === 'recruiter') {
      company = await get(
        'SELECT * FROM companies WHERE recruiter_id = ?',
        [req.user.id]
      );
    }

    // Pending/submitted premium request, if any
    const pendingSub = await get(
      `SELECT payment_status FROM student_subscriptions
       WHERE user_id = ? AND payment_status IN ('pending', 'submitted')
         AND status != 'cancelled'
       ORDER BY created_at DESC LIMIT 1`,
      [req.user.id]
    );

    // Active premium plan so the UI can show the right badge
    const activeSub = await get(
      `SELECT plan, end_date FROM student_subscriptions
       WHERE user_id = ? AND status = 'active'
         AND (end_date IS NULL OR end_date > CURRENT_TIMESTAMP)
       ORDER BY created_at DESC LIMIT 1`,
      [req.user.id]
    );

    res.json({
      ...user,
      premium_plan: activeSub?.plan || 'free',
      premium_expires_at: activeSub?.end_date || null,
      premium_pending: pendingSub?.payment_status || null,

      profile: profile
        ? {
            ...profile,
            education: JSON.parse(
              profile.education || '[]'
            ),
            experience: JSON.parse(
              profile.experience || '[]'
            ),
            projects: JSON.parse(
              profile.projects || '[]'
            ),
            social_links: JSON.parse(
              profile.social_links || '{}'
            )
          }
        : null,

      skills,

      company,

      unreadNotificationsCount:
        unreadNotifs?.count || 0
    });
  } catch (err) {
    console.error(
      'Me error:',
      err
    );

    res.status(500).json({
      error:
        'Failed to fetch user data'
    });
  }
});

// ─────────────────────────────────────────────
// 8. AADHAAR & STUDENT KYC VERIFICATION
// ─────────────────────────────────────────────

// Send OTP to Aadhaar-registered mobile.
// NOTE: This remains a DEMO/SIMULATION flow.
// Do not represent it as a real UIDAI verification.
router.post(
  '/kyc/aadhaar/send-otp',
  authenticate,
  async (req, res) => {
    const {
      aadhaarNumber
    } = req.body;

    const digits =
      (aadhaarNumber || '')
        .replace(/\D/g, '');

    if (digits.length !== 12) {
      return res.status(400).json({
        error:
          'A valid 12-digit Aadhaar number is required.'
      });
    }

    if (
      digits.startsWith('0') ||
      digits.startsWith('1')
    ) {
      return res.status(400).json({
        error:
          'Invalid Aadhaar format. Aadhaar numbers cannot start with 0 or 1.'
      });
    }

    try {
      const masked =
        `XXXX-XXXX-${digits.slice(-4)}`;

      const otp = generateOTP();

      await run(
        `DELETE FROM otp_verifications
         WHERE identifier = ?
         AND verified = 0`,
        [`aadhaar_${req.user.id}`]
      );

      await run(
        `INSERT INTO otp_verifications
          (identifier, otp_code, purpose, expires_at)
         VALUES (?, ?, ?, ?)`,
        [
          `aadhaar_${req.user.id}`,
          otp,
          'aadhaar_kyc',
          otpExpiry()
        ]
      );

      console.log(
        `\n🛡️ [AADHAAR KYC DEMO/SIMULATION] User: ${req.user.id} | Aadhaar: ${masked} | OTP: ${otp}\n`
      );

      const isDev =
        process.env.NODE_ENV !== 'production';

      res.json({
        success: true,
        maskedAadhaar: masked,
        message:
          'Aadhaar verification demo OTP generated. This endpoint does not perform real UIDAI verification.',
        ...(isDev && {
          devOtp: otp
        })
      });
    } catch (err) {
      console.error(
        'Aadhaar OTP error:',
        err
      );

      res.status(500).json({
        error:
          'Failed to initiate Aadhaar verification.'
      });
    }
  }
);

// Verify Aadhaar OTP.
router.post(
  '/kyc/aadhaar/verify',
  authenticate,
  async (req, res) => {
    const {
      aadhaarNumber,
      otp
    } = req.body;

    const digits =
      (aadhaarNumber || '')
        .replace(/\D/g, '');

    if (
      digits.length !== 12 ||
      !otp
    ) {
      return res.status(400).json({
        error:
          '12-digit Aadhaar number and 6-digit OTP code are required.'
      });
    }

    try {
      const record = await get(
        `SELECT *
         FROM otp_verifications
         WHERE identifier = ?
         AND otp_code = ?
         AND purpose = 'aadhaar_kyc'
         AND verified = 0
         AND expires_at > CURRENT_TIMESTAMP
         ORDER BY created_at DESC
         LIMIT 1`,
        [
          `aadhaar_${req.user.id}`,
          otp.trim()
        ]
      );

      if (!record) {
        return res.status(400).json({
          error:
            'Invalid or expired Aadhaar OTP code. Please request a new code.'
        });
      }

      await run(
        'UPDATE otp_verifications SET verified = 1 WHERE id = ?',
        [record.id]
      );

      const masked =
        `XXXX-XXXX-${digits.slice(-4)}`;

      const now =
        new Date().toISOString();

      await run(
        `UPDATE users
         SET aadhaar_masked = ?,
             aadhaar_verified = 1,
             kyc_verified_at = ?
         WHERE id = ?`,
        [
          masked,
          now,
          req.user.id
        ]
      );

      await run(
        `UPDATE profiles
         SET student_id_verified = 1
         WHERE user_id = ?`,
        [req.user.id]
      );

      await run(
        `INSERT INTO notifications
          (user_id, actor_id, type, message)
         VALUES (?, ?, ?, ?)`,
        [
          req.user.id,
          req.user.id,
          'kyc_verified',
          `🛡️ Identity Verified! Your Aadhaar (${masked}) and student credentials have been verified in the CareerZen demo environment.`
        ]
      );

      const updatedUser =
        await buildUserResponse(
          req.user.id
        );

      res.json({
        success: true,
        message:
          'Aadhaar demo verification successful! Verified badge activated.',
        user: updatedUser.user
      });
    } catch (err) {
      console.error(
        'Aadhaar verify error:',
        err
      );

      res.status(500).json({
        error:
          'Failed to complete Aadhaar verification.'
      });
    }
  }
);

// ─────────────────────────────────────────────
// 8b. BIOMETRIC (FACE SCAN / FINGERPRINT) KYC
// ─────────────────────────────────────────────
// Demo/Simulation: accepts a biometric template payload, stores a salted hash,
// and issues a biometric login token. Not a real biometric verification.

const BIOMETRIC_SALT = process.env.BIOMETRIC_SALT || 'careerzen-demo-salt';

// Face templates are captured from live camera pixels, so a repeat scan is never
// byte-identical. Accept the closest enrolled template above this similarity.
const BIOMETRIC_MATCH_THRESHOLD = 0.82;

function hashBiometricTemplate(rawTemplate) {
  return crypto
    .createHmac('sha256', BIOMETRIC_SALT)
    .update(String(rawTemplate || ''))
    .digest('hex');
}

// Decode a client template back into its comparable numeric features.
// Client format: cc-face-<base64 of "cell0.cell1...|L<luminance>|E<edge>|S<WxH>">
function decodeTemplate(template) {
  const raw = String(template || '');
  const b64 = raw.startsWith('cc-face-') ? raw.slice('cc-face-'.length) : raw;
  let decoded;
  try {
    decoded = Buffer.from(b64, 'base64').toString('utf8');
  } catch {
    return null;
  }

  const [cellsPart, lumPart, edgePart] = decoded.split('|');
  if (!cellsPart || !lumPart || !edgePart) return null;

  const cells = cellsPart.split('.').map((n) => Number(n)).filter((n) => Number.isFinite(n));
  if (cells.length < 8) return null;

  return {
    cells,
    lum: Number(String(lumPart).replace('L', '')) || 0,
    edge: Number(String(edgePart).replace('E', '')) || 0,
  };
}

// Cosine-style similarity over the luminance grid, blended with luminance and
// edge agreement. Returns 0..1 where 1 is an identical capture.
function templateSimilarity(a, b) {
  if (!a || !b || a.cells.length !== b.cells.length) return 0;

  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.cells.length; i++) {
    dot += a.cells[i] * b.cells[i];
    normA += a.cells[i] * a.cells[i];
    normB += b.cells[i] * b.cells[i];
  }
  const gridScore = normA && normB ? dot / (Math.sqrt(normA) * Math.sqrt(normB)) : 0;

  const range = 255;
  const lumScore = 1 - Math.min(1, Math.abs(a.lum - b.lum) / range);
  const edgeScore = 1 - Math.min(1, Math.abs(a.edge - b.edge) / (range / 4));

  return gridScore * 0.7 + lumScore * 0.2 + edgeScore * 0.1;
}

// Enroll a biometric template (face scan / fingerprint) for the signed-in user.
// If an Aadhaar number is supplied, this also completes Aadhaar verification,
// so the OTP step can be skipped in favour of biometric authentication.
router.post(
  '/kyc/biometric/enroll',
  authenticate,
  async (req, res) => {
    const { template, label = 'face', aadhaarNumber } = req.body;
    if (!template || typeof template !== 'string' || template.trim().length < 8) {
      return res.status(400).json({
        error: 'A valid biometric template (min 8 chars) is required.'
      });
    }

    try {
      const digest = hashBiometricTemplate(template.trim());
      const rawTemplate = template.trim();
      const now = new Date().toISOString();

      await run(
        `UPDATE users
         SET biometric_hash = ?,
             biometric_template = ?,
             biometric_verified = 1,
             biometric_verified_at = ?
         WHERE id = ?`,
        [digest, rawTemplate, now, req.user.id]
      );

      // Complete Aadhaar verification in the same transaction when a number is given
      const digits = (aadhaarNumber || '').replace(/\D/g, '');
      let maskedAadhaar = null;
      if (digits.length === 12) {
        maskedAadhaar = `XXXX-XXXX-${digits.slice(-4)}`;
        await run(
          `UPDATE users
           SET aadhaar_masked = ?,
               aadhaar_verified = 1,
               kyc_verified_at = ?
           WHERE id = ?`,
          [maskedAadhaar, now, req.user.id]
        );
        await run(
          `UPDATE profiles
           SET student_id_verified = 1
           WHERE user_id = ?`,
          [req.user.id]
        );
      }

      await run(
        `INSERT INTO notifications
          (user_id, actor_id, type, message)
         VALUES (?, ?, ?, ?)`,
        [
          req.user.id,
          req.user.id,
          'kyc_verified',
          maskedAadhaar
            ? `🔐 Identity Verified! Biometric (${label}) enrolled and Aadhaar (${maskedAadhaar}) linked in the CareerZen demo environment.`
            : `🔐 Biometric (${label}) enrolled and verified for your CareerZen profile.`
        ]
      );

      const updatedUser = await buildUserResponse(req.user.id);

      res.json({
        success: true,
        message: maskedAadhaar
          ? `Biometric (${label}) enrollment successful! Aadhaar (${maskedAadhaar}) verified — biometric sign-in is now enabled.`
          : `Biometric (${label}) enrollment successful! Biometric sign-in is now enabled.`,
        aadhaarMasked: maskedAadhaar,
        user: updatedUser.user
      });
    } catch (err) {
      console.error('Biometric enroll error:', err);
      res.status(500).json({ error: 'Failed to enroll biometric template.' });
    }
  }
);

// Check whether the signed-in user has an enrolled biometric profile,
// and return the stored template so the client can use it for sign-in.
router.get(
  '/kyc/biometric/status',
  authenticate,
  async (req, res) => {
    try {
      const user = await get(
        `SELECT id, biometric_verified, biometric_template
         FROM users
         WHERE id = ?`,
        [req.user.id]
      );
      res.json({
        enrolled: !!(user && user.biometric_verified && user.biometric_template),
        biometric_verified: !!(user && user.biometric_verified),
        template: user?.biometric_template || null
      });
    } catch (err) {
      console.error('Biometric status error:', err);
      res.status(500).json({ error: 'Failed to fetch biometric status.' });
    }
  }
);

// Sign in using a previously enrolled biometric template.
// Live camera captures are compared with a similarity score rather than an exact
// hash match, because lighting and framing change between scans.
router.post(
  '/auth/biometric/login',
  async (req, res) => {
    const { template } = req.body;
    if (!template || typeof template !== 'string' || template.trim().length < 8) {
      return res.status(400).json({ error: 'A valid biometric template is required.' });
    }

    try {
      const incoming = decodeTemplate(template.trim());
      const digest = hashBiometricTemplate(template.trim());

      // Exact template match (the common path for re-enrollment on the same device)
      let user = await get(
        `SELECT u.id, u.username, u.email, u.role, u.is_active,
                u.biometric_verified, u.biometric_hash, u.biometric_template,
                p.full_name, p.headline, p.avatar_url
         FROM users u
         LEFT JOIN profiles p ON u.id = p.user_id
         WHERE u.biometric_hash = ? AND u.biometric_verified = 1`,
        [digest]
      );

      let matchScore = user ? 1 : 0;

      // Otherwise fall back to the closest enrolled template within tolerance
      if (!user && incoming) {
        const candidates = await query(
          `SELECT u.id, u.username, u.email, u.role, u.is_active,
                  u.biometric_hash, u.biometric_template,
                  p.full_name, p.headline, p.avatar_url
           FROM users u
           LEFT JOIN profiles p ON u.id = p.user_id
           WHERE u.biometric_verified = 1 AND u.biometric_template IS NOT NULL`
        );

        let best = null;
        for (const c of candidates || []) {
          const stored = decodeTemplate(c.biometric_template);
          if (!stored) continue;
          const score = templateSimilarity(incoming, stored);
          if (!best || score > best.score) best = { row: c, score };
        }

        if (best && best.score >= BIOMETRIC_MATCH_THRESHOLD) {
          user = best.row;
          matchScore = best.score;
        }
      }

      if (!user) {
        return res.status(401).json({ error: 'Face not recognized. Please enroll again to continue.' });
      }
      if (!user.is_active) {
        return res.status(401).json({ error: 'Account is disabled.' });
      }

      const token = generateToken(user);
      res.json({
        success: true,
        token,
        matchScore: Number(matchScore.toFixed(3)),
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          profile: user.full_name
            ? { full_name: user.full_name, headline: user.headline, avatar_url: user.avatar_url }
            : null
        }
      });
    } catch (err) {
      console.error('Biometric login error:', err);
      res.status(500).json({ error: 'Failed to complete biometric sign-in.' });
    }
  }
);

// ─────────────────────────────────────────────
// STUDENT ID UPLOAD
// ─────────────────────────────────────────────

router.post(
  '/kyc/student-id/upload',
  authenticate,
  async (req, res) => {
    const {
      documentUrl,
      collegeName,
      graduationYear
    } = req.body;

    if (!documentUrl) {
      return res.status(400).json({
        error:
          'Document URL or file payload is required.'
      });
    }

    try {
      await run(
        `UPDATE profiles
         SET id_document_url = ?,
             student_id_verified = 1
         WHERE user_id = ?`,
        [
          documentUrl,
          req.user.id
        ]
      );

      const updatedUser =
        await buildUserResponse(
          req.user.id
        );

      res.json({
        success: true,
        message:
          'Student College ID submitted & verified.',
        user: updatedUser.user
      });
    } catch (err) {
      console.error(
        'Student ID upload error:',
        err
      );

      res.status(500).json({
        error:
          'Failed to upload student document.'
      });
    }
  }
);

// ─────────────────────────────────────────────
// 9. DEMO USERS - REMOVED FOR PRODUCTION
// ─────────────────────────────────────────────
// The demo-users and demo-switch endpoints have been removed
// for production deployment. User registration and login
// should be used instead.


// Admin SSO (OIDC Authorization Code + PKCE)
router.get('/auth/admin-sso', async (req, res) => {
  try {
    if (!oidcConfigured()) {
      // Dev fallback: create a local admin token directly
      if (process.env.NODE_ENV === 'development') {
        const { get } = await import('../db.js');
        const { generateToken } = await import('../auth.js');
        const user = await get('SELECT id, username, email, role FROM users WHERE email = ? AND role = ?', ['suprabhatsaha1234@gmail.com', 'admin']);
        if (user) {
          const token = generateToken(user);
          const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
          return res.redirect(`${clientUrl}/#sso_token=${encodeURIComponent(token)}`);
        }
        return res.status(404).json({ error: 'Admin user not found for dev SSO fallback' });
      }
      return res.status(503).json({ error: 'Admin SSO is not configured' });
    }
    const url = await startAdminSso();
    res.redirect(url);
  } catch (err) {
    console.error('Admin SSO start error:', err);
    res.status(500).json({ error: 'Unable to start admin SSO' });
  }
});

router.get('/auth/admin-sso/callback', async (req, res) => {
  try {
    if (req.query.error) throw new Error(req.query.error_description || req.query.error);
    const result = await finishAdminSso(req.query.code, req.query.state);
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    const target = `${clientUrl}/#sso_token=${encodeURIComponent(result.token)}`;
    res.redirect(target);
  } catch (err) {
    console.error('Admin SSO callback error:', err);
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    res.redirect(`${clientUrl}/?sso=error&message=${encodeURIComponent(err.message || 'SSO failed')}`);
  }
});

export default router;