import express from 'express';
import { get, run } from '../db.js';
import { authenticate, optionalAuth } from '../auth.js';

const router = express.Router();

// ─────────────────────────────────────────────
// POST /api/coupons/apply
// Public endpoint (no admin required) — validates a coupon code against a
// price and plan, and returns the discounted amount. Kept in its own router
// because adminRoutes.js is entirely behind requireAdmin.
// ─────────────────────────────────────────────
router.post('/coupons/apply', async (req, res) => {
  const { code, amount, plan } = req.body;

  if (!code || !code.trim()) {
    return res.status(400).json({ error: 'Coupon code is required' });
  }
  if (amount === undefined || amount === null || Number(amount) < 0) {
    return res.status(400).json({ error: 'Amount is required' });
  }

  try {
    const coupon = await get(
      `SELECT * FROM coupon_codes
       WHERE code = ? AND active = 1
         AND (max_uses = 0 OR used_count < max_uses)
         AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)`,
      [code.trim().toUpperCase()]
    );

    if (!coupon) {
      return res.status(400).json({ error: 'Invalid, expired, or fully-used coupon code' });
    }

    // applies_to == 'all'  → works for any plan
    // applies_to == 'plan' → only when coupon.plan matches the requested plan
    if (coupon.applies_to === 'plan' && coupon.plan !== plan) {
      return res.status(400).json({ error: 'Coupon not applicable to this plan' });
    }
    if (Number(coupon.min_amount) > 0 && Number(amount) < Number(coupon.min_amount)) {
      return res.status(400).json({ error: `Minimum amount of ${coupon.min_amount} required` });
    }

    const discount =
      coupon.discount_type === 'percent'
        ? (Number(amount) * Number(coupon.discount_value)) / 100
        : Number(coupon.discount_value);

    const finalAmount = Math.max(0, Number(amount) - discount);

    res.json({
      success: true,
      coupon: {
        id: coupon.id,
        code: coupon.code,
        discount_type: coupon.discount_type,
        discount_value: Number(coupon.discount_value)
      },
      original_amount: Number(amount),
      discount_amount: Number(discount.toFixed(2)),
      final_amount: Number(finalAmount.toFixed(2))
    });
  } catch (err) {
    console.error('Apply coupon error:', err);
    res.status(500).json({ error: 'Failed to apply coupon code' });
  }
});

// POST /api/coupons/redeem — redeem a coupon against the signed-in user's
// subscription. Increments the usage counter so max_uses is enforced.
router.post('/coupons/redeem', authenticate, async (req, res) => {
  const { code, plan } = req.body;
  if (!code || !code.trim()) {
    return res.status(400).json({ error: 'Coupon code is required' });
  }

  try {
    const coupon = await get(
      `SELECT * FROM coupon_codes
       WHERE code = ? AND active = 1
         AND (max_uses = 0 OR used_count < max_uses)
         AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)`,
      [code.trim().toUpperCase()]
    );

    if (!coupon) {
      return res.status(400).json({ error: 'Invalid, expired, or fully-used coupon code' });
    }
    if (coupon.applies_to === 'plan' && coupon.plan !== plan) {
      return res.status(400).json({ error: 'Coupon not applicable to this plan' });
    }

    await run(
      'UPDATE coupon_codes SET used_count = used_count + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [coupon.id]
    );

    const updated = await get('SELECT * FROM coupon_codes WHERE id = ?', [coupon.id]);
    res.json({ success: true, coupon: updated });
  } catch (err) {
    console.error('Redeem coupon error:', err);
    res.status(500).json({ error: 'Failed to redeem coupon code' });
  }
});

// GET /api/coupons/public — list active, non-expired coupons for display
router.get('/coupons/public', async (req, res) => {
  try {
    const coupons = await get(
      `SELECT code, discount_type, discount_value, applies_to, plan, min_amount, expires_at
       FROM coupon_codes
       WHERE active = 1
         AND (max_uses = 0 OR used_count < max_uses)
         AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
       ORDER BY created_at DESC`
    );
    res.json(coupons || []);
  } catch (err) {
    console.error('Fetch public coupons error:', err);
    res.status(500).json({ error: 'Failed to fetch coupons' });
  }
});

export default router;