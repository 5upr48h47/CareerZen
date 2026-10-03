import express from 'express';
import { authenticate } from '../auth.js';
import razorpayService, { razorpayConfigured } from '../services/razorpay.js';
import { run, get, query } from '../db.js';

const router = express.Router();

// ─────────────────────────────────────────────
// GET /api/packages - List available job posting packages
// ─────────────────────────────────────────────
router.get('/packages', async (req, res) => {
  try {
    const packages = await query(
      'SELECT * FROM job_packages ORDER BY price ASC'
    );
    res.json(packages || []);
  } catch (err) {
    console.error('Fetch packages error:', err);
    res.status(500).json({ error: 'Failed to fetch packages' });
  }
});

// ─────────────────────────────────────────────
// POST /api/payment/create-order - Create Razorpay order
// ─────────────────────────────────────────────
router.post('/payment/create-order', authenticate, async (req, res) => {
  const { packageId, currency = 'INR' } = req.body;
  const userId = req.user.id;

  try {
    // Get package details
    const packageInfo = await get(
      'SELECT * FROM job_packages WHERE id = ?',
      [packageId]
    );

    if (!packageInfo) {
      return res.status(404).json({ error: 'Package not found' });
    }

    // Check if user already has an active subscription
    const existingSub = await get(
      'SELECT * FROM user_subscriptions WHERE user_id = ? AND status = "active" AND end_date > CURRENT_TIMESTAMP',
      [userId]
    );

    if (existingSub) {
      return res.status(400).json({
        error: 'You already have an active subscription',
        subscription: existingSub
      });
    }

    // Create Razorpay order
    const order = await razorpayService.createOrder({
      userId,
      amount: packageInfo.price,
      currency,
      receipt: `rcpt_${userId}_${packageId}_${Date.now()}`,
      notes: {
        packageId,
        package: packageInfo.name,
        userId,
        jobLimit: packageInfo.jobLimit,
        durationDays: packageInfo.durationDays
      }
    });

    res.json({
      success: true,
      order: {
        id: order.id,
        amount: order.amount,
        currency: order.currency,
        receipt: order.receipt
      },
      package: packageInfo
    });
  } catch (err) {
    console.error('Create order error:', err);
    const status = err.statusCode || 500;
    res.status(status).json({
      error: status === 503 ? err.message : 'Failed to create payment order',
      paymentGatewayConfigured: razorpayConfigured()
    });
  }
});

// ─────────────────────────────────────────────
// POST /api/payment/verify - Verify payment signature
// ─────────────────────────────────────────────
router.post('/payment/verify', authenticate, async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, packageId } = req.body;
  const userId = req.user.id;

  try {
    const result = await razorpayService.verifyPayment({
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      userId
    });

    if (!result.success) {
      return res.status(400).json({ error: 'Payment verification failed' });
    }

    // Get package details
    const packageInfo = await get(
      'SELECT * FROM job_packages WHERE id = ?',
      [packageId]
    );

    if (!packageInfo) {
      return res.status(404).json({ error: 'Package not found' });
    }

    // Create user subscription
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + packageInfo.durationDays);

    await run(
      `INSERT INTO user_subscriptions (
        user_id, package_id, start_date, end_date, status, payment_id
      ) VALUES (?, ?, ?, ?, 'active', ?)`,
      [userId, packageId, startDate.toISOString(), endDate.toISOString(), razorpay_payment_id]
    );

    const subscription = await get(
      `SELECT id FROM user_subscriptions
       WHERE user_id = ? AND payment_id = ?
       ORDER BY id DESC LIMIT 1`,
      [userId, razorpay_payment_id]
    );

    // Update payment with subscription info
    await run(
      `UPDATE payments SET notes = ? WHERE payment_intent_id = ?`,
      [JSON.stringify({ subscriptionId: subscription.id, packageId }), razorpay_order_id]
    );

    res.json({
      success: true,
      message: 'Payment verified and subscription activated',
      subscription: {
        id: subscription.id,
        package: packageInfo.name,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        jobLimit: packageInfo.jobLimit
      }
    });
  } catch (err) {
    console.error('Verify payment error:', err);
    res.status(500).json({ error: 'Failed to verify payment' });
  }
});

// ─────────────────────────────────────────────
// GET /api/payment/history - Get user's payment history
// ─────────────────────────────────────────────
router.get('/payment/history', authenticate, async (req, res) => {
  const userId = req.user.id;

  try {
    const payments = await get(
      `SELECT * FROM payments WHERE user_id = ? ORDER BY created_at DESC`,
      [userId]
    );
    res.json(payments || []);
  } catch (err) {
    console.error('Fetch payment history error:', err);
    res.status(500).json({ error: 'Failed to fetch payment history' });
  }
});

// ─────────────────────────────────────────────
// GET /api/payment/subscription - Get user's active subscription
// ─────────────────────────────────────────────
router.get('/payment/subscription', authenticate, async (req, res) => {
  const userId = req.user.id;

  try {
    const subscription = await get(
      `SELECT s.*, p.name as package_name, p.price, p.jobLimit as job_limit, p.durationDays as duration_days
       FROM user_subscriptions s
       JOIN job_packages p ON s.package_id = p.id
       WHERE s.user_id = ? AND s.status = 'active'
       ORDER BY s.created_at DESC
       LIMIT 1`,
      [userId]
    );
    res.json(subscription || null);
  } catch (err) {
    console.error('Fetch subscription error:', err);
    res.status(500).json({ error: 'Failed to fetch subscription' });
  }
});

// ─────────────────────────────────────────────
// POST /api/payment/webhook - Razorpay webhook handler
// ─────────────────────────────────────────────
router.post('/payment/webhook', async (req, res) => {
  try {
    const result = await razorpayService.processWebhook(req.body);
    res.json(result);
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

export default router;