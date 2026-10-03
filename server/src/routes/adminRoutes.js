import express from 'express';
import { authenticate } from '../auth.js';
import { requireAdmin, audit } from '../admin.js';
import { get, query, run } from '../db.js';
import { getFileUrl, uploadPaymentQr } from '../services/upload.js';

const router = express.Router();
router.use(authenticate, requireAdmin);

// ─────────────────────────────────────────────
// ADMIN: PREMIUM FEATURE MANAGEMENT
// ─────────────────────────────────────────────

router.get('/admin/premium-features', async (req, res) => {
  try {
    const features = await query(
      'SELECT * FROM premium_features ORDER BY plan, id'
    );
    res.json(features || []);
  } catch (err) {
    console.error('Fetch premium features error:', err);
    res.status(500).json({ error: 'Failed to fetch premium features' });
  }
});

// Update a single premium feature by id (key, name, description, plan, enabled)
router.put('/admin/premium-features/:id', async (req, res) => {
  const featureId = Number(req.params.id);
  if (!Number.isInteger(featureId)) return res.status(400).json({ error: 'Invalid feature id' });

  const { key, name, description, plan, enabled } = req.body;

  if (key === undefined && name === undefined && description === undefined
      && plan === undefined && enabled === undefined) {
    return res.status(400).json({ error: 'At least one field to update is required' });
  }

  try {
    const existing = await get('SELECT * FROM premium_features WHERE id = ?', [featureId]);
    if (!existing) return res.status(404).json({ error: 'Premium feature not found' });

    const updates = [];
    const values = [];
    if (key !== undefined) { updates.push('key = ?'); values.push(key); }
    if (name !== undefined) { updates.push('name = ?'); values.push(name); }
    if (description !== undefined) { updates.push('description = ?'); values.push(description); }
    if (plan !== undefined) { updates.push('plan = ?'); values.push(plan); }
    if (enabled !== undefined) { updates.push('enabled = ?'); values.push(enabled ? 1 : 0); }
    updates.push('updated_at = CURRENT_TIMESTAMP');

    await run(`UPDATE premium_features SET ${updates.join(', ')} WHERE id = ?`, [...values, featureId]);

    const updated = await get('SELECT * FROM premium_features WHERE id = ?', [featureId]);
    res.json({ success: true, feature: updated });
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE')) {
      return res.status(400).json({ error: 'Feature key already exists' });
    }
    console.error('Update premium feature error:', err);
    res.status(500).json({ error: 'Failed to update premium feature' });
  }
});

router.put('/admin/premium-features', async (req, res) => {
  const { features } = req.body;
  if (!Array.isArray(features)) {
    return res.status(400).json({ error: 'features must be an array' });
  }
  try {
    for (const f of features) {
      await run(
        `UPDATE premium_features SET name = ?, description = ?, plan = ?, enabled = ? WHERE id = ?`,
        [f.name, f.description, f.plan, f.enabled ? 1 : 0, f.id]
      );
    }
    const updated = await query('SELECT * FROM premium_features ORDER BY plan, id');
    res.json({ success: true, features: updated });
  } catch (err) {
    console.error('Update premium features error:', err);
    res.status(500).json({ error: 'Failed to update premium features' });
  }
});

