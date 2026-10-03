import express from 'express';
import { run, get, query } from '../db.js';
import { authenticate } from '../auth.js';
import { sendToUser } from '../socket.js';
import { getFileUrl, uploadResumeMiddleware } from '../services/upload.js';

const router = express.Router();

// Candidate: Upload a resume/CV file and get a stable URL usable in job applications.
// The "Attach PDF" button in the apply modal only set the filename text before —
// this endpoint actually persists the file so recruiters can view the CV.
router.post('/applications/upload-resume', authenticate, uploadResumeMiddleware, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No resume file provided' });
    }
    res.json({ success: true, resume_url: getFileUrl(req.file) });
  } catch (err) {
    console.error('Resume upload error:', err);
    res.status(500).json({ error: err.message || 'Failed to upload resume' });
  }
});

// Candidate applies to a job
router.post('/applications', authenticate, async (req, res) => {
  const candidateId = req.user.id;
  const { jobId, cover_note, resume_url, portfolio_url } = req.body;

  if (!jobId) {
    return res.status(400).json({ error: 'Job ID is required' });
  }

  try {
    const job = await get(
      `SELECT j.*, c.name as company_name, u.id as recruiter_id 
       FROM jobs j 
       JOIN companies c ON j.company_id = c.id 
       JOIN users u ON j.recruiter_id = u.id 
       WHERE j.id = ?`,
      [jobId]
    );

    if (!job) return res.status(404).json({ error: 'Job not found' });
    if (job.status !== 'open') return res.status(400).json({ error: 'This job is no longer accepting applications' });

    const existing = await get('SELECT id FROM job_applications WHERE job_id = ? AND candidate_id = ?', [jobId, candidateId]);
    if (existing) {
      return res.status(400).json({ error: 'You have already applied to this job' });
    }

    const result = await run(
      `INSERT INTO job_applications (job_id, candidate_id, cover_note, resume_url, portfolio_url, status, updated_at)
       VALUES (?, ?, ?, ?, ?, 'applied', CURRENT_TIMESTAMP)`,
      [jobId, candidateId, cover_note || '', resume_url || '', portfolio_url || '']
    );

    const candidateProfile = await get('SELECT full_name FROM profiles WHERE user_id = ?', [candidateId]);
    const candidateName = candidateProfile?.full_name || req.user.username;

    // Send real-time notification to Recruiter
    const notifMsg = `New application received for "${job.title}" from ${candidateName}.`;
    const notifRes = await run(
      `INSERT INTO notifications (user_id, actor_id, type, message, payload)
       VALUES (?, ?, 'job_applied', ?, ?)`,
      [
        job.recruiter_id,
        candidateId,
        notifMsg,
        JSON.stringify({ jobId: job.id, applicationId: result.id, jobTitle: job.title, candidateName })
      ]
    );

    sendToUser(job.recruiter_id, {
      type: 'notification',
      notification: {
        id: notifRes.id,
        type: 'job_applied',
        message: notifMsg,
        actor_id: candidateId,
        actor_name: candidateName,
        created_at: new Date().toISOString()
      }
    });

    res.status(201).json({
      success: true,
      message: 'Application submitted successfully',
      applicationId: result.id
    });
  } catch (err) {
    console.error('Job application error:', err);
    res.status(500).json({ error: 'Failed to submit application' });
  }
});

// Candidate: Get all my applications
router.get('/applications/my', authenticate, async (req, res) => {
  const candidateId = req.user.id;

  try {
    const applications = await query(
      `SELECT 
        ja.id as application_id, ja.status, ja.cover_note, ja.resume_url, ja.portfolio_url, ja.created_at as applied_at, ja.updated_at,
        ja.premium_escalated, ja.premium_escalated_at,
        j.id as job_id, j.title as job_title, j.location, j.workplace_type, j.job_type, j.experience_level, j.salary_range, j.required_skills, j.premium_required,
        c.id as company_id, c.name as company_name, c.logo_url as company_logo, c.website as company_website,
        u.id as recruiter_id, pr.full_name as recruiter_name
       FROM job_applications ja
       JOIN jobs j ON ja.job_id = j.id
       JOIN companies c ON j.company_id = c.id
       JOIN users u ON j.recruiter_id = u.id
       LEFT JOIN profiles pr ON u.id = pr.user_id
       WHERE ja.candidate_id = ?
       ORDER BY ja.created_at DESC`,
      [candidateId]
    );

    const formatted = applications.map((app) => ({
      ...app,
      required_skills: JSON.parse(app.required_skills || '[]')
    }));

    res.json(formatted);
  } catch (err) {
    console.error('Fetch candidate applications error:', err);
    res.status(500).json({ error: 'Failed to fetch applications' });
  }
});

