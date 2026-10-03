import express from 'express';
import { authenticate, optionalAuth } from '../auth.js';
import { run, get, query } from '../db.js';
import { getFileUrl, uploadPaymentProof } from '../services/upload.js';

const router = express.Router();

// ─────────────────────────────────────────────
// GET /api/premium/features - List available premium features (PUBLIC)
// ─────────────────────────────────────────────
router.get('/features', async (req, res) => {
  try {
    const features = await query('SELECT * FROM premium_features WHERE enabled = 1 ORDER BY plan, id');
    const pricing = await get('SELECT * FROM premium_plans WHERE id = 1');
    res.json({
      features: features || [],
      pricing: pricing || { premium_price: 299, pro_price: 799, currency: 'INR', premium_duration_days: 30, pro_duration_days: 30 }
    });
  } catch (err) {
    console.error('Fetch premium features error:', err);
    res.status(500).json({ error: 'Failed to fetch premium features' });
  }
});

// ─────────────────────────────────────────────
// GET /api/premium/me - Get current user's premium status
// ─────────────────────────────────────────────
router.get('/me', authenticate, async (req, res) => {
  const userId = req.user.id;
  try {
    const subscription = await get(
      `SELECT * FROM student_subscriptions
       WHERE user_id = ? AND status = 'active'
         AND (end_date IS NULL OR end_date > CURRENT_TIMESTAMP)
       ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );

    // A pending/submitted request is surfaced separately so the UI can show
    // "awaiting verification" without granting any features.
    const pending = await get(
      `SELECT * FROM student_subscriptions
       WHERE user_id = ? AND payment_status IN ('pending', 'submitted')
         AND status != 'cancelled'
       ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );

    const plan = subscription?.plan || 'free';

    const pricing = await get('SELECT * FROM premium_plans WHERE id = 1');

    // Pro subscribers inherit every Premium feature plus the Pro-only ones.
    // Free users get no features — only an active subscription unlocks them.
    const features =
      plan === 'free'
        ? []
        : await query(
            plan === 'pro'
              ? `SELECT * FROM premium_features
                 WHERE enabled = 1 AND plan IN ('premium', 'pro')
                 ORDER BY CASE plan WHEN 'premium' THEN 0 ELSE 1 END, id`
              : `SELECT * FROM premium_features
                 WHERE enabled = 1 AND plan = 'premium'
                 ORDER BY id`
          );

    res.json({
      plan,
      subscription: subscription || null,
      pending_request: pending || null,
      features: features || [],
      pricing: pricing || null
    });
  } catch (err) {
    console.error('Fetch premium status error:', err);
    res.status(500).json({ error: 'Failed to fetch premium status' });
  }
});

// NOTE: the /upgrade handler now lives further down this file. It creates a
// PENDING subscription tied to a plan and requires admin verification before
// any features are granted.

// ─────────────────────────────────────────────
// GET /api/premium/features/:plan - Public feature list for one plan.
// Pro subscribers also receive every Premium feature.
// ─────────────────────────────────────────────
router.get('/features/:plan', (req, res) => {
  const plan = String(req.params.plan || '').toLowerCase();
  if (!['premium', 'pro'].includes(plan)) {
    return res.status(400).json({ error: 'Invalid plan. Choose premium or pro.' });
  }

  const sql =
    plan === 'pro'
      ? `SELECT * FROM premium_features
         WHERE enabled = 1 AND plan IN ('premium', 'pro')
         ORDER BY CASE plan WHEN 'premium' THEN 0 ELSE 1 END, id`
      : `SELECT * FROM premium_features
         WHERE enabled = 1 AND plan = 'premium'
         ORDER BY id`;

  query(sql)
    .then((features) => res.json(features || []))
    .catch((err) => {
      console.error('Fetch features by plan error:', err);
      res.status(500).json({ error: 'Failed to fetch premium features' });
    });
});

// ─────────────────────────────────────────────
// GET /api/premium/payment-info — Admin-managed UPI QR + payee details.
// Public so the upgrade modal can show it before sign-in.
// ─────────────────────────────────────────────
router.get('/payment-info', async (req, res) => {
  try {
    const settings =
      (await get('SELECT * FROM payment_settings WHERE id = 1')) || {
        qr_image_url: '',
        upi_id: '',
        payee_name: 'CareerZen Premium',
        instructions: 'Scan the QR code with any UPI app to pay, then submit your payment reference.'
      };
    res.json(settings);
  } catch (err) {
    console.error('Fetch payment info error:', err);
    res.status(500).json({ error: 'Failed to fetch payment details' });
  }
});

// ─────────────────────────────────────────────
// GET /api/premium/payment-options — list every payment option the admin
// has configured, so the upgrade screen can show a real selector instead of
// a single hardcoded QR.
// ─────────────────────────────────────────────
router.get('/payment-options', async (req, res) => {
  try {
    const options = await query(
      'SELECT * FROM payment_options WHERE enabled = 1 ORDER BY sort_order ASC, id ASC'
    );
    res.json(options || []);
  } catch (err) {
    console.error('Fetch payment options error:', err);
    res.status(500).json({ error: 'Failed to fetch payment options' });
  }
});