router.post('/admin/premium-features', async (req, res) => {
  const { key, name, description, plan, enabled } = req.body;
  if (!key || !name || !plan) {
    return res.status(400).json({ error: 'key, name and plan are required' });
  }
  try {
    const result = await run(
      `INSERT INTO premium_features (key, name, description, plan, enabled, updated_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [key, name, description || '', plan, enabled !== false ? 1 : 0]
    );
    const created = await get('SELECT * FROM premium_features WHERE id = ?', [result.id]);
    res.status(201).json({ success: true, feature: created });
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE')) {
      return res.status(400).json({ error: 'Feature key already exists' });
    }
    console.error('Create premium feature error:', err);
    res.status(500).json({ error: 'Failed to create premium feature' });
  }
});

router.get('/admin/overview', async (req, res) => {
  try {
    const [users, activeUsers, recruiters, jobs, applications, posts, messages, kyc] = await Promise.all([
      get('SELECT COUNT(*) count FROM users'),
      get('SELECT COUNT(*) count FROM users WHERE is_active=1'),
      get("SELECT COUNT(*) count FROM users WHERE role='recruiter'"),
      get('SELECT COUNT(*) count FROM jobs'),
      get('SELECT COUNT(*) count FROM job_applications'),
      get('SELECT COUNT(*) count FROM posts'),
      get('SELECT COUNT(*) count FROM messages'),
      get('SELECT COUNT(*) count FROM users WHERE aadhaar_verified=1 OR kyc_verified_at IS NOT NULL')
    ]);
    const recent = await query(`SELECT id, username, email, role, auth_provider, is_active, created_at, last_login_at FROM users ORDER BY created_at DESC LIMIT 8`);
    res.json({ counts: { users: users.count, activeUsers: activeUsers.count, recruiters: recruiters.count, jobs: jobs.count, applications: applications.count, posts: posts.count, messages: messages.count, verifiedKyc: kyc.count }, recentUsers: recent });
  } catch (err) { res.status(500).json({ error: 'Failed to load admin overview' }); }
});

router.get('/admin/users', async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
  const offset = Math.max(Number(req.query.offset) || 0, 0);
  const search = String(req.query.search || '').trim();
  const role = String(req.query.role || '').trim();
  const clauses = []; const params = [];
  if (search) { clauses.push('(u.username LIKE ? OR u.email LIKE ? OR p.full_name LIKE ?)'); params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
  if (['job_seeker','recruiter','admin'].includes(role)) { clauses.push('u.role=?'); params.push(role); }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  try {
    const rows = await query(`SELECT u.id,u.username,u.email,u.role,u.auth_provider,u.is_active,u.phone_verified,u.email_verified,u.aadhaar_verified,u.created_at,u.last_login_at,p.full_name FROM users u LEFT JOIN profiles p ON p.user_id=u.id ${where} ORDER BY u.created_at DESC LIMIT ? OFFSET ?`, [...params, limit, offset]);
    const total = await get(`SELECT COUNT(*) count FROM users u LEFT JOIN profiles p ON p.user_id=u.id ${where}`, params);
    res.json({ users: rows, total: total.count, limit, offset });
  } catch (err) { res.status(500).json({ error: 'Failed to load users' }); }
});

router.patch('/admin/users/:id', async (req, res) => {
  const id = Number(req.params.id);
  const { role, isActive } = req.body;
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid user id' });
  if (id === req.user.id && role && role !== 'admin') return res.status(400).json({ error: 'You cannot remove your own admin role' });
  if (role && !['job_seeker','recruiter','admin'].includes(role)) return res.status(400).json({ error: 'Invalid role' });
  try {
    const existing = await get('SELECT id, role, is_active FROM users WHERE id=?', [id]);
    if (!existing) return res.status(404).json({ error: 'User not found' });
    if (role !== undefined) await run('UPDATE users SET role=? WHERE id=?', [role, id]);
    if (isActive !== undefined) await run('UPDATE users SET is_active=? WHERE id=?', [isActive ? 1 : 0, id]);
    await audit(req, 'user.update_admin_state', 'user', id, { role, isActive });
    res.json(await get('SELECT id,username,email,role,auth_provider,is_active,created_at,last_login_at FROM users WHERE id=?', [id]));
  } catch (err) { res.status(500).json({ error: 'Failed to update user' }); }
});

router.get('/admin/jobs', async (req, res) => {
  try {
    const jobs = await query(`SELECT j.id,j.title,j.status,j.location,j.created_at,c.name company,u.username recruiter FROM jobs j JOIN companies c ON c.id=j.company_id JOIN users u ON u.id=j.recruiter_id ORDER BY j.created_at DESC LIMIT 200`);
    res.json({ jobs });
  } catch (err) { res.status(500).json({ error: 'Failed to load jobs' }); }
});

router.patch('/admin/jobs/:id', async (req, res) => {
  const status = String(req.body.status || '');
  if (!['open','closed'].includes(status)) return res.status(400).json({ error: 'Invalid job status' });
  try {
    const result = await run('UPDATE jobs SET status=?, updated_at=datetime(\'now\') WHERE id=?', [status, Number(req.params.id)]);
    if (!result.changes) return res.status(404).json({ error: 'Job not found' });
    await audit(req, 'job.status_update', 'job', req.params.id, { status });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Failed to update job' }); }
});

router.get('/admin/applications', async (req, res) => {
  try {
    const applications = await query(`SELECT a.id,a.status,a.created_at,a.updated_at,j.title job_title,u.username candidate,u.email candidate_email,c.name company FROM job_applications a JOIN jobs j ON j.id=a.job_id JOIN users u ON u.id=a.candidate_id JOIN companies c ON c.id=j.company_id ORDER BY a.created_at DESC LIMIT 250`);
    res.json({ applications });
  } catch (err) { res.status(500).json({ error: 'Failed to load applications' }); }
});

// Admin: update application status directly (recruitment pipeline override)
router.patch('/admin/applications/:id', async (req, res) => {
  const id = Number(req.params.id);
  const status = String(req.body.status || '');
  const valid = ['applied', 'under_review', 'shortlisted', 'interview', 'rejected', 'hired'];
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid application id' });
  if (!valid.includes(status)) return res.status(400).json({ error: `Invalid status. Must be one of: ${valid.join(', ')}` });
  try {
    const existing = await get(
      `SELECT a.id, a.candidate_id, a.status, j.title as job_title, c.name as company_name
       FROM job_applications a
       JOIN jobs j ON j.id = a.job_id
       JOIN companies c ON c.id = j.company_id
       WHERE a.id = ?`,
      [id]
    );
    if (!existing) return res.status(404).json({ error: 'Application not found' });

    await run('UPDATE job_applications SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [status, id]);

    const statusLabels = {
      applied: 'Received', under_review: 'Under Review', shortlisted: 'Shortlisted!',
      interview: 'Interview Scheduled', rejected: 'Status Updated', hired: 'Offered / Hired!'
    };
    const notifMsg = `${existing.company_name} updated your application for "${existing.job_title}" to ${statusLabels[status] || status}.`;
    const notif = await run(
      `INSERT INTO notifications (user_id, actor_id, type, message, payload) VALUES (?, ?, 'application_status', ?, ?)`,
      [existing.candidate_id, req.user.id, notifMsg, JSON.stringify({ applicationId: id, status, jobTitle: existing.job_title, companyName: existing.company_name, updatedBy: 'admin' })]
    );
    try {
      const { sendToUser } = await import('../socket.js');
      sendToUser(existing.candidate_id, {
        type: 'notification',
        notification: { id: notif.id, type: 'application_status', message: notifMsg, actor_id: req.user.id, created_at: new Date().toISOString() }
      });
    } catch { /* socket optional */ }

    await audit(req, 'application.status_update', 'application', id, { from: existing.status, to: status });
    res.json({ success: true, id, status });
  } catch (err) {
    console.error('Admin application status error:', err);
    res.status(500).json({ error: 'Failed to update application status' });
  }
});

router.get('/admin/posts', async (req, res) => {
  try {
    const posts = await query(`SELECT p.id,p.content,p.category,p.created_at,u.username,p.author_id FROM posts p JOIN users u ON u.id=p.author_id ORDER BY p.created_at DESC LIMIT 250`);
    res.json({ posts });
  } catch (err) { res.status(500).json({ error: 'Failed to load posts' }); }
});

router.delete('/admin/posts/:id', async (req, res) => {
  try {
    const result = await run('DELETE FROM posts WHERE id=?', [Number(req.params.id)]);
    if (!result.changes) return res.status(404).json({ error: 'Post not found' });
    await audit(req, 'post.delete_admin', 'post', req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Failed to delete post' }); }
});

router.get('/admin/audit-logs', async (req, res) => {
  try {
    const logs = await query(`SELECT a.id,a.action,a.resource_type,a.resource_id,a.metadata,a.ip_address,a.created_at,u.username actor FROM audit_logs a LEFT JOIN users u ON u.id=a.actor_id ORDER BY a.created_at DESC LIMIT 300`);
    res.json({ logs });
  } catch (err) { res.status(500).json({ error: 'Failed to load audit logs' }); }
});

router.get('/admin/system', async (req, res) => {
  try {
    // The system catalog differs between SQLite and PostgreSQL.
    const listTablesSql = process.env.DB_PROVIDER === 'postgresql'
      ? `SELECT tablename AS name FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`
      : `SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`;

    const tables = await query(listTablesSql);
    const dbStats = {};
    for (const t of tables) {
      // Skip internal bookkeeping tables in either dialect.
      if (t.name.startsWith('sqlite_') || t.name === '_prisma_migrations') continue;
      const quoted = process.env.DB_PROVIDER === 'postgresql'
        ? `"${t.name.replace(/"/g, '""')}"`
        : `"${t.name.replace(/"/g, '""')}"`;
      const row = await get(`SELECT COUNT(*) count FROM ${quoted}`);
      dbStats[t.name] = row.count;
    }
    res.json({ node: process.version, environment: process.env.NODE_ENV || 'development', uptimeSeconds: Math.round(process.uptime()), database: dbStats });
  } catch (err) { res.status(500).json({ error: 'Failed to load system status' }); }
});

