import express from 'express';
import { run, get, query } from '../db.js';
import { authenticate, optionalAuth } from '../auth.js';
import { uploadAvatar, uploadBanner, uploadAny, getFileUrl } from '../services/upload.js';

const router = express.Router();

// Get profile of any user by ID or username
router.get('/users/:idOrUsername', optionalAuth, async (req, res) => {
  const { idOrUsername } = req.params;
  const currentUserId = req.user?.id;

  try {
    let user;
    if (!isNaN(idOrUsername)) {
      user = await get('SELECT id, username, email, role, created_at FROM users WHERE id = ?', [Number(idOrUsername)]);
    } else {
      user = await get('SELECT id, username, email, role, created_at FROM users WHERE username = ?', [idOrUsername]);
    }

    if (!user) return res.status(404).json({ error: 'User not found' });

    const profile = await get('SELECT * FROM profiles WHERE user_id = ?', [user.id]);
    const skills = await query('SELECT * FROM skills WHERE user_id = ? ORDER BY id ASC', [user.id]);
    const postsCount = await get('SELECT COUNT(*) as count FROM posts WHERE author_id = ?', [user.id]);
    const connectionsCount = await get(
      `SELECT COUNT(*) as count FROM connections 
       WHERE (sender_id = ? OR receiver_id = ?) AND status = 'accepted'`,
      [user.id, user.id]
    );

    let connectionStatus = 'none'; // 'none', 'self', 'pending_sent', 'pending_received', 'connected'
    if (currentUserId) {
      if (currentUserId === user.id) {
        connectionStatus = 'self';
      } else {
        const conn = await get(
          `SELECT sender_id, receiver_id, status FROM connections 
           WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)`,
          [currentUserId, user.id, user.id, currentUserId]
        );
        if (conn) {
          if (conn.status === 'accepted') {
            connectionStatus = 'connected';
          } else if (conn.status === 'pending') {
            connectionStatus = conn.sender_id === currentUserId ? 'pending_sent' : 'pending_received';
          }
        }
      }
    }

    let company = null;
    if (user.role === 'recruiter') {
      company = await get('SELECT * FROM companies WHERE recruiter_id = ?', [user.id]);
    }

    res.json({
      ...user,
      profile: profile ? {
        ...profile,
        education: JSON.parse(profile.education || '[]'),
        experience: JSON.parse(profile.experience || '[]'),
        projects: JSON.parse(profile.projects || '[]'),
        social_links: JSON.parse(profile.social_links || '{}')
      } : null,
      skills,
      company,
      stats: {
        postsCount: postsCount?.count || 0,
        connectionsCount: connectionsCount?.count || 0
      },
      connectionStatus
    });
  } catch (err) {
    console.error('Fetch profile error:', err);
    res.status(500).json({ error: 'Failed to retrieve profile' });
  }
});

