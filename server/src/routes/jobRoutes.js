import express from 'express';
import { run, get, query } from '../db.js';
import { authenticate, optionalAuth } from '../auth.js';
import { broadcast } from '../socket.js';
import { logger } from '../logger.js';
import { getFileUrl, uploadCompanyLogo } from '../services/upload.js';

const router = express.Router();

import searchService from '../search/index.js';

// List all jobs with search and multi-filtering
router.get('/jobs', optionalAuth, async (req, res) => {
  const currentUserId = req.user?.id;

  try {
    const searchResults = await searchService.searchJobs(req.query);
    const jobs = searchResults.hits.map((hit) => (hit && hit.document) ? hit.document : hit);

    // Check application status for current logged-in user
    let userApplicationsMap = new Map();
    if (currentUserId) {
      const userApps = await query('SELECT job_id, status, created_at FROM job_applications WHERE candidate_id = ?', [currentUserId]);
      for (const app of userApps) {
        userApplicationsMap.set(app.job_id, app);
      }
    }

    let candidateSkills = [];
    if (currentUserId) {
      const s = await query('SELECT name FROM skills WHERE user_id = ?', [currentUserId]);
      candidateSkills = s.map((sk) => sk.name.toLowerCase());
    }

    const formattedJobs = jobs.map((job) => {
      const requiredSkills = job.required_skills || [];

      // Calculate skill match score
      let matchCount = 0;
      if (candidateSkills.length > 0 && requiredSkills.length > 0) {
        matchCount = requiredSkills.filter((sk) => candidateSkills.includes(sk.toLowerCase())).length;
      }
      const matchScore = requiredSkills.length > 0 ? Math.round((matchCount / requiredSkills.length) * 100) : 100;

      const userApp = userApplicationsMap.get(job.id);

      return {
        ...job,
        required_skills: requiredSkills,
        has_applied: !!userApp,
        application_status: userApp ? userApp.status : null,
        skill_match_percentage: matchScore,
        matched_skills_count: matchCount
      };
    });

    // Premium jobs surface first so they get processed faster
    formattedJobs.sort((a, b) => {
      const ap = a.premium_required ? 1 : 0;
      const bp = b.premium_required ? 1 : 0;
      if (ap !== bp) return bp - ap;
      return 0;
    });

    res.json(formattedJobs);
  } catch (err) {
    logger.error({ err }, 'Fetch jobs error');
    res.status(500).json({ error: 'Search failed, please try again' });
  }
});

// Get single job details
router.get('/jobs/:id', optionalAuth, async (req, res) => {
  const jobId = Number(req.params.id);
  const currentUserId = req.user?.id;

  try {
    const job = await get(
      `SELECT 
        j.id, j.company_id, j.recruiter_id, j.title, j.description, j.requirements, j.location,
        j.workplace_type, j.job_type, j.experience_level, j.salary_range, j.required_skills,
        j.status, j.created_at,
        c.name as company_name, c.tagline as company_tagline, c.description as company_description,
        c.website as company_website, c.logo_url as company_logo, c.industry as company_industry,
        c.company_size, c.location as company_location,
        u.username as recruiter_username,
        pr.full_name as recruiter_name, pr.headline as recruiter_headline, pr.avatar_url as recruiter_avatar,
        (SELECT COUNT(*) FROM job_applications ja WHERE ja.job_id = j.id) as applicants_count
       FROM jobs j
       JOIN companies c ON j.company_id = c.id
       JOIN users u ON j.recruiter_id = u.id
       LEFT JOIN profiles pr ON u.id = pr.user_id
       WHERE j.id = ?`,
      [jobId]
    );

    if (!job) return res.status(404).json({ error: 'Job not found' });

    let application = null;
    if (currentUserId) {
      application = await get('SELECT * FROM job_applications WHERE job_id = ? AND candidate_id = ?', [jobId, currentUserId]);
    }

    res.json({
      ...job,
      required_skills: JSON.parse(job.required_skills || '[]'),
      has_applied: !!application,
      application
    });
  } catch (err) {
    console.error('Fetch job detail error:', err);
    res.status(500).json({ error: 'Failed to fetch job details' });
  }
});