// ─────────────────────────────────────────────
// ADMIN: PREMIUM PACKAGES MANAGEMENT
// ─────────────────────────────────────────────

// List all job posting packages (recruiter plans)
router.get('/admin/packages', async (req, res) => {
  try {
    const packages = await query('SELECT * FROM job_packages ORDER BY price ASC');
    res.json(packages || []);
  } catch (err) {
    console.error('Fetch packages error:', err);
    res.status(500).json({ error: 'Failed to fetch packages' });
  }
});

// Create a new job posting package
router.post('/admin/packages', async (req, res) => {
  const { name, price, jobLimit, durationDays, features } = req.body;

  if (!name || price === undefined || jobLimit === undefined || durationDays === undefined || !features) {
    return res.status(400).json({ error: 'name, price, jobLimit, durationDays, and features are required' });
  }

  try {
    await run(
      'INSERT INTO job_packages (name, price, jobLimit, durationDays, features) VALUES (?, ?, ?, ?, ?)',
      [name, price, jobLimit, durationDays, JSON.stringify(features)]
    );

    // $executeRawUnsafe returns a row count, not the new id — fetch the row we just wrote.
    const packageObj = await get(
      'SELECT * FROM job_packages WHERE name = ? ORDER BY id DESC LIMIT 1',
      [name]
    );
    res.status(201).json({ success: true, package: packageObj });
  } catch (err) {
    console.error('Create package error:', err);
    res.status(500).json({ error: 'Failed to create package' });
  }
});

