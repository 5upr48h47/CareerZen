import express from 'express';
import { run, get, query } from '../db.js';
import { authenticate, optionalAuth } from '../auth.js';
import { sendToUser } from '../socket.js';

const router = express.Router();

// List all collaboration listings
router.get('/collaborations', optionalAuth, async (req, res) => {
  const { projectType, skill } = req.query;

  try {
    // Enumerate columns instead of c.* so the shape stays predictable as the
    // table changes, and every projected column is decoded correctly.
    let sql = `
      SELECT
        c.id, c.creator_id, c.title, c.project_type, c.description, c.skills_needed,
        c.team_size, c.current_members_count, c.status, c.contact_info, c.created_at,
        u.username as creator_username,
        pr.full_name as creator_name, pr.headline as creator_headline, pr.avatar_url as creator_avatar
      FROM collaborations c
      JOIN users u ON c.creator_id = u.id
      LEFT JOIN profiles pr ON u.id = pr.user_id
      WHERE 1=1
    `;
    const params = [];

    if (projectType && projectType !== 'All') {
      sql += ' AND c.project_type = ?';
      params.push(projectType);
    }

    sql += ' ORDER BY c.created_at DESC';

    const collabs = await query(sql, params);

    const formatted = collabs.map((c) => ({
      ...c,
      skills_needed: JSON.parse(c.skills_needed || '[]')
    }));

    if (skill && skill.trim()) {
      const sTerm = skill.trim().toLowerCase();
      const filtered = formatted.filter((c) => c.skills_needed.some((sk) => sk.toLowerCase().includes(sTerm)));
      return res.json(filtered);
    }

    res.json(formatted);
  } catch (err) {
    console.error('Fetch collaborations error:', err);
    res.status(500).json({ error: 'Failed to fetch collaborations' });
  }
});

// Post a new collaboration request
router.post('/collaborations', authenticate, async (req, res) => {
  const { title, project_type = 'Hackathon', description, skills_needed = [], team_size = 3, contact_info } = req.body;
  const creatorId = req.user.id;

  if (!title || !description) {
    return res.status(400).json({ error: 'Title and description are required' });
  }

  try {
    const result = await run(
      `INSERT INTO collaborations (creator_id, title, project_type, description, skills_needed, team_size, current_members_count, status, contact_info)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?)`,
      [
        creatorId,
        title.trim(),
        project_type,
        description.trim(),
        JSON.stringify(skills_needed),
        team_size || 3,
        1,
        contact_info || `${req.user.email} / CareerZen DM`
      ]
    );

    await run(
      `INSERT INTO collaboration_members (collaboration_id, user_id, role_title, status)
       VALUES (?, ?, 'Project Lead', 'joined')`,
      [result.id, creatorId]
    );

    const newCollab = await get(
      `SELECT c.id, c.creator_id, c.title, c.project_type, c.description, c.skills_needed,
              c.team_size, c.current_members_count, c.status, c.contact_info, c.created_at,
              u.username as creator_username,
              pr.full_name as creator_name, pr.headline as creator_headline, pr.avatar_url as creator_avatar
       FROM collaborations c
       JOIN users u ON c.creator_id = u.id
       LEFT JOIN profiles pr ON u.id = pr.user_id
       WHERE c.id = ?`,
      [result.id]
    );

    res.status(201).json({
      ...newCollab,
      skills_needed: JSON.parse(newCollab.skills_needed || '[]')
    });
  } catch (err) {
    console.error('Create collaboration error:', err);
    res.status(500).json({ error: 'Failed to create collaboration request' });
  }
});

// Request to join a project team
// List the projects the current user created, with live member counts and
// pending-request counts so a creator can act on join requests.
router.get('/collaborations/my', authenticate, async (req, res) => {
  try {
    const collabs = await query(
      `SELECT
         c.id, c.creator_id, c.title, c.project_type, c.description, c.skills_needed,
         c.team_size, c.current_members_count, c.status, c.contact_info, c.created_at,
         (SELECT COUNT(*) FROM collaboration_members m
           WHERE m.collaboration_id = c.id AND m.status = 'joined') as joined_count,
         (SELECT COUNT(*) FROM collaboration_members m
           WHERE m.collaboration_id = c.id AND m.status = 'pending') as pending_count
       FROM collaborations c
       WHERE c.creator_id = ?
       ORDER BY c.created_at DESC`,
      [req.user.id]
    );

    res.json(
      collabs.map((c) => ({
        ...c,
        skills_needed: JSON.parse(c.skills_needed || '[]')
      }))
    );
  } catch (err) {
    console.error('Fetch my collaborations error:', err);
    res.status(500).json({ error: 'Failed to fetch your projects' });
  }
});

// List the team members of a project. Only the creator can see the roster,
// since it exposes who applied to join their team.
router.get('/collaborations/:id/members', authenticate, async (req, res) => {
  const collabId = Number(req.params.id);

  try {
    const collab = await get('SELECT id, creator_id, title FROM collaborations WHERE id = ?', [collabId]);
    if (!collab) return res.status(404).json({ error: 'Project not found' });
    if (collab.creator_id !== req.user.id) {
      return res.status(403).json({ error: 'Only the project owner can view the team roster' });
    }

    const members = await query(
      `SELECT
         m.id, m.user_id, m.role_title, m.status, m.created_at as joined_at,
         u.username, u.email,
         pr.full_name, pr.headline, pr.avatar_url, pr.location
       FROM collaboration_members m
       JOIN users u ON m.user_id = u.id
       LEFT JOIN profiles pr ON u.id = pr.user_id
       WHERE m.collaboration_id = ?
       ORDER BY m.created_at ASC`,
      [collabId]
    );

    res.json({ collaboration: collab, members });
  } catch (err) {
    console.error('Fetch collaboration members error:', err);
    res.status(500).json({ error: 'Failed to fetch team members' });
  }
});