// ─────────────────────────────────────────────
// POST /api/premium/upgrade — create a PENDING subscription tied to a plan.
// The user pays via the admin's QR, then submits proof for verification.
// Features are granted only after the admin approves the payment.
// ─────────────────────────────────────────────
router.post('/upgrade', authenticate, async (req, res) => {
  const userId = req.user.id;
  const { plan, paymentId, paymentOptionId } = req.body;

  if (!['premium', 'pro'].includes(plan)) {
    return res.status(400).json({ error: 'Invalid plan. Choose premium or pro.' });
  }

  try {
    const pricing = await get('SELECT * FROM premium_plans WHERE id = 1');
    const durationDays =
      plan === 'pro' ? pricing?.pro_duration_days || 30 : pricing?.premium_duration_days || 30;

    const price = plan === 'pro' ? pricing?.pro_price || 799 : pricing?.premium_price || 299;

    // student_subscriptions has a UNIQUE(user_id) constraint — one row per user.
    // Reuse the existing row when the user already has one, otherwise insert.
    // start_date is NOT NULL (defaults to now); the real validity window is set
    // by the admin when they approve the payment.
    const existing = await get(
      'SELECT id FROM student_subscriptions WHERE user_id = ?',
      [userId]
    );

    let subId;
    if (existing) {
      subId = existing.id;
      await run(
        `UPDATE student_subscriptions SET
           plan = ?,
           status = 'pending',
           start_date = CURRENT_TIMESTAMP,
           end_date = NULL,
           payment_id = ?,
           stripe_sub_id = NULL,
           payment_status = 'pending',
           payment_reference = NULL,
           payment_proof_url = NULL,
           payment_option_id = ?,
           submitted_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [plan, paymentId || `ref_${Date.now()}`, paymentOptionId || null, subId]
      );
    } else {
      const result = await run(
        `INSERT INTO student_subscriptions
          (user_id, plan, status, end_date, payment_id,
           payment_status, payment_option_id, submitted_at, updated_at)
         VALUES (?, ?, 'pending', NULL, ?, 'pending', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [userId, plan, paymentId || `ref_${Date.now()}`, paymentOptionId || null]
      );
      subId = result.id;
    }

    const subscription = await get(
      `SELECT ss.*, po.label as payment_option_label, po.type as payment_option_type,
              po.upi_id, po.phonepe_number, po.gpay_number, po.paytm_number,
              po.razorpay_enabled, po.qr_image_url, po.instructions as payment_instructions
       FROM student_subscriptions ss
       LEFT JOIN payment_options po ON po.id = ss.payment_option_id
       WHERE ss.id = ?`,
      [subId]
    );

    res.json({
      success: true,
      subscription,
      plan,
      pricing: {
        original_price: Number(price),
        discount_amount: 0,
        amount_due: Number(price),
        currency: pricing?.currency || 'INR',
        duration_days: durationDays
      },
      message: `Payment of ${Number(price).toFixed(2)} required. Scan the QR code, then submit your payment reference.`
    });
  } catch (err) {
    console.error('Upgrade error:', err);
    const status = err.statusCode || 500;
    res.status(status).json({
      error: status === 500 ? 'Failed to start upgrade' : err.message,
      details: err.message
    });
  }
});

// ─────────────────────────────────────────────
// POST /api/premium/submit-proof — attach a payment screenshot + reference.
// ─────────────────────────────────────────────
router.post('/submit-proof', authenticate, async (req, res) => {
  const userId = req.user.id;
  const { paymentReference, proofUrl } = req.body;

  if (!paymentReference || !String(paymentReference).trim()) {
    return res.status(400).json({ error: 'Payment reference is required' });
  }

  try {
    const pending = await get(
      `SELECT * FROM student_subscriptions
       WHERE user_id = ? AND payment_status = 'pending'
       ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );

    if (!pending) {
      return res.status(400).json({ error: 'No pending upgrade found. Start an upgrade first.' });
    }

    await run(
      `UPDATE student_subscriptions
       SET payment_reference = ?, payment_proof_url = ?, payment_status = 'submitted',
           submitted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [String(paymentReference).trim(), proofUrl || '', pending.id]
    );

    const updated = await get('SELECT * FROM student_subscriptions WHERE id = ?', [pending.id]);
    res.json({ success: true, subscription: updated, message: 'Payment submitted for verification.' });
  } catch (err) {
    console.error('Submit proof error:', err);
    res.status(500).json({ error: 'Failed to submit payment proof' });
  }
});

// ─────────────────────────────────────────────
// POST /api/premium/upload-proof — upload a payment screenshot image.
// ─────────────────────────────────────────────
router.post(
  '/upload-proof',
  authenticate,
  uploadPaymentProof,
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No payment screenshot provided' });
      }
      res.json({ success: true, proof_url: getFileUrl(req.file) });
    } catch (err) {
      console.error('Upload proof error:', err);
      res.status(500).json({ error: err.message || 'Failed to upload payment screenshot' });
    }
  }
);

// ─────────────────────────────────────────────
// POST /api/premium/cancel - Cancel student subscription
// ─────────────────────────────────────────────
router.post('/cancel', authenticate, async (req, res) => {
  const userId = req.user.id;
  try {
    await run(
      `UPDATE student_subscriptions SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND status = 'active'`,
      [userId]
    );
    res.json({ success: true, message: 'Subscription cancelled' });
  } catch (err) {
    console.error('Cancel error:', err);
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

export default router;