// Update an existing job posting package
router.put('/admin/packages/:id', async (req, res) => {
  const packageId = Number(req.params.id);
  if (!Number.isInteger(packageId)) return res.status(400).json({ error: 'Invalid package id' });

  const { name, price, jobLimit, durationDays, features } = req.body;

  if (name === undefined && price === undefined && jobLimit === undefined && durationDays === undefined && features === undefined) {
    return res.status(400).json({ error: 'At least one field to update is required' });
  }

  try {
    const packageObj = await get('SELECT * FROM job_packages WHERE id = ?', [packageId]);
    if (!packageObj) return res.status(404).json({ error: 'Package not found' });

    const updates = [];
    const values = [];

    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name);
    }
    if (price !== undefined) {
      updates.push('price = ?');
      values.push(price);
    }
    if (jobLimit !== undefined) {
      updates.push('jobLimit = ?');
      values.push(jobLimit);
    }
    if (durationDays !== undefined) {
      updates.push('durationDays = ?');
      values.push(durationDays);
    }
    if (features !== undefined) {
      updates.push('features = ?');
      values.push(JSON.stringify(features));
    }

    await run(
      `UPDATE job_packages SET ${updates.join(', ')} WHERE id = ?`,
      [...values, packageId]
    );

    const updatedPackage = await get('SELECT * FROM job_packages WHERE id = ?', [packageId]);
    res.json({ success: true, package: updatedPackage });
  } catch (err) {
    console.error('Update package error:', err);
    res.status(500).json({ error: 'Failed to update package' });
  }
});