// Creator accepts or removes a member from their team.
router.put('/collaborations/:id/members/:userId', authenticate, async (req, res) => {
  const collabId = Number(req.params.id);
  const memberUserId = Number(req.params.userId);
  const { action } = req.body; // 'accept' | 'reject'

  if (!['accept', 'reject'].includes(action)) {
    return res.status(400).json({ error: "Action must be 'accept' or 'reject'" });
  }

  try {
    const collab = await get('SELECT id, creator_id, title FROM collaborations WHERE id = ?', [collabId]);
    if (!collab) return res.status(404).json({ error: 'Project not found' });
    if (collab.creator_id !== req.user.id) {
      return res.status(403).json({ error: 'Only the project owner can manage the team' });
    }
    if (memberUserId === req.user.id) {
      return res.status(400).json({ error: 'You cannot change your own membership' });
    }

    const member = await get(
      'SELECT id FROM collaboration_members WHERE collaboration_id = ? AND user_id = ?',
      [collabId, memberUserId]
    );
    if (!member) return res.status(404).json({ error: 'That member is not in this project' });

    if (action === 'accept') {
      await run(
        `UPDATE collaboration_members SET status = 'joined' WHERE collaboration_id = ? AND user_id = ?`,
        [collabId, memberUserId]
      );
    } else {
      await run(
        `DELETE FROM collaboration_members WHERE collaboration_id = ? AND user_id = ?`,
        [collabId, memberUserId]
      );
      await run(
        `UPDATE collaborations SET current_members_count = MAX(0, current_members_count - 1) WHERE id = ?`,
        [collabId]
      );
    }

    // Let the applicant know the outcome either way.
    const applicantProfile = await get('SELECT full_name FROM profiles WHERE user_id = ?', [memberUserId]);
    const applicantName = applicantProfile?.full_name || 'The applicant';
    const ownerProfile = await get('SELECT full_name FROM profiles WHERE user_id = ?', [req.user.id]);
    const ownerName = ownerProfile?.full_name || req.user.username;

    const msg = action === 'accept'
      ? `${ownerName} accepted your request to join "${collab.title}"!`
      : `${ownerName} declined your request to join "${collab.title}".`;

    await run(
      `INSERT INTO notifications (user_id, actor_id, type, message, payload)
       VALUES (?, ?, 'collab_status', ?, ?)`,
      [
        memberUserId,
        req.user.id,
        msg,
        JSON.stringify({ collabId, action })
      ]
    );

    res.json({ success: true, message: action === 'accept' ? 'Member accepted' : 'Request removed' });
  } catch (err) {
    console.error('Manage collaboration member error:', err);
    res.status(500).json({ error: 'Failed to update team member' });
  }
});

router.post('/collaborations/:id/join', authenticate, async (req, res) => {
  const collabId = Number(req.params.id);
  const userId = req.user.id;
  const { message = 'I would love to join your project team!' } = req.body;

  try {
    const collab = await get('SELECT * FROM collaborations WHERE id = ?', [collabId]);
    if (!collab) return res.status(404).json({ error: 'Project not found' });
    if (collab.creator_id === userId) {
      return res.status(400).json({ error: 'You are the creator of this project' });
    }

    const existing = await get('SELECT id FROM collaboration_members WHERE collaboration_id = ? AND user_id = ?', [collabId, userId]);
    if (existing) {
      return res.status(400).json({ error: 'You have already joined or applied to this team' });
    }

    await run(
      `INSERT INTO collaboration_members (collaboration_id, user_id, role_title, status)
       VALUES (?, ?, 'Contributor', 'joined')`,
      [collabId, userId]
    );

    await run(
      `UPDATE collaborations SET current_members_count = current_members_count + 1 WHERE id = ?`,
      [collabId]
    );

    const applicantProfile = await get('SELECT full_name FROM profiles WHERE user_id = ?', [userId]);
    const applicantName = applicantProfile?.full_name || req.user.username;

    // Send real-time notification to project creator
    const notifMsg = `${applicantName} joined your project team for "${collab.title}"!`;
    const notifRes = await run(
      `INSERT INTO notifications (user_id, actor_id, type, message, payload)
       VALUES (?, ?, 'collab_join', ?, ?)`,
      [
        collab.creator_id,
        userId,
        notifMsg,
        JSON.stringify({ collabId, applicantId: userId, applicantName, message })
      ]
    );

    sendToUser(collab.creator_id, {
      type: 'notification',
      notification: {
        id: notifRes.id,
        type: 'collab_join',
        message: notifMsg,
        actor_id: userId,
        actor_name: applicantName,
        created_at: new Date().toISOString()
      }
    });

    res.json({ success: true, message: 'Successfully joined team!' });
  } catch (err) {
    console.error('Join team error:', err);
    res.status(500).json({ error: 'Failed to join collaboration' });
  }
});

export default router;
