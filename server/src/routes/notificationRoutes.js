import express from 'express';
import { run, get, query } from '../db.js';
import { authenticate } from '../auth.js';

const router = express.Router();

// Get all notifications for current user
router.get('/notifications', authenticate, async (req, res) => {
  const userId = req.user.id;

  try {
    const notifications = await query(
      `SELECT 
        n.id, n.user_id, n.actor_id, n.type, n.message, n.payload, n.is_read, n.created_at,
        u.username as actor_username,
        pr.full_name as actor_name, pr.avatar_url as actor_avatar
       FROM notifications n
       LEFT JOIN users u ON n.actor_id = u.id
       LEFT JOIN profiles pr ON u.id = pr.user_id
       WHERE n.user_id = ?
       ORDER BY n.created_at DESC
       LIMIT 40`,
      [userId]
    );

    const formatted = notifications.map((n) => ({
      ...n,
      payload: JSON.parse(n.payload || '{}')
    }));

    res.json(formatted);
  } catch (err) {
    console.error('Fetch notifications error:', err);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// Mark single notification as read
router.put('/notifications/:id/read', authenticate, async (req, res) => {
  const notifId = Number(req.params.id);
  try {
    await run('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?', [notifId, req.user.id]);
    res.json({ success: true, message: 'Notification marked as read' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update notification' });
  }
});

// Mark all as read
router.put('/notifications/read-all', authenticate, async (req, res) => {
  try {
    await run('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [req.user.id]);
    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update notifications' });
  }
});

// Unread count
router.get('/notifications/unread-count', authenticate, async (req, res) => {
  try {
    const row = await get('SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0', [req.user.id]);
    res.json({ count: row?.count || 0 });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch unread count' });
  }
});

export default router;