// Delete a job posting package
router.delete('/admin/packages/:id', async (req, res) => {
  const packageId = Number(req.params.id);
  if (!Number.isInteger(packageId)) return res.status(400).json({ error: 'Invalid package id' });

  try {
    // Check if any active subscriptions use this package
    const inUse = await get(
      'SELECT COUNT(*) as count FROM user_subscriptions WHERE package_id = ? AND status = ?',
      [packageId, 'active']
    );

    if (inUse && inUse.count > 0) {
      return res.status(400).json({ error: 'Cannot delete package while it has active subscriptions' });
    }

    await run('DELETE FROM job_packages WHERE id = ?', [packageId]);
    res.json({ success: true, message: 'Package deleted successfully' });
  } catch (err) {
    console.error('Delete package error:', err);
    res.status(500).json({ error: 'Failed to delete package' });
  }
});

// ─────────────────────────────────────────────
// ADMIN: FEED TOPICS (Student & Fresher Topics)
// ─────────────────────────────────────────────

// List all feed topics
router.get('/admin/feed-topics', async (req, res) => {
  try {
    const topics = await query('SELECT * FROM feed_topics ORDER BY sort_order ASC, id ASC');
    res.json(topics || []);
  } catch (err) {
    console.error('Fetch feed topics error:', err);
    res.status(500).json({ error: 'Failed to fetch feed topics' });
  }
});

// Create a new feed topic
router.post('/admin/feed-topics', async (req, res) => {
  const { tag, label, description, color, enabled, sort_order } = req.body;

  if (!tag || !label) {
    return res.status(400).json({ error: 'tag and label are required' });
  }

  try {
    await run(
      'INSERT INTO feed_topics (tag, label, description, color, enabled, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
      [tag, label, description || null, color || 'brand', enabled !== false, sort_order || 0]
    );

    const topicObj = await get(
      'SELECT * FROM feed_topics WHERE tag = ? ORDER BY id DESC LIMIT 1',
      [tag]
    );
    res.status(201).json({ success: true, topic: topicObj });
  } catch (err) {
    console.error('Create feed topic error:', err);
    res.status(500).json({ error: 'Failed to create feed topic' });
  }
});

// Update an existing feed topic
router.put('/admin/feed-topics/:id', async (req, res) => {
  const topicId = Number(req.params.id);
  if (!Number.isInteger(topicId)) return res.status(400).json({ error: 'Invalid topic id' });

  const { tag, label, description, color, enabled, sort_order } = req.body;

  if (tag === undefined && label === undefined && description === undefined && color === undefined && enabled === undefined && sort_order === undefined) {
    return res.status(400).json({ error: 'At least one field to update is required' });
  }

  try {
    const topicObj = await get('SELECT * FROM feed_topics WHERE id = ?', [topicId]);
    if (!topicObj) return res.status(404).json({ error: 'Topic not found' });

    const updates = [];
    const values = [];

    if (tag !== undefined) {
      updates.push('tag = ?');
      values.push(tag);
    }
    if (label !== undefined) {
      updates.push('label = ?');
      values.push(label);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      values.push(description);
    }
    if (color !== undefined) {
      updates.push('color = ?');
      values.push(color);
    }
    if (enabled !== undefined) {
      updates.push('enabled = ?');
      values.push(enabled);
    }
    if (sort_order !== undefined) {
      updates.push('sort_order = ?');
      values.push(sort_order);
    }

    await run(
      `UPDATE feed_topics SET ${updates.join(', ')} WHERE id = ?`,
      [...values, topicId]
    );

    const updatedTopic = await get('SELECT * FROM feed_topics WHERE id = ?', [topicId]);
    res.json({ success: true, topic: updatedTopic });
  } catch (err) {
    console.error('Update feed topic error:', err);
    res.status(500).json({ error: 'Failed to update feed topic' });
  }
});

