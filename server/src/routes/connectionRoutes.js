import express from 'express';
import { run, get, query } from '../db.js';
import { authenticate } from '../auth.js';
import { sendToUser } from '../socket.js';

const router = express.Router();

// Get user's connection list & pending requests
router.get('/connections', authenticate, async (req, res) => {
  const userId = req.user.id;

  try {
    // 1. Accepted Connections
    const connections = await query(
      `SELECT 
        c.id as connection_id, c.created_at as connected_since,
        CASE WHEN c.sender_id = ? THEN c.receiver_id ELSE c.sender_id END as user_id,
        u.username, u.role,
        pr.full_name, pr.headline, pr.avatar_url, pr.location
       FROM connections c
       JOIN users u ON u.id = (CASE WHEN c.sender_id = ? THEN c.receiver_id ELSE c.sender_id END)
       LEFT JOIN profiles pr ON pr.user_id = u.id
       WHERE (c.sender_id = ? OR c.receiver_id = ?) AND c.status = 'accepted'
       ORDER BY c.updated_at DESC`,
      [userId, userId, userId, userId]
    );

    // 2. Incoming Pending Requests
    const incoming = await query(
      `SELECT 
        c.id as request_id, c.created_at,
        u.id as sender_id, u.username, u.role,
        pr.full_name, pr.headline, pr.avatar_url, pr.location
       FROM connections c
       JOIN users u ON c.sender_id = u.id
       LEFT JOIN profiles pr ON pr.user_id = u.id
       WHERE c.receiver_id = ? AND c.status = 'pending'
       ORDER BY c.created_at DESC`,
      [userId]
    );

    // 3. Outgoing Pending Requests
    const outgoing = await query(
      `SELECT 
        c.id as request_id, c.created_at,
        u.id as receiver_id, u.username, u.role,
        pr.full_name, pr.headline, pr.avatar_url, pr.location
       FROM connections c
       JOIN users u ON c.receiver_id = u.id
       LEFT JOIN profiles pr ON pr.user_id = u.id
       WHERE c.sender_id = ? AND c.status = 'pending'
       ORDER BY c.created_at DESC`,
      [userId]
    );

    res.json({
      connections,
      incoming,
      outgoing
    });
  } catch (err) {
    console.error('Fetch connections error:', err);
    res.status(500).json({ error: 'Failed to fetch connections' });
  }
});

// Suggestions / People to Connect With
router.get('/connections/suggestions', authenticate, async (req, res) => {
  const userId = req.user.id;
  try {
    const suggestions = await query(
      `SELECT
        u.id, u.username, u.role,
        pr.full_name, pr.headline, pr.avatar_url, pr.location,
        (SELECT GROUP_CONCAT(name, ', ') FROM (SELECT name FROM skills s WHERE s.user_id = u.id LIMIT 4)) as top_skills
       FROM users u
       LEFT JOIN profiles pr ON pr.user_id = u.id
       WHERE u.id != ?
         AND u.id NOT IN (
           SELECT CASE WHEN sender_id = ? THEN receiver_id ELSE sender_id END
           FROM connections
           WHERE (sender_id = ? OR receiver_id = ?) AND status IN ('accepted', 'pending')
         )
       ORDER BY RANDOM() LIMIT 12`,
      [userId, userId, userId, userId]
    );

    const formatted = suggestions.map((s) => ({
      ...s,
      top_skills: s.top_skills ? s.top_skills.split(', ') : []
    }));

    res.json(formatted);
  } catch (err) {
    console.error('Fetch suggestions error:', err);
    res.status(500).json({ error: 'Failed to fetch suggestions' });
  }
});