// Post a new job (Recruiter)
router.post('/jobs', authenticate, async (req, res) => {
  if (req.user.role !== 'recruiter' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Only recruiters can post jobs' });
  }

  const {
    title,
    description,
    requirements,
    location = 'Remote',
    workplace_type = 'Remote',
    job_type = 'Full-time',
    experience_level = 'Fresher',
    salary_range,
    required_skills = [],
    featured = false,
    premium = false
  } = req.body;

  if (!title || !description) {
    return res.status(400).json({ error: 'Title and description are required' });
  }

  try {
    // Check job posting limit from active subscription
    const subscription = await get(
      `SELECT s.*, p.name as package_name, p.jobLimit as job_limit, p.durationDays as duration_days
       FROM user_subscriptions s
       JOIN job_packages p ON s.package_id = p.id
       WHERE s.user_id = ? AND s.status = 'active' AND s.end_date > CURRENT_TIMESTAMP
       ORDER BY s.created_at DESC LIMIT 1`,
      [req.user.id]
    );

    if (subscription) {
      const currentJobCount = await get(
        'SELECT COUNT(*) as count FROM jobs WHERE recruiter_id = ? AND status = ?',
        [req.user.id, 'open']
      );
      const jobCount = currentJobCount?.count || 0;
      const jobLimit = subscription.job_limit;

      if (jobLimit !== -1 && jobCount >= jobLimit) {
        return res.status(400).json({
          error: `Job posting limit reached. Your ${subscription.package_name} package allows ${jobLimit} active job postings. Please upgrade your package.`,
          subscription: { package: subscription.package_name, limit: jobLimit, current: jobCount }
        });
      }
    }

    let company = await get('SELECT id FROM companies WHERE recruiter_id = ?', [req.user.id]);
    if (!company) {
      const compRes = await run(
        `INSERT INTO companies (recruiter_id, name, tagline, description, location)
         VALUES (?, ?, ?, ?, ?)`,
        [
          req.user.id,
          `${req.user.full_name || req.user.username}'s Company`,
          'Exciting innovative team hiring fresh talent',
          'Empowering students and junior engineers to build great products.',
          location
        ]
      );
      company = { id: compRes.id };
    }

    const isAdmin = req.user.role === 'admin';
    // Premium posting requires an active recruiter package; admins always qualify
    let premiumEnabled = false;
    if (premium) {
      if (isAdmin || subscription) {
        premiumEnabled = true;
      } else {
        return res.status(400).json({
          error: 'Premium job posting requires an active recruiter package. Please upgrade your package to post a premium job.',
          requiresPackage: true
        });
      }
    }

    const result = await run(
      `INSERT INTO jobs (company_id, recruiter_id, title, description, requirements, location, workplace_type, job_type, experience_level, salary_range, required_skills, status, premium_required, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, CURRENT_TIMESTAMP)`,
      [
        company.id,
        req.user.id,
        title.trim(),
        description.trim(),
        requirements || '',
        location.trim(),
        workplace_type,
        job_type,
        experience_level,
        salary_range || 'Competitive / Market Standard',
        JSON.stringify(required_skills),
        premiumEnabled ? 1 : 0
      ]
    );

    const newJob = await get('SELECT * FROM jobs WHERE id = ?', [result.id]);

    // Track job posting in payment record
    if (subscription) {
      await run(
        `UPDATE payments SET job_postings_created = job_postings_created + 1 WHERE payment_intent_id = ?`,
        [subscription.payment_id || '']
      );
    }

    // Create a feed post automatically for the new job
    const postRes = await run(
      `INSERT INTO posts (author_id, content, category, tags, updated_at) VALUES (?, ?, 'Hiring', ?, CURRENT_TIMESTAMP)`,
      [
        req.user.id,
        `🚀 **We're Hiring!** We just posted a new opportunity: **${title}** (${experience_level} • ${workplace_type}). Check out the full requirements and apply directly in the Jobs tab!`,
        JSON.stringify(['#Hiring', `#${title.replace(/\s+/g, '')}`, '#Jobs', '#Freshers'])
      ]
    );

    // If featured, create featured job record
    if (featured) {
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 30);
      await run(
        `INSERT INTO featured_jobs (job_id, user_id, start_date, end_date) VALUES (?, ?, ?, ?)`,
        [result.id, req.user.id, new Date().toISOString(), endDate.toISOString()]
      );
    }

    broadcast({
      type: 'new_job',
      job: {
        ...newJob,
        required_skills: JSON.parse(newJob.required_skills || '[]'),
        featured: !!featured
      }
    });

    res.status(201).json({
      success: true,
      job: {
        ...newJob,
        required_skills: JSON.parse(newJob.required_skills || '[]'),
        featured: !!featured
      }
    });
  } catch (err) {
    console.error('Post job error:', err);
    res.status(500).json({ error: 'Failed to post job' });
  }
});