// Delete a feed topic
router.delete('/admin/feed-topics/:id', async (req, res) => {
  const topicId = Number(req.params.id);
  if (!Number.isInteger(topicId)) return res.status(400).json({ error: 'Invalid topic id' });

  try {
    await run('DELETE FROM feed_topics WHERE id = ?', [topicId]);
    res.json({ success: true, message: 'Feed topic deleted successfully' });
  } catch (err) {
    console.error('Delete feed topic error:', err);
    res.status(500).json({ error: 'Failed to delete feed topic' });
  }
});

// ─────────────────────────────────────────────
// ADMIN: PREMIUM PLAN PRICING & USER SUBSCRIPTIONS
// ─────────────────────────────────────────────

// Pricing for the student/job-seeker premium plans (admin-controlled)
router.get('/admin/premium-plans', async (req, res) => {
  try {
    const row = await get(`SELECT * FROM premium_plans WHERE id = 1`);
    if (row) return res.json(row);

    // Seed defaults on first access
    await run(
      `INSERT INTO premium_plans (id, premium_price, pro_price, currency, premium_duration_days, pro_duration_days, updated_at)
       VALUES (1, 299, 799, 'INR', 30, 30, CURRENT_TIMESTAMP)`
    );
    const created = await get(`SELECT * FROM premium_plans WHERE id = 1`);
    res.json(created);
  } catch (err) {
    console.error('Fetch premium plans error:', err);
    res.status(500).json({ error: 'Failed to fetch premium plan pricing' });
  }
});