// Send connection request
router.post('/connections/request', authenticate, async (req, res) => {
  const senderId = req.user.id;
  const { targetUserId } = req.body;

  if (!targetUserId || targetUserId === senderId) {
    return res.status(400).json({ error: 'Invalid target user ID' });
  }

  try {
    const existing = await get(
      `SELECT * FROM connections
       WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)`,
      [senderId, targetUserId, targetUserId, senderId]
    );

    if (existing) {
      if (existing.status === 'accepted') {
        return res.status(400).json({ error: 'Already connected' });
      }
      if (existing.status === 'pending') {
        if (existing.sender_id === senderId) {
          return res.status(400).json({ error: 'Request already sent' });
        }
        // Receiver has a pending request to us - they already sent one
        return res.status(400).json({ error: 'They already sent you a request' });
      }
      // If rejected earlier, restart as pending (sender can re-send)
      await run('UPDATE connections SET sender_id = ?, receiver_id = ?, status = "pending", updated_at = CURRENT_TIMESTAMP WHERE id = ?', [
        senderId,
        targetUserId,
        existing.id
      ]);
    } else {
      await run(
        'INSERT INTO connections (sender_id, receiver_id, status, updated_at) VALUES (?, ?, "pending", CURRENT_TIMESTAMP)',
        [senderId, targetUserId]
      );
    }

    const senderProfile = await get('SELECT full_name FROM profiles WHERE user_id = ?', [senderId]);
    const senderName = senderProfile?.full_name || req.user.username;

    // Send notification
    const notifRes = await run(
      `INSERT INTO notifications (user_id, actor_id, type, message, payload)
       VALUES (?, ?, ?, ?, ?)`,
      [
        targetUserId,
        senderId,
        'connection_request',
        `${senderName} sent you a connection request.`,
        JSON.stringify({ senderId })
      ]
    );

    sendToUser(targetUserId, {
      type: 'notification',
      notification: {
        id: notifRes.id,
        type: 'connection_request',
        message: `${senderName} sent you a connection request.`,
        actor_id: senderId,
        actor_name: senderName,
        created_at: new Date().toISOString()
      }
    });

    res.json({ success: true, message: 'Connection request sent' });
  } catch (err) {
    console.error('Send connection request error:', err);
    res.status(500).json({ error: 'Failed to send connection request' });
  }
});

// Accept connection request
router.post('/connections/:requestId/accept', authenticate, async (req, res) => {
  const { requestId } = req.params;
  const userId = req.user.id;

  try {
    const conn = await get('SELECT * FROM connections WHERE id = ? AND receiver_id = ?', [requestId, userId]);
    if (!conn) return res.status(404).json({ error: 'Connection request not found' });

    await run('UPDATE connections SET status = "accepted", updated_at = CURRENT_TIMESTAMP WHERE id = ?', [requestId]);

    const userProfile = await get('SELECT full_name FROM profiles WHERE user_id = ?', [userId]);
    const userName = userProfile?.full_name || req.user.username;

    // Notify sender that their request was accepted
    const notifRes = await run(
      `INSERT INTO notifications (user_id, actor_id, type, message, payload)
       VALUES (?, ?, ?, ?, ?)`,
      [
        conn.sender_id,
        userId,
        'connection_accepted',
        `${userName} accepted your connection request.`,
        JSON.stringify({ acceptedUserId: userId })
      ]
    );

    sendToUser(conn.sender_id, {
      type: 'notification',
      notification: {
        id: notifRes.id,
        type: 'connection_accepted',
        message: `${userName} accepted your connection request.`,
        actor_id: userId,
        actor_name: userName,
        created_at: new Date().toISOString()
      }
    });

    res.json({ success: true, message: 'Connection accepted' });
  } catch (err) {
    console.error('Accept connection error:', err);
    res.status(500).json({ error: 'Failed to accept connection' });
  }
});

// Reject connection request
router.post('/connections/:requestId/reject', authenticate, async (req, res) => {
  const { requestId } = req.params;
  const userId = req.user.id;

  try {
    const conn = await get('SELECT * FROM connections WHERE id = ? AND receiver_id = ?', [requestId, userId]);
    if (!conn) return res.status(404).json({ error: 'Connection request not found' });

    await run('UPDATE connections SET status = "rejected", updated_at = CURRENT_TIMESTAMP WHERE id = ?', [requestId]);
    res.json({ success: true, message: 'Connection request declined' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to decline connection request' });
  }
});

// Remove connection or cancel request
router.delete('/connections/:targetUserId', authenticate, async (req, res) => {
  const userId = req.user.id;
  const targetUserId = req.params.targetUserId;

  try {
    await run(
      `DELETE FROM connections
       WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)`,
      [userId, targetUserId, targetUserId, userId]
    );
    res.json({ success: true, message: 'Connection removed' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove connection' });
  }
});

// Cancel outgoing connection request (only pending, sender-only)
router.delete('/connections/request/:targetUserId', authenticate, async (req, res) => {
  const senderId = req.user.id;
  const targetUserId = Number(req.params.targetUserId);

  try {
    await run(
      `DELETE FROM connections
       WHERE sender_id = ? AND receiver_id = ? AND status = 'pending'`,
      [senderId, targetUserId]
    );
    res.json({ success: true, message: 'Connection request cancelled' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to cancel connection request' });
  }
});

export default router;
