import express from 'express';
import { run, get, query } from '../db.js';
import { authenticate } from '../auth.js';
import { sendToUser } from '../socket.js';

const router = express.Router();

// Helper to get or create conversation between 2 users
async function getOrCreateConversation(userA, userB) {
  const [u1, u2] = userA < userB ? [userA, userB] : [userB, userA];
  let conv = await get('SELECT * FROM conversations WHERE user1_id = ? AND user2_id = ?', [u1, u2]);
  if (!conv) {
    const res = await run('INSERT INTO conversations (user1_id, user2_id) VALUES (?, ?)', [u1, u2]);
    conv = await get('SELECT * FROM conversations WHERE id = ?', [res.id]);
  }
  return conv;
}

// Get all conversations for current user
router.get('/conversations', authenticate, async (req, res) => {
  const userId = req.user.id;

  try {
    const conversations = await query(
      `SELECT 
        c.id, c.last_message_at,
        CASE WHEN c.user1_id = ? THEN c.user2_id ELSE c.user1_id END as other_user_id,
        u.username as other_username, u.role as other_role,
        pr.full_name as other_name, pr.headline as other_headline, pr.avatar_url as other_avatar,
        (SELECT m.content FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) as last_message,
        (SELECT m.created_at FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) as last_message_time,
        (SELECT m.sender_id FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) as last_sender_id,
        (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id AND m.receiver_id = ? AND m.is_read = 0) as unread_count
       FROM conversations c
       JOIN users u ON u.id = (CASE WHEN c.user1_id = ? THEN c.user2_id ELSE c.user1_id END)
       LEFT JOIN profiles pr ON pr.user_id = u.id
       WHERE c.user1_id = ? OR c.user2_id = ?
       ORDER BY c.last_message_at DESC`,
      [userId, userId, userId, userId, userId]
    );

    res.json(conversations);
  } catch (err) {
    console.error('Fetch conversations error:', err);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

// Get message history with another user
router.get('/conversations/:otherUserId/messages', authenticate, async (req, res) => {
  const userId = req.user.id;
  const otherUserId = Number(req.params.otherUserId);

  if (!otherUserId || otherUserId === userId) {
    return res.status(400).json({ error: 'Invalid user ID' });
  }

  try {
    const conv = await getOrCreateConversation(userId, otherUserId);
    
    // Mark unread messages sent to current user as read
    await run('UPDATE messages SET is_read = 1 WHERE conversation_id = ? AND receiver_id = ? AND is_read = 0', [conv.id, userId]);

    const messages = await query(
      `SELECT 
        m.id, m.conversation_id, m.sender_id, m.receiver_id, m.content, m.is_read, m.created_at,
        u.username as sender_username,
        pr.full_name as sender_name, pr.avatar_url as sender_avatar
       FROM messages m
       JOIN users u ON m.sender_id = u.id
       LEFT JOIN profiles pr ON u.id = pr.user_id
       WHERE m.conversation_id = ?
       ORDER BY m.created_at ASC`,
      [conv.id]
    );

    const otherUser = await get(
      `SELECT u.id, u.username, u.role, pr.full_name, pr.headline, pr.avatar_url, pr.location
       FROM users u 
       LEFT JOIN profiles pr ON u.id = pr.user_id 
       WHERE u.id = ?`,
      [otherUserId]
    );

    res.json({
      conversationId: conv.id,
      otherUser,
      messages
    });
  } catch (err) {
    console.error('Fetch messages error:', err);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Send message
router.post('/messages', authenticate, async (req, res) => {
  const senderId = req.user.id;
  const { receiverId, content } = req.body;

  if (!receiverId || !content || !content.trim()) {
    return res.status(400).json({ error: 'Receiver ID and content are required' });
  }

  const rId = Number(receiverId);
  if (rId === senderId) {
    return res.status(400).json({ error: 'Cannot send messages to yourself' });
  }

  try {
    const conv = await getOrCreateConversation(senderId, rId);

    const result = await run(
      `INSERT INTO messages (conversation_id, sender_id, receiver_id, content)
       VALUES (?, ?, ?, ?)`,
      [conv.id, senderId, rId, content.trim()]
    );

    await run('UPDATE conversations SET last_message_at = CURRENT_TIMESTAMP WHERE id = ?', [conv.id]);

    const message = await get(
      `SELECT 
        m.id, m.conversation_id, m.sender_id, m.receiver_id, m.content, m.is_read, m.created_at,
        u.username as sender_username,
        pr.full_name as sender_name, pr.avatar_url as sender_avatar
       FROM messages m
       JOIN users u ON m.sender_id = u.id
       LEFT JOIN profiles pr ON u.id = pr.user_id
       WHERE m.id = ?`,
      [result.id]
    );

    const senderProfile = await get('SELECT full_name FROM profiles WHERE user_id = ?', [senderId]);
    const senderName = senderProfile?.full_name || req.user.username;

    // Send real-time notification & message payload to receiver
    sendToUser(rId, {
      type: 'new_message',
      message
    });

    sendToUser(rId, {
      type: 'notification',
      notification: {
        id: Date.now(),
        type: 'new_message',
        message: `New message from ${senderName}: "${content.substring(0, 30)}${content.length > 30 ? '...' : ''}"`,
        actor_id: senderId,
        actor_name: senderName,
        created_at: new Date().toISOString()
      }
    });

    res.status(201).json(message);
  } catch (err) {
    console.error('Send message error:', err);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

export default router;