// Update premium plan pricing
router.put('/admin/premium-plans', async (req, res) => {
  const {
    premium_price,
    pro_price,
    currency,
    premium_duration_days,
    pro_duration_days
  } = req.body;

  if (premium_price === undefined && pro_price === undefined && currency === undefined
      && premium_duration_days === undefined && pro_duration_days === undefined) {
    return res.status(400).json({ error: 'At least one pricing field is required' });
  }

  try {
    const existing = await get(`SELECT * FROM premium_plans WHERE id = 1`);
    if (!existing) {
      await run(
        `INSERT INTO premium_plans (id, premium_price, pro_price, currency, premium_duration_days, pro_duration_days, updated_at)
         VALUES (1, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [premium_price ?? 299, pro_price ?? 799, currency || 'INR', premium_duration_days ?? 30, pro_duration_days ?? 30]
      );
    } else {
      const updates = [];
      const values = [];
      if (premium_price !== undefined) { updates.push('premium_price = ?'); values.push(premium_price); }
      if (pro_price !== undefined) { updates.push('pro_price = ?'); values.push(pro_price); }
      if (currency !== undefined) { updates.push('currency = ?'); values.push(currency); }
      if (premium_duration_days !== undefined) { updates.push('premium_duration_days = ?'); values.push(premium_duration_days); }
      if (pro_duration_days !== undefined) { updates.push('pro_duration_days = ?'); values.push(pro_duration_days); }
      updates.push('updated_at = CURRENT_TIMESTAMP');

      await run(`UPDATE premium_plans SET ${updates.join(', ')} WHERE id = 1`, values);
    }

    const updated = await get(`SELECT * FROM premium_plans WHERE id = 1`);
    res.json({ success: true, plans: updated });
  } catch (err) {
    console.error('Update premium plans error:', err);
    res.status(500).json({ error: 'Failed to update premium plan pricing' });
  }
});

// List all premium subscriptions (recruiters + job seekers)
router.get('/admin/premium-subscriptions', async (req, res) => {
  try {
    const subscriptions = await query(
      `SELECT ss.id, ss.user_id, ss.plan, ss.status, ss.start_date, ss.end_date, ss.payment_id,
              u.username, u.email, u.role,
              pr.full_name, pr.avatar_url
       FROM student_subscriptions ss
       JOIN users u ON ss.user_id = u.id
       LEFT JOIN profiles pr ON u.id = pr.user_id
       ORDER BY ss.created_at DESC`
    );

    // Recruiter packages are tracked separately in user_subscriptions
    const recruiterSubs = await query(
      `SELECT us.id, us.user_id, us.package_id, us.status, us.start_date, us.end_date, us.payment_id,
              u.username, u.email, u.role,
              jp.name as package_name, jp.price as package_price
       FROM user_subscriptions us
       JOIN users u ON us.user_id = u.id
       LEFT JOIN job_packages jp ON us.package_id = jp.id
       ORDER BY us.created_at DESC`
    );

    res.json({ premium: subscriptions || [], recruiter: recruiterSubs || [] });
  } catch (err) {
    console.error('Fetch subscriptions error:', err);
    res.status(500).json({ error: 'Failed to fetch premium subscriptions' });
  }
});

// Grant or revoke a premium plan for a user (admin override)
router.post('/admin/premium-subscriptions/:userId', async (req, res) => {
  const userId = Number(req.params.userId);
  if (!Number.isInteger(userId)) return res.status(400).json({ error: 'Invalid user id' });

  const { plan, action } = req.body;
  if (!['premium', 'pro'].includes(plan)) {
    return res.status(400).json({ error: 'Invalid plan. Choose premium or pro.' });
  }
  if (action !== 'grant' && action !== 'revoke') {
    return res.status(400).json({ error: 'Invalid action. Choose grant or revoke.' });
  }

  try {
    const user = await get('SELECT id, username, email, role FROM users WHERE id = ?', [userId]);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (action === 'revoke') {
      await run(
        `UPDATE student_subscriptions SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND status = 'active'`,
        [userId]
      );
    } else {
      const existing = await get(
        `SELECT id FROM student_subscriptions WHERE user_id = ? AND status = 'active'`,
        [userId]
      );

      // Duration comes from the admin-configured pricing, not a hardcoded month.
      const pricing = await get(
        'SELECT premium_duration_days, pro_duration_days FROM premium_plans WHERE id = 1'
      );
      const durationDays =
        (plan === 'pro' ? pricing?.pro_duration_days : pricing?.premium_duration_days) || 30;

      const startDate = new Date();
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + Number(durationDays));

      if (existing) {
        await run(
          `UPDATE student_subscriptions SET plan = ?, status = 'active', start_date = ?, end_date = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [plan, startDate.toISOString(), endDate.toISOString(), existing.id]
        );
      } else {
        await run(
          `INSERT INTO student_subscriptions (user_id, plan, status, start_date, end_date, payment_id, updated_at) VALUES (?, ?, 'active', ?, ?, ?, CURRENT_TIMESTAMP)`,
          [userId, plan, startDate.toISOString(), endDate.toISOString(), `admin_grant_${Date.now()}`]
        );
      }

      await run(
        `INSERT INTO notifications (user_id, actor_id, type, message) VALUES (?, ?, ?, ?)`,
        [userId, req.user.id, 'premium_granted', `🎉 Premium ${plan} plan activated for your account by the platform administrator.`]
      );
    }

    const updated = await get(
      `SELECT * FROM student_subscriptions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );

    res.json({ success: true, subscription: updated, action, plan });
  } catch (err) {
    console.error('Admin premium action error:', err);
    res.status(500).json({ error: 'Failed to update premium subscription' });
  }
});

// ─────────────────────────────────────────────
// ADMIN: PAYMENT QR SETTINGS & VERIFICATION
// ─────────────────────────────────────────────

// Get the admin-managed UPI QR + payee details
router.get('/admin/payment-settings', async (req, res) => {
  try {
    const settings = await get('SELECT * FROM payment_settings WHERE id = 1');
    res.json(
      settings || {
        id: 1,
        qr_image_url: '',
        upi_id: '',
        payee_name: 'CareerZen Premium',
        instructions: '',
        updated_at: null
      }
    );
  } catch (err) {
    console.error('Fetch payment settings error:', err);
    res.status(500).json({ error: 'Failed to fetch payment settings' });
  }
});

// Upload the UPI QR image and update payee details
router.post(
  '/admin/payment-settings',
  authenticate,
  uploadPaymentQr,
  async (req, res) => {
    try {
      const { upi_id, payee_name, instructions } = req.body;
      const qrUrl = req.file ? getFileUrl(req.file) : null;

      const existing = await get('SELECT * FROM payment_settings WHERE id = 1');

      if (existing) {
        await run(
          `UPDATE payment_settings SET
            qr_image_url = COALESCE(?, qr_image_url),
            upi_id = COALESCE(?, upi_id),
            payee_name = COALESCE(?, payee_name),
            instructions = COALESCE(?, instructions),
            updated_at = CURRENT_TIMESTAMP
           WHERE id = 1`,
          [qrUrl, upi_id, payee_name, instructions]
        );
      } else {
        await run(
          `INSERT INTO payment_settings (id, qr_image_url, upi_id, payee_name, instructions, updated_at)
           VALUES (1, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
          [qrUrl || '', upi_id || '', payee_name || 'CareerZen Premium', instructions || '']
        );
      }

      const settings = await get('SELECT * FROM payment_settings WHERE id = 1');
      res.json({ success: true, settings });
    } catch (err) {
      console.error('Update payment settings error:', err);
      res.status(500).json({ error: err.message || 'Failed to update payment settings' });
    }
  }
);

