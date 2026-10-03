"use strict";

import razorpay from 'razorpay';
import { logger } from '../logger.js';
import { run, get } from '../db.js';

// Razorpay needs real credentials. Without them every order call fails with an
// opaque 401 "Authentication failed", so surface that up front instead.
export function razorpayConfigured() {
  const keyId = (process.env.RAZORPAY_KEY_ID || '').trim();
  const keySecret = (process.env.RAZORPAY_KEY_SECRET || '').trim();
  return Boolean(
    keyId &&
      keySecret &&
      !/your_key|your_secret|placeholder|^xxx/i.test(keyId) &&
      !/your_key|your_secret|placeholder|^xxx/i.test(keySecret)
  );
}

export const RAZORPAY_UNCONFIGURED_MESSAGE =
  'Payment gateway is not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to server/.env, ' +
  'or use the admin-uploaded UPI QR payment instead.';

const instance = new razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_your_key_id',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'your_secret_here',
});

/**
 * Create a Razorpay order for job posting payment
 * @param {Object} options - Payment options
 * @param {number} options.amount - Amount in rupees (e.g., 29 for $0.39)
 * @param {string} options.currency - Currency code (default: INR)
 * @param {string} options.receipt - Unique receipt number
 * @param {string} options.notes - Additional notes (job package info)
 * @returns {Promise} Razorpay order response
 */
