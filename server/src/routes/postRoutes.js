import express from 'express';
import { run, get, query } from '../db.js';
import { authenticate, optionalAuth } from '../auth.js';
import { broadcast, sendToUser } from '../socket.js';
import { getFileUrl, uploadPostMedia } from '../services/upload.js';

const router = express.Router();

// Get feed topics (Student & Fresher Topics for sidebar)
router.get('/feed-topics', optionalAuth, async (req, res) => {
  try {
    const topics = await query('SELECT * FROM feed_topics WHERE enabled = 1 ORDER BY sort_order ASC, id ASC');
    res.json(topics || []);
  } catch (err) {
    console.error('Fetch feed topics error:', err);
    res.status(500).json({ error: 'Failed to fetch feed topics' });
  }
});

// Get feed posts
router.get('/posts', optionalAuth, async (req, res) => {
  const currentUserId = req.user?.id;
  const { category, tag, authorId } = req.query;

  try {
    let sql = `
      SELECT
        p.id, p.author_id, p.content, p.media_url, p.category, p.tags, p.created_at,
        u.username, u.role as author_role,
        pr.full_name as author_name, pr.headline as author_headline, pr.avatar_url as author_avatar,
        (SELECT COUNT(*) FROM post_likes pl WHERE pl.post_id = p.id) as likes_count,
        (SELECT COUNT(*) FROM post_comments pc WHERE pc.post_id = p.id) as comments_count
      FROM posts p
      JOIN users u ON p.author_id = u.id
      LEFT JOIN profiles pr ON u.id = pr.user_id
      WHERE 1=1
    `;
    const params = [];

    if (category && category !== 'All') {
      sql += ' AND p.category = ?';
      params.push(category);
    }

    if (authorId) {
      sql += ' AND p.author_id = ?';
      params.push(authorId);
    }

    if (tag && tag.trim()) {
      // Tags are stored as a JSON array of strings, e.g. ["#Fresher2026","#React"].
      // Anchor on the surrounding JSON quotes so "#Freshers" does not match "#Fresher2026".
      const t = tag.trim();
      sql += ' AND p.tags LIKE ?';
      params.push(`%"${t}"%`);
    }

    sql += ' ORDER BY p.created_at DESC LIMIT 50';

    const posts = await query(sql, params);

    // Determine if current user liked each post
    let userLikedSet = new Set();
    if (currentUserId) {
      const likes = await query('SELECT post_id FROM post_likes WHERE user_id = ?', [currentUserId]);
      userLikedSet = new Set(likes.map((l) => l.post_id));
    }

    const formattedPosts = posts.map((post) => ({
      ...post,
      tags: JSON.parse(post.tags || '[]'),
      has_liked: userLikedSet.has(post.id)
    }));

    res.json(formattedPosts);
  } catch (err) {
    console.error('Fetch posts error:', err);
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
});

// Upload post media (image or video) and return a URL usable in a post
router.post('/posts/upload-media', authenticate, uploadPostMedia, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No media file provided' });
    }
    const url = getFileUrl(req.file);
    const isVideo = req.file.mimetype.startsWith('video/');
    res.json({ success: true, media_url: url, media_type: isVideo ? 'video' : 'image' });
  } catch (err) {
    console.error('Post media upload error:', err);
    res.status(500).json({ error: err.message || 'Failed to upload media' });
  }
});