// List premium payment requests awaiting verification
router.get('/admin/payment-requests', async (req, res) => {
  try {
    const requests = await query(
      `SELECT ss.id, ss.user_id, ss.plan, ss.payment_status, ss.payment_reference,
              ss.payment_proof_url, ss.submitted_at, ss.created_at,
              u.username, u.email, u.role,
              pr.full_name, pr.avatar_url
       FROM student_subscriptions ss
       JOIN users u ON ss.user_id = u.id
       LEFT JOIN profiles pr ON u.id = pr.user_id
       WHERE ss.payment_status IN ('pending', 'submitted')
       ORDER BY ss.created_at DESC`
    );
    res.json(requests || []);
  } catch (err) {
    console.error('Fetch payment requests error:', err);
    res.status(500).json({ error: 'Failed to fetch payment requests' });
  }
});

// Approve or reject a premium payment request.
// Approving activates the subscription, sets the validity window from the
// admin-configured duration, and notifies the user.
router.post('/admin/payment-requests/:id/verify', async (req, res) => {
  const subId = Number(req.params.id);
  if (!Number.isInteger(subId)) return res.status(400).json({ error: 'Invalid subscription id' });

  const { action } = req.body;
  if (!['approve', 'reject'].includes(action)) {
    return res.status(400).json({ error: 'Invalid action. Choose approve or reject.' });
  }

  try {
    const sub = await get('SELECT * FROM student_subscriptions WHERE id = ?', [subId]);
    if (!sub) return res.status(404).json({ error: 'Payment request not found' });

    if (action === 'reject') {
      await run(
        `UPDATE student_subscriptions
         SET payment_status = 'rejected', status = 'cancelled', updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [subId]
      );

      await run(
        `INSERT INTO notifications (user_id, actor_id, type, message)
         VALUES (?, ?, ?, ?)`,
        [
          sub.user_id,
          req.user.id,
          'premium_rejected',
          `❌ Your ${sub.plan} payment could not be verified. Please check the reference and resubmit.`
        ]
      );

      const updated = await get('SELECT * FROM student_subscriptions WHERE id = ?', [subId]);
      return res.json({ success: true, subscription: updated, action });
    }

    // Approve — activate using the admin-configured duration for that plan
    const pricing = await get('SELECT * FROM premium_plans WHERE id = 1');
    const durationDays =
      sub.plan === 'pro' ? pricing?.pro_duration_days || 30 : pricing?.premium_duration_days || 30;

    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + Number(durationDays));

    await run(
      `UPDATE student_subscriptions
       SET status = 'active',
           payment_status = 'approved',
           start_date = ?,
           end_date = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [startDate.toISOString(), endDate.toISOString(), subId]
    );

    await run(
      `INSERT INTO notifications (user_id, actor_id, type, message)
       VALUES (?, ?, ?, ?)`,
      [
        sub.user_id,
        req.user.id,
        'premium_activated',
        `🎉 Payment verified! Your ${sub.plan} plan is now active until ${endDate.toLocaleDateString()}.`
      ]
    );

    const updated = await get('SELECT * FROM student_subscriptions WHERE id = ?', [subId]);
    res.json({ success: true, subscription: updated, action, end_date: endDate.toISOString() });
  } catch (err) {
    console.error('Verify payment error:', err);
    res.status(500).json({ error: 'Failed to verify payment' });
  }
});

export default router;