async function createOrder(options) {
  try {
    if (!razorpayConfigured()) {
      const err = new Error(RAZORPAY_UNCONFIGURED_MESSAGE);
      err.statusCode = 503;
      throw err;
    }

    const orderData = {
      amount: Math.round(options.amount * 100), // Convert to paise
      currency: options.currency || 'INR',
      receipt: options.receipt || `receipt_${Date.now()}`,
      notes: options.notes || {},
      payment_capture: 1, // Auto capture payment
    };

    logger.info({ orderData }, 'Creating Razorpay order');
    const order = await instance.orders.create(orderData);

    // Log successful order creation
    await run(
      `INSERT INTO payments (
        user_id, amount, currency, payment_method, status, payment_intent_id,
        notes, job_postings_created, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        options.userId,
        options.amount,
        order.currency,
        'razorpay',
        'pending',
        order.id,
        JSON.stringify(options.notes),
        0, // Will be updated after successful payment
        new Date().toISOString()
      ]
    );

    return order;
  } catch (error) {
    logger.error({ error }, 'Failed to create Razorpay order');
    // Surface Razorpay's own auth failure as a clear "not configured" signal.
    if (error?.statusCode === 401) {
      const err = new Error(RAZORPAY_UNCONFIGURED_MESSAGE);
      err.statusCode = 503;
      throw err;
    }
    throw error;
  }
}

/**
 * Verify Razorpay payment signature
 * @param {Object} params - Payment verification parameters
 * @param {string} params.razorpay_order_id - Razorpay order ID
 * @param {string} params.razorpay_payment_id - Razorpay payment ID
 * @param {string} params.razorpay_signature - Razorpay signature
 * @param {number} params.userId - User ID
 * @returns {Promise} Verification result
 */
async function verifyPayment(params) {
  try {
    const crypto = await import('crypto');
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, userId } = params;

    const sign = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || 'your_secret_here')
      .update(razorpay_order_id + '|' + razorpay_payment_id)
      .digest('hex');

    if (sign !== razorpay_signature) {
      throw new Error('Invalid payment signature');
    }

    // Update payment status in database
    await run(
      `UPDATE payments SET
        status = 'completed',
        payment_id = ?,
        verified_at = CURRENT_TIMESTAMP,
        job_postings_created = 1
      WHERE payment_intent_id = ? AND user_id = ?`,
      [razorpay_payment_id, razorpay_order_id, userId]
    );

    logger.info(
      { orderId: razorpay_order_id, paymentId: razorpay_payment_id, userId },
      'Payment verified successfully'
    );

    return {
      success: true,
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
    };
  } catch (error) {
    logger.error({ error }, 'Payment verification failed');
    throw error;
  }
}

/**
 * Get payment details by order ID
 * @param {string} orderId - Razorpay order ID
 * @returns {Promise} Payment details
 */
async function getPayment(orderId) {
  try {
    return await get('SELECT * FROM payments WHERE payment_intent_id = ?', [orderId]);
  } catch (error) {
    logger.error({ error, orderId }, 'Failed to get payment details');
    throw error;
  }
}

/**
 * Create a job posting with payment validation
 * @param {Object} jobData - Job posting data
 * @param {number} userId - User ID
 * @param {number} packageId - Job package ID
 * @returns {Promise} Created job posting
 */
async function createJobWithPayment(jobData, userId, packageId) {
  try {
    // Get package details
    const packageInfo = await get(
      'SELECT * FROM job_packages WHERE id = ?',
      [packageId || 1]
    );

    if (!packageInfo) {
      throw new Error('Job package not found');
    }

    // Check user's current job posting count
    const currentJobs = await get(
      'SELECT COUNT(*) as count FROM jobs WHERE recruiter_id = ? AND status = "open"',
      [userId]
    );

    if (currentJobs.count >= packageInfo.job_limit) {
      throw new Error('Job posting limit exceeded for this package');
    }

    // Create job posting
    const jobResult = await run(
      `INSERT INTO jobs (
        company_id, recruiter_id, title, description, requirements, location,
        workplace_type, job_type, experience_level, salary_range, required_skills,
        status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?)`,
      [
        jobData.companyId || null,
        userId,
        jobData.title,
        jobData.description,
        jobData.requirements,
        jobData.location,
        jobData.workplaceType,
        jobData.jobType,
        jobData.experienceLevel,
        jobData.salaryRange,
        JSON.stringify(jobData.requiredSkills || []),
        new Date().toISOString(),
        new Date().toISOString()
      ]
    );

    // Update payment with job posting count
    await run(
      'UPDATE payments SET job_postings_created = job_postings_created + 1 WHERE payment_intent_id = ?',
      [jobResult.id]
    );

    const createdJob = await get('SELECT * FROM jobs WHERE id = ?', [jobResult.id]);

    logger.info(
      { jobId: jobResult.id, userId, packageId },
      'Job posting created with payment'
    );

    return createdJob;
  } catch (error) {
    logger.error({ error, userId }, 'Failed to create job with payment');
    throw error;
  }
}

/**
 * Process webhook from Razorpay
 * @param {Object} webhookData - Webhook payload from Razorpay
 * @returns {Promise} Webhook processing result
 */
async function processWebhook(webhookData) {
  try {
    const { event, payload } = webhookData;

    logger.info({ event, payload }, 'Processing Razorpay webhook');

    switch (event) {
      case 'payment.captured':
        const payment = payload.payment;
        await run(
          `UPDATE payments SET
            status = 'completed',
            payment_id = ?,
            verified_at = CURRENT_TIMESTAMP,
            job_postings_created = 1
          WHERE payment_intent_id = ?`,
          [payment.id, payment.order_id]
        );
        break;

      case 'payment.failed':
        const failedPayment = payload.payment;
        await run(
          `UPDATE payments SET status = 'failed' WHERE payment_intent_id = ?`,
          [failedPayment.order_id]
        );
        break;

      case 'refund.created':
        const refund = payload.refund;
        await run(
          `UPDATE payments SET
            status = 'refunded',
            refund_id = ?,
            refund_amount = ?,
            refunded_at = CURRENT_TIMESTAMP
          WHERE payment_intent_id = ?`,
          [refund.id, refund.amount, refund.order_id]
        );
        break;

      default:
        logger.warn({ event }, 'Unhandled Razorpay webhook event');
    }

    return { success: true };
  } catch (error) {
    logger.error({ error }, 'Webhook processing failed');
    throw error;
  }
}

const RazorpayService = {
  createOrder,
  verifyPayment,
  getPayment,
  createJobWithPayment,
  processWebhook,
};

export default RazorpayService;