// Create new post
router.post('/posts', authenticate, async (req, res) => {
  const { content, media_url, category = 'General', tags = [] } = req.body;
  const authorId = req.user.id;

  if (!content || !content.trim()) {
    return res.status(400).json({ error: 'Post content cannot be empty' });
  }

  try {
    const result = await run(
      `INSERT INTO posts (author_id, content, media_url, category, tags, updated_at)
       VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [authorId, content.trim(), media_url || null, category, JSON.stringify(tags)]
    );

    const post = await get(
      `SELECT 
        p.id, p.author_id, p.content, p.media_url, p.category, p.tags, p.created_at,
        u.username, u.role as author_role,
        pr.full_name as author_name, pr.headline as author_headline, pr.avatar_url as author_avatar,
        0 as likes_count,
        0 as comments_count
       FROM posts p
       JOIN users u ON p.author_id = u.id
       LEFT JOIN profiles pr ON u.id = pr.user_id
       WHERE p.id = ?`,
      [result.id]
    );

    const newPost = {
      ...post,
      tags: JSON.parse(post.tags || '[]'),
      has_liked: false
    };

    broadcast({ type: 'new_post', post: newPost });
    res.status(201).json(newPost);
  } catch (err) {
    console.error('Create post error:', err);
    res.status(500).json({ error: 'Failed to create post' });
  }
});

// Toggle Like / Unlike
router.post('/posts/:id/like', authenticate, async (req, res) => {
  const postId = Number(req.params.id);
  const userId = req.user.id;

  try {
    const post = await get('SELECT * FROM posts WHERE id = ?', [postId]);
    if (!post) return res.status(404).json({ error: 'Post not found' });

    const existingLike = await get('SELECT id FROM post_likes WHERE post_id = ? AND user_id = ?', [postId, userId]);

    let liked = false;
    if (existingLike) {
      // Unlike
      await run('DELETE FROM post_likes WHERE id = ?', [existingLike.id]);
      liked = false;
    } else {
      // Like
      await run('INSERT INTO post_likes (post_id, user_id) VALUES (?, ?)', [postId, userId]);
      liked = true;

      // Create notification if liking someone else's post
      if (post.author_id !== userId) {
        const actorProfile = await get('SELECT full_name FROM profiles WHERE user_id = ?', [userId]);
        const actorName = actorProfile?.full_name || req.user.username;
        const snippet = post.content.substring(0, 40) + (post.content.length > 40 ? '...' : '');

        const notifRes = await run(
          `INSERT INTO notifications (user_id, actor_id, type, message, payload)
           VALUES (?, ?, ?, ?, ?)`,
          [
            post.author_id,
            userId,
            'like',
            `${actorName} liked your post: "${snippet}"`,
            JSON.stringify({ postId, postAuthorId: post.author_id })
          ]
        );

        sendToUser(post.author_id, {
          type: 'notification',
          notification: {
            id: notifRes.id,
            type: 'like',
            message: `${actorName} liked your post: "${snippet}"`,
            actor_id: userId,
            actor_name: actorName,
            created_at: new Date().toISOString()
          }
        });
      }
    }

    const likesCountRow = await get('SELECT COUNT(*) as count FROM post_likes WHERE post_id = ?', [postId]);
    const likesCount = likesCountRow?.count || 0;

    broadcast({
      type: 'post_liked',
      postId,
      userId,
      liked,
      likesCount
    });

    res.json({ liked, likesCount });
  } catch (err) {
    console.error('Like post error:', err);
    res.status(500).json({ error: 'Failed to update like status' });
  }
});

// Get comments for a post
router.get('/posts/:id/comments', async (req, res) => {
  const postId = Number(req.params.id);
  try {
    const comments = await query(
      `SELECT 
        c.id, c.post_id, c.user_id, c.content, c.created_at,
        u.username, u.role,
        pr.full_name as author_name, pr.headline as author_headline, pr.avatar_url as author_avatar
       FROM post_comments c
       JOIN users u ON c.user_id = u.id
       LEFT JOIN profiles pr ON u.id = pr.user_id
       WHERE c.post_id = ?
       ORDER BY c.created_at ASC`,
      [postId]
    );
    res.json(comments);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

// Add comment to post
router.post('/posts/:id/comments', authenticate, async (req, res) => {
  const postId = Number(req.params.id);
  const userId = req.user.id;
  const { content } = req.body;

  if (!content || !content.trim()) {
    return res.status(400).json({ error: 'Comment cannot be empty' });
  }

  try {
    const post = await get('SELECT * FROM posts WHERE id = ?', [postId]);
    if (!post) return res.status(404).json({ error: 'Post not found' });

    const result = await run(
      `INSERT INTO post_comments (post_id, user_id, content) VALUES (?, ?, ?)`,
      [postId, userId, content.trim()]
    );

    const comment = await get(
      `SELECT 
        c.id, c.post_id, c.user_id, c.content, c.created_at,
        u.username, u.role,
        pr.full_name as author_name, pr.headline as author_headline, pr.avatar_url as author_avatar
       FROM post_comments c
       JOIN users u ON c.user_id = u.id
       LEFT JOIN profiles pr ON u.id = pr.user_id
       WHERE c.id = ?`,
      [result.id]
    );

    // Notify post author if not author themselves
    if (post.author_id !== userId) {
      const actorName = comment.author_name || req.user.username;
      const snippet = content.substring(0, 40) + (content.length > 40 ? '...' : '');

      const notifRes = await run(
        `INSERT INTO notifications (user_id, actor_id, type, message, payload)
         VALUES (?, ?, ?, ?, ?)`,
        [
          post.author_id,
          userId,
          'comment',
          `${actorName} commented on your post: "${snippet}"`,
          JSON.stringify({ postId, commentId: comment.id })
        ]
      );

      sendToUser(post.author_id, {
        type: 'notification',
        notification: {
          id: notifRes.id,
          type: 'comment',
          message: `${actorName} commented on your post: "${snippet}"`,
          actor_id: userId,
          actor_name: actorName,
          created_at: new Date().toISOString()
        }
      });
    }

    broadcast({ type: 'new_comment', comment });
    res.status(201).json(comment);
  } catch (err) {
    console.error('Comment error:', err);
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

// Edit post
router.put('/posts/:id', authenticate, async (req, res) => {
  const postId = Number(req.params.id);
  const { content, category, tags } = req.body;
  try {
    const post = await get('SELECT author_id FROM posts WHERE id = ?', [postId]);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    if (post.author_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized to edit this post' });
    }
    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Post content cannot be empty' });
    }

    const fields = ['content = ?', 'updated_at = CURRENT_TIMESTAMP'];
    const params = [content.trim()];

    if (category) {
      fields.push('category = ?');
      params.push(category);
    }
    if (tags !== undefined) {
      fields.push('tags = ?');
      params.push(JSON.stringify(Array.isArray(tags) ? tags : []));
    }
    params.push(postId);

    await run(`UPDATE posts SET ${fields.join(', ')} WHERE id = ?`, params);

    const updated = await get(
      `SELECT p.id, p.author_id, p.content, p.media_url, p.category, p.tags, p.created_at,
              u.username, u.role as author_role,
              pr.full_name as author_name, pr.headline as author_headline, pr.avatar_url as author_avatar,
              (SELECT COUNT(*) FROM post_likes pl WHERE pl.post_id = p.id) as likes_count,
              (SELECT COUNT(*) FROM post_comments pc WHERE pc.post_id = p.id) as comments_count
       FROM posts p
       JOIN users u ON p.author_id = u.id
       LEFT JOIN profiles pr ON u.id = pr.user_id
       WHERE p.id = ?`,
      [postId]
    );

    res.json({ ...updated, tags: JSON.parse(updated.tags || '[]'), has_liked: false });
  } catch (err) {
    console.error('Edit post error:', err);
    res.status(500).json({ error: 'Failed to edit post' });
  }
});

// Delete post
router.delete('/posts/:id', authenticate, async (req, res) => {
  const postId = Number(req.params.id);
  try {
    const post = await get('SELECT author_id FROM posts WHERE id = ?', [postId]);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    if (post.author_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized to delete this post' });
    }

    await run('DELETE FROM posts WHERE id = ?', [postId]);
    broadcast({ type: 'delete_post', postId });
    res.json({ success: true, message: 'Post deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete post' });
  }
});

export default router;