// Update own profile
router.put('/profile', authenticate, async (req, res) => {
  const userId = req.user.id;
  const {
    full_name,
    headline,
    bio,
    location,
    target_role,
    avatar_url,
    banner_url,
    education,
    experience,
    projects,
    social_links
  } = req.body;

  try {
    const existing = await get('SELECT id FROM profiles WHERE user_id = ?', [userId]);

    if (!existing) {
      await run(
        `INSERT INTO profiles (user_id, full_name, headline, bio, location, target_role, avatar_url, banner_url, education, experience, projects, social_links, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [
          userId,
          full_name || req.user.username,
          headline || '',
          bio || '',
          location || '',
          target_role || '',
          avatar_url || '',
          banner_url || '',
          JSON.stringify(education || []),
          JSON.stringify(experience || []),
          JSON.stringify(projects || []),
          JSON.stringify(social_links || {})
        ]
      );
    } else {
      await run(
        `UPDATE profiles SET
          full_name = COALESCE(?, full_name),
          headline = COALESCE(?, headline),
          bio = COALESCE(?, bio),
          location = COALESCE(?, location),
          target_role = COALESCE(?, target_role),
          avatar_url = COALESCE(?, avatar_url),
          banner_url = COALESCE(?, banner_url),
          education = COALESCE(?, education),
          experience = COALESCE(?, experience),
          projects = COALESCE(?, projects),
          social_links = COALESCE(?, social_links),
          updated_at = CURRENT_TIMESTAMP
         WHERE user_id = ?`,
        [
          full_name,
          headline,
          bio,
          location,
          target_role,
          avatar_url,
          banner_url,
          education !== undefined ? JSON.stringify(education) : null,
          experience !== undefined ? JSON.stringify(experience) : null,
          projects !== undefined ? JSON.stringify(projects) : null,
          social_links !== undefined ? JSON.stringify(social_links) : null,
          userId
        ]
      );
    }

    const updatedProfile = await get('SELECT * FROM profiles WHERE user_id = ?', [userId]);
    res.json({
      success: true,
      profile: {
        ...updatedProfile,
        education: JSON.parse(updatedProfile.education || '[]'),
        experience: JSON.parse(updatedProfile.experience || '[]'),
        projects: JSON.parse(updatedProfile.projects || '[]'),
        social_links: JSON.parse(updatedProfile.social_links || '{}')
      }
    });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// ─────────────────────────────────────────────
// Profile image upload endpoints
// ─────────────────────────────────────────────
router.post('/upload/avatar', authenticate, uploadAvatar, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No avatar file provided' });
    }
    const url = getFileUrl(req.file);
    const userId = req.user.id;

    // Update profile with new avatar URL
    const existing = await get('SELECT id FROM profiles WHERE user_id = ?', [userId]);
    if (existing) {
      await run('UPDATE profiles SET avatar_url = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?', [url, userId]);
    } else {
      // full_name is NOT NULL — seed it from the user's identity so the
      // profile row can be created without a separate profile-setup step.
      await run(
        'INSERT INTO profiles (user_id, full_name, avatar_url, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)',
        [userId, req.user.full_name || req.user.username, url]
      );
    }

    res.json({ success: true, avatar_url: url });
  } catch (err) {
    console.error('Avatar upload error:', err);
    res.status(500).json({ error: err.message || 'Failed to upload avatar' });
  }
});

router.post('/upload/banner', authenticate, uploadBanner, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No banner file provided' });
    }
    const url = getFileUrl(req.file);
    const userId = req.user.id;

    // Update profile with new banner URL
    const existing = await get('SELECT id FROM profiles WHERE user_id = ?', [userId]);
    if (existing) {
      await run('UPDATE profiles SET banner_url = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?', [url, userId]);
    } else {
      await run(
        'INSERT INTO profiles (user_id, full_name, banner_url, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)',
        [userId, req.user.full_name || req.user.username, url]
      );
    }

    res.json({ success: true, banner_url: url });
  } catch (err) {
    console.error('Banner upload error:', err);
    res.status(500).json({ error: err.message || 'Failed to upload banner' });
  }
});

// Add a skill
router.post('/skills', authenticate, async (req, res) => {
  const { name, category = 'General', proficiency = 'Intermediate' } = req.body;
  if (!name) return res.status(400).json({ error: 'Skill name is required' });

  try {
    const existing = await get('SELECT id FROM skills WHERE user_id = ? AND LOWER(name) = LOWER(?)', [req.user.id, name.trim()]);
    if (existing) {
      return res.status(400).json({ error: 'Skill already added' });
    }

    const result = await run(
      'INSERT INTO skills (user_id, name, category, proficiency) VALUES (?, ?, ?, ?)',
      [req.user.id, name.trim(), category, proficiency]
    );

    const newSkill = await get('SELECT * FROM skills WHERE id = ?', [result.id]);
    res.status(201).json(newSkill);
  } catch (err) {
    console.error('Add skill error:', err);
    res.status(500).json({ error: 'Failed to add skill' });
  }
});

// Delete a skill
router.delete('/skills/:id', authenticate, async (req, res) => {
  const { id } = req.params;
  try {
    await run('DELETE FROM skills WHERE id = ? AND user_id = ?', [id, req.user.id]);
    res.json({ success: true, message: 'Skill deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete skill' });
  }
});

export default router;
