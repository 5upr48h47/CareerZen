import express from 'express';
import { authenticate } from '../auth.js';
import { requireAdmin } from '../admin.js';
import { run, get, query } from '../db.js';
import { getFileUrl, uploadPaymentQr } from '../services/upload.js';

const router = express.Router();

// All payment-option management requires admin auth.
router.use(authenticate, requireAdmin);

// List every configured payment option, ordered by sort_order.
router.get('/admin/payment-options', async (req, res) => {
  try {
    const rows = await query(
      'SELECT * FROM payment_options WHERE enabled = 1 ORDER BY sort_order ASC, id ASC'
    );
    res.json(rows || []);
  } catch (err) {
    console.error('Fetch payment options error:', err);
    res.status(500).json({ error: 'Failed to fetch payment options' });
  }
});

// Create a new payment option. Only one option may be the default.
router.post('/admin/payment-options', uploadPaymentQr, async (req, res) => {
  const {
    label, type, upi_id, phonepe_number, gpay_number, paytm_number,
    razorpay_enabled, instructions, is_default, sort_order
  } = req.body;

  if (!label || !label.trim()) {
    return res.status(400).json({ error: 'Label is required' });
  }
  if (!['upi', 'phonepe', 'gpay', 'paytm', 'razorpay'].includes(type)) {
    return res.status(400).json({ error: 'Invalid payment type' });
  }

  try {
    if (is_default === 'true' || is_default === 1 || is_default === true) {
      await run('UPDATE payment_options SET is_default = 0 WHERE is_default = 1');
    }

    const qrUrl = req.file ? getFileUrl(req.file) : null;

    const result = await run(
      `INSERT INTO payment_options
        (label, type, upi_id, phonepe_number, gpay_number, paytm_number,
         razorpay_enabled, qr_image_url, instructions, is_default, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        label.trim(),
        type,
        upi_id || null,
        phonepe_number || null,
        gpay_number || null,
        paytm_number || null,
        razorpay_enabled === 'true' || razorpay_enabled === 1 || razorpay_enabled === true ? 1 : 0,
        qrUrl || '',
        instructions || '',
        is_default === 'true' || is_default === 1 || is_default === true ? 1 : 0,
        Number(sort_order) || 0
      ]
    );

    const created = await get('SELECT * FROM payment_options WHERE id = ?', [result.id]);
    res.status(201).json({ success: true, option: created });
  } catch (err) {
    console.error('Create payment option error:', err);
    res.status(500).json({ error: err.message || 'Failed to create payment option' });
  }
});

// Update an existing payment option.
router.put('/admin/payment-options/:id', uploadPaymentQr, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid option id' });

  const {
    label, type, upi_id, phonepe_number, gpay_number, paytm_number,
    razorpay_enabled, instructions, is_default, sort_order, enabled
  } = req.body;

  try {
    const existing = await get('SELECT * FROM payment_options WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'Payment option not found' });

    if (is_default === 'true' || is_default === 1 || is_default === true) {
      await run('UPDATE payment_options SET is_default = 0 WHERE is_default = 1');
    }

    const qrUrl = req.file ? getFileUrl(req.file) : (req.body.qr_image_url || null);

    const updates = [];
    const values = [];
    if (label !== undefined) { updates.push('label = ?'); values.push(label.trim()); }
    if (type !== undefined) { updates.push('type = ?'); values.push(type); }
    if (upi_id !== undefined) { updates.push('upi_id = ?'); values.push(upi_id || null); }
    if (phonepe_number !== undefined) { updates.push('phonepe_number = ?'); values.push(phonepe_number || null); }
    if (gpay_number !== undefined) { updates.push('gpay_number = ?'); values.push(gpay_number || null); }
    if (paytm_number !== undefined) { updates.push('paytm_number = ?'); values.push(paytm_number || null); }
    if (razorpay_enabled !== undefined) {
      updates.push('razorpay_enabled = ?');
      values.push(razorpay_enabled === 'true' || razorpay_enabled === 1 || razorpay_enabled === true ? 1 : 0);
    }
    if (qrUrl) { updates.push('qr_image_url = ?'); values.push(qrUrl); }
    if (instructions !== undefined) { updates.push('instructions = ?'); values.push(instructions || ''); }
    if (is_default !== undefined) {
      updates.push('is_default = ?');
      values.push(is_default === 'true' || is_default === 1 || is_default === true ? 1 : 0);
    }
    if (sort_order !== undefined) { updates.push('sort_order = ?'); values.push(Number(sort_order) || 0); }
    if (enabled !== undefined) { updates.push('enabled = ?'); values.push(enabled === 'true' || enabled === 1 || enabled === true ? 1 : 0); }
    updates.push('updated_at = CURRENT_TIMESTAMP');

    await run(`UPDATE payment_options SET ${updates.join(', ')} WHERE id = ?`, [...values, id]);

    const updated = await get('SELECT * FROM payment_options WHERE id = ?', [id]);
    res.json({ success: true, option: updated });
  } catch (err) {
    console.error('UPDATE payment option error:', err.stack || err.message);
    res.status(500).json({ error: err.message || 'Failed to update payment option' });
  }
});

// Delete a payment option.
router.delete('/admin/payment-options/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid option id' });

  try {
    const existing = await get('SELECT * FROM payment_options WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'Payment option not found' });
    if (existing.is_default) {
      return res.status(400).json({ error: 'Cannot delete the default payment option' });
    }

    await run('DELETE FROM payment_options WHERE id = ?', [id]);
    res.json({ success: true, message: 'Payment option deleted' });
  } catch (err) {
    console.error('Delete payment option error:', err);
    res.status(500).json({ error: 'Failed to delete payment option' });
  }
});

export default router;