// Recruiter: Get all applicants for a specific job
router.get('/applications/job/:jobId', authenticate, async (req, res) => {
  const jobId = Number(req.params.jobId);
  const recruiterId = req.user.id;

  try {
    const job = await get('SELECT * FROM jobs WHERE id = ?', [jobId]);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    if (job.recruiter_id !== recruiterId && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized to view applicants for this job' });
    }

    const applicants = await query(
      `SELECT
        ja.id as application_id, ja.status, ja.cover_note, ja.resume_url, ja.portfolio_url, ja.created_at as applied_at, ja.updated_at,
        ja.premium_escalated, ja.premium_escalated_at,
        u.id as candidate_id, u.username, u.email,
        pr.full_name, pr.headline, pr.bio, pr.location, pr.avatar_url, pr.education, pr.projects, pr.social_links
       FROM job_applications ja
       JOIN users u ON ja.candidate_id = u.id
       LEFT JOIN profiles pr ON u.id = pr.user_id
       WHERE ja.job_id = ? AND ja.status != 'rejected'
       ORDER BY ja.premium_escalated DESC, ja.created_at DESC`,
      [jobId]
    );

    const requiredSkills = JSON.parse(job.required_skills || '[]');

    // Attach candidate skills and match score
    const formattedApplicants = await Promise.all(
      applicants.map(async (app) => {
        const candidateSkills = await query('SELECT name, category, proficiency FROM skills WHERE user_id = ?', [app.candidate_id]);
        const candidateSkillNames = candidateSkills.map((s) => s.name.toLowerCase());

        let matchCount = 0;
        if (requiredSkills.length > 0) {
          matchCount = requiredSkills.filter((sk) => candidateSkillNames.includes(sk.toLowerCase())).length;
        }
        const matchScore = requiredSkills.length > 0 ? Math.round((matchCount / requiredSkills.length) * 100) : 100;

        return {
          ...app,
          education: JSON.parse(app.education || '[]'),
          projects: JSON.parse(app.projects || '[]'),
          social_links: JSON.parse(app.social_links || '{}'),
          skills: candidateSkills,
          matchScore,
          matchedSkillsCount: matchCount,
          totalRequiredSkills: requiredSkills.length
        };
      })
    );

    res.json({
      job: {
        ...job,
        required_skills: requiredSkills
      },
      applicants: formattedApplicants
    });
  } catch (err) {
    console.error('Fetch job applicants error:', err);
    res.status(500).json({ error: 'Failed to fetch job applicants' });
  }
});

// Recruiter: Update application status (under_review, shortlisted, interview, rejected, hired)
router.put('/applications/:id/status', authenticate, async (req, res) => {
  const applicationId = Number(req.params.id);
  const recruiterId = req.user.id;
  const { status } = req.body;

  const validStatuses = ['applied', 'under_review', 'shortlisted', 'interview', 'rejected', 'hired'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
  }

  try {
    const app = await get(
      `SELECT ja.*, j.title as job_title, j.recruiter_id, c.name as company_name 
       FROM job_applications ja
       JOIN jobs j ON ja.job_id = j.id
       JOIN companies c ON j.company_id = c.id
       WHERE ja.id = ?`,
      [applicationId]
    );

    if (!app) return res.status(404).json({ error: 'Application not found' });
    if (app.recruiter_id !== recruiterId && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized to update this application' });
    }

    await run('UPDATE job_applications SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [status, applicationId]);

    // Send real-time notification to candidate
    const statusLabels = {
      under_review: 'Under Review 👀',
      shortlisted: 'Shortlisted! 🎉',
      interview: 'Interview Scheduled 🗓️',
      rejected: 'Status Updated',
      hired: 'Offered / Hired! 🚀',
      applied: 'Received'
    };

    const notifMsg = `${app.company_name} updated your application for "${app.job_title}" to ${statusLabels[status] || status}.`;
    const notifRes = await run(
      `INSERT INTO notifications (user_id, actor_id, type, message, payload)
       VALUES (?, ?, 'application_status', ?, ?)`,
      [
        app.candidate_id,
        recruiterId,
        notifMsg,
        JSON.stringify({ applicationId, jobId: app.job_id, status, jobTitle: app.job_title, companyName: app.company_name })
      ]
    );

    sendToUser(app.candidate_id, {
      type: 'notification',
      notification: {
        id: notifRes.id,
        type: 'application_status',
        message: notifMsg,
        actor_id: recruiterId,
        created_at: new Date().toISOString()
      }
    });

    res.json({ success: true, message: 'Status updated', status });
  } catch (err) {
    console.error('Update status error:', err);
    res.status(500).json({ error: 'Failed to update application status' });
  }
});

export default router;