// Upload a company logo image and attach it to the company profile
router.post(
  '/companies/upload-logo',
  authenticate,
  uploadCompanyLogo,
  async (req, res) => {
    if (req.user.role !== 'recruiter' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only recruiters can upload a company logo' });
    }

    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No logo file provided' });
      }

      const url = getFileUrl(req.file);
      const existing = await get('SELECT id FROM companies WHERE recruiter_id = ?', [req.user.id]);

      if (existing) {
        await run('UPDATE companies SET logo_url = ? WHERE id = ?', [url, existing.id]);
      } else {
        await run(
          `INSERT INTO companies (recruiter_id, name, logo_url, tagline, description, location)
           VALUES (?, ?, ?, '', '', '')`,
          [
            req.user.id,
            `${req.user.full_name || req.user.username}'s Company`,
            url
          ]
        );
      }

      res.json({ success: true, logo_url: url });
    } catch (err) {
      console.error('Company logo upload error:', err);
      res.status(500).json({ error: err.message || 'Failed to upload company logo' });
    }
  }
);

// Company profile: Create or update
router.post('/companies', authenticate, async (req, res) => {
  if (req.user.role !== 'recruiter' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Only recruiters can manage company profiles' });
  }

  const { name, tagline, description, website, logo_url, location, industry, company_size } = req.body;

  try {
    const existing = await get('SELECT id FROM companies WHERE recruiter_id = ?', [req.user.id]);
    if (existing) {
      await run(
        `UPDATE companies SET
          name = COALESCE(?, name),
          tagline = COALESCE(?, tagline),
          description = COALESCE(?, description),
          website = COALESCE(?, website),
          logo_url = COALESCE(?, logo_url),
          location = COALESCE(?, location),
          industry = COALESCE(?, industry),
          company_size = COALESCE(?, company_size)
         WHERE id = ?`,
        [name, tagline, description, website, logo_url, location, industry, company_size, existing.id]
      );
    } else {
      await run(
        `INSERT INTO companies (recruiter_id, name, tagline, description, website, logo_url, location, industry, company_size)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [req.user.id, name || 'My Company', tagline, description, website, logo_url, location, industry, company_size]
      );
    }

    const company = await get('SELECT * FROM companies WHERE recruiter_id = ?', [req.user.id]);
    res.json({ success: true, company });
  } catch (err) {
    console.error('Company update error:', err);
    res.status(500).json({ error: 'Failed to save company info' });
  }
});

// Recruiter Dashboard Overview
router.get('/recruiter/dashboard', authenticate, async (req, res) => {
  if (req.user.role !== 'recruiter' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access restricted to recruiters' });
  }

  try {
    const company = await get('SELECT * FROM companies WHERE recruiter_id = ?', [req.user.id]);
    const jobs = await query(
      `SELECT
        j.*,
        (SELECT COUNT(*) FROM job_applications ja WHERE ja.job_id = j.id) as total_applicants,
        (SELECT COUNT(*) FROM job_applications ja WHERE ja.job_id = j.id AND ja.status = 'applied') as new_applicants,
        (SELECT COUNT(*) FROM job_applications ja WHERE ja.job_id = j.id AND ja.status = 'shortlisted') as shortlisted_count,
        (SELECT COUNT(*) FROM job_applications ja WHERE ja.job_id = j.id AND ja.status = 'hired') as hired_count
       FROM jobs j
       WHERE j.recruiter_id = ?
       ORDER BY j.created_at DESC`,
      [req.user.id]
    );

    // Get subscription info
    const subscription = await get(
      `SELECT s.*, p.name as package_name, p.price, p.jobLimit as job_limit, p.durationDays as duration_days,
              (SELECT COUNT(*) FROM jobs WHERE recruiter_id = ? AND status = 'open') as active_jobs
       FROM user_subscriptions s
       JOIN job_packages p ON s.package_id = p.id
       WHERE s.user_id = ? AND s.status = 'active' AND s.end_date > CURRENT_TIMESTAMP
       ORDER BY s.created_at DESC LIMIT 1`,
      [req.user.id, req.user.id]
    );

    // Get application analytics
    const totalApplications = await get(
      `SELECT COUNT(*) as count FROM job_applications ja
       JOIN jobs j ON ja.job_id = j.id
       WHERE j.recruiter_id = ?`,
      [req.user.id]
    );

    const statusBreakdown = await query(
      `SELECT ja.status, COUNT(*) as count
       FROM job_applications ja
       JOIN jobs j ON ja.job_id = j.id
       WHERE j.recruiter_id = ?
       GROUP BY ja.status`,
      [req.user.id]
    );

    // Get recent activity
    const recentApplications = await query(
      `SELECT ja.*, j.title as job_title, u.username as candidate_username, u.email as candidate_email, pr.full_name as candidate_name
       FROM job_applications ja
       JOIN jobs j ON ja.job_id = j.id
       JOIN users u ON ja.candidate_id = u.id
       LEFT JOIN profiles pr ON u.id = pr.user_id
       WHERE j.recruiter_id = ?
       ORDER BY ja.created_at DESC
       LIMIT 10`,
      [req.user.id]
    );

    const formattedJobs = jobs.map((job) => ({
      ...job,
      required_skills: JSON.parse(job.required_skills || '[]')
    }));

    res.json({
      company,
      subscription,
      jobs: formattedJobs,
      totalJobs: jobs.length,
      activeJobs: subscription?.active_jobs || 0,
      totalApplicants: totalApplications?.count || 0,
      statusBreakdown,
      recentApplications,
      packageLimit: subscription?.job_limit || 0,
      packageUsed: subscription?.active_jobs || 0
    });
  } catch (err) {
    console.error('Recruiter dashboard error:', err);
    res.status(500).json({ error: 'Failed to load recruiter dashboard' });
  }
});

// ─────────────────────────────────────────────
// PREMIUM JOB POSTING & APPLICATION ESCALATION
// ─────────────────────────────────────────────

// Mark a job as a premium (featured) posting — visible at the top of the hub.
router.post('/jobs/:id/premium', authenticate, async (req, res) => {
  const jobId = Number(req.params.id);
  if (!Number.isInteger(jobId)) return res.status(400).json({ error: 'Invalid job id' });

  try {
    const job = await get('SELECT * FROM jobs WHERE id = ?', [jobId]);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    if (job.recruiter_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not allowed to modify this job' });
    }

    await run(
      'UPDATE jobs SET premium_required = 1, status = ? WHERE id = ?',
      ['open', jobId]
    );

    const updated = await get('SELECT * FROM jobs WHERE id = ?', [jobId]);
    res.json({ success: true, job: updated });
  } catch (err) {
    console.error('Premium job flag error:', err);
    res.status(500).json({ error: 'Failed to mark job as premium' });
  }
});

// Escalate an application to the top of the recruiter queue (faster processing).
router.post('/applications/:id/escalate', authenticate, async (req, res) => {
  const appId = Number(req.params.id);
  if (!Number.isInteger(appId)) return res.status(400).json({ error: 'Invalid application id' });

  try {
    const app = await get(
      `SELECT ja.*, j.title as job_title, j.recruiter_id
       FROM job_applications ja
       JOIN jobs j ON ja.job_id = j.id
       WHERE ja.id = ?`,
      [appId]
    );
    if (!app) return res.status(404).json({ error: 'Application not found' });
    if (app.candidate_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not allowed to escalate this application' });
    }

    await run(
      'UPDATE job_applications SET premium_escalated = 1, premium_escalated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [appId]
    );

    // Notify the recruiter that a premium escalation has occurred
    await run(
      `INSERT INTO notifications (user_id, actor_id, type, message)
       VALUES (?, ?, ?, ?)`,
      [
        app.recruiter_id,
        req.user.id,
        'premium_escalation',
        `⚡ Premium escalation: application for "${app.job_title}" has been escalated for faster review.`
      ]
    );

    const updated = await get('SELECT * FROM job_applications WHERE id = ?', [appId]);
    res.json({ success: true, application: updated });
  } catch (err) {
    console.error('Application escalate error:', err);
    res.status(500).json({ error: 'Failed to escalate application' });
  }
});

export default router;
