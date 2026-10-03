import express from 'express';
import { authenticate } from '../auth.js';
import { run, get, query } from '../db.js';

const router = express.Router();

// ─────────────────────────────────────────────
// GET /api/analytics/dashboard - Enhanced recruiter analytics dashboard
// ─────────────────────────────────────────────
router.get('/dashboard', authenticate, async (req, res) => {
  if (req.user.role !== 'recruiter' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access restricted to recruiters and admins' });
  }

  try {
    // Get company info
    const company = await get('SELECT * FROM companies WHERE recruiter_id = ?', [req.user.id]);

    // Get detailed job analytics
    const jobAnalytics = await query(`
      SELECT
        j.id,
        j.title,
        j.status,
        j.location,
        j.workplace_type,
        j.job_type,
        j.experience_level,
        j.created_at,
        (SELECT COUNT(*) FROM job_applications ja WHERE ja.job_id = j.id) as total_applications,
        (SELECT COUNT(*) FROM job_applications ja WHERE ja.job_id = j.id AND ja.status = 'applied') as new_applications,
        (SELECT COUNT(*) FROM job_applications ja WHERE ja.job_id = j.id AND ja.status = 'shortlisted') as shortlisted_count,
        (SELECT COUNT(*) FROM job_applications ja WHERE ja.job_id = j.id AND ja.status = 'hired') as hired_count
      FROM jobs j
      WHERE j.recruiter_id = ?
      ORDER BY j.created_at DESC
    `, [req.user.id]);

    // Get time-series data (last 30 days)
    const timeSeries = await query(`
      SELECT
        DATE(created_at) as date,
        COUNT(*) as jobs_posted
      FROM jobs
      WHERE recruiter_id = ? AND created_at >= date('now', '-30 days')
      GROUP BY DATE(created_at)
      ORDER BY date
    `, [req.user.id]);

    // Get application sources
    const applicationSources = await query(`
      SELECT
        j.job_type,
        COUNT(*) as count
      FROM job_applications ja
      JOIN jobs j ON ja.job_id = j.id
      WHERE j.recruiter_id = ?
      GROUP BY j.job_type
    `, [req.user.id]);

    // Get experience level distribution
    const experienceDistribution = await query(`
      SELECT
        j.experience_level,
        COUNT(*) as count
      FROM job_applications ja
      JOIN jobs j ON ja.job_id = j.id
      WHERE j.recruiter_id = ?
      GROUP BY j.experience_level
    `, [req.user.id]);

    // Get hiring funnel
    const hiringFunnel = await query(`
      SELECT
        'Posted' as stage,
        COUNT(*) as count
      FROM jobs
      WHERE recruiter_id = ?

      UNION ALL

      SELECT
        'Applied' as stage,
        COUNT(*) as count
      FROM job_applications ja
      JOIN jobs j ON ja.job_id = j.id
      WHERE j.recruiter_id = ?

      UNION ALL

      SELECT
        'Shortlisted' as stage,
        COUNT(*) as count
      FROM job_applications ja
      JOIN jobs j ON ja.job_id = j.id
      WHERE j.recruiter_id = ? AND ja.status = 'shortlisted'

      UNION ALL

      SELECT
        'Hired' as stage,
        COUNT(*) as count
      FROM job_applications ja
      JOIN jobs j ON ja.job_id = j.id
      WHERE j.recruiter_id = ? AND ja.status = 'hired'
    `, [req.user.id, req.user.id, req.user.id, req.user.id]);

    // Get top performing jobs
    const topJobs = await query(`
      SELECT
        j.id,
        j.title,
        (SELECT COUNT(*) FROM job_applications ja WHERE ja.job_id = j.id) as application_count,
        (SELECT COUNT(*) FROM job_applications ja WHERE ja.job_id = j.id AND ja.status = 'hired') as hire_count,
        CASE
          WHEN (SELECT COUNT(*) FROM job_applications ja WHERE ja.job_id = j.id) > 0
          THEN ROUND(((SELECT COUNT(*) FROM job_applications ja WHERE ja.job_id = j.id AND ja.status = 'hired') * 100.0) /
                   (SELECT COUNT(*) FROM job_applications ja WHERE ja.job_id = j.id), 2)
          ELSE 0
        END as conversion_rate
      FROM jobs j
      WHERE j.recruiter_id = ? AND j.status = 'open'
      ORDER BY application_count DESC, hire_count DESC
      LIMIT 5
    `, [req.user.id]);

    res.json({
      company,
      analytics: {
        jobAnalytics,
        timeSeries,
        applicationSources,
        experienceDistribution,
        hiringFunnel,
        topJobs,
        summary: {
          totalJobs: jobAnalytics.length,
          activeJobs: jobAnalytics.filter(j => j.status === 'open').length,
          totalApplications: jobAnalytics.reduce((sum, j) => sum + j.total_applications, 0),
          totalHires: jobAnalytics.reduce((sum, j) => sum + j.hired_count, 0),
          avgConversionRate: jobAnalytics.length > 0 ?
            (jobAnalytics.reduce((sum, j) => sum + ((j.total_applications > 0 ? (j.hired_count * 100.0 / j.total_applications) : 0)), 0) / jobAnalytics.length).toFixed(2) : '0'
        }
      }
    });
  } catch (err) {
    console.error('Analytics dashboard error:', err);
    res.status(500).json({ error: 'Failed to load analytics dashboard' });
  }
});

// ─────────────────────────────────────────────
// GET /api/analytics/system - System performance metrics
// ─────────────────────────────────────────────
router.get('/system', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  try {
    // Get system statistics
    const systemStats = await query(`
      SELECT
        (SELECT COUNT(*) FROM users) as total_users,
        (SELECT COUNT(*) FROM users WHERE is_active = 1) as active_users,
        (SELECT COUNT(*) FROM users WHERE role = 'recruiter') as total_recruiters,
        (SELECT COUNT(*) FROM users WHERE role = 'job_seeker') as total_job_seekers,
        (SELECT COUNT(*) FROM users WHERE aadhaar_verified = 1) as verified_users,
        (SELECT COUNT(*) FROM jobs WHERE status = 'open') as open_jobs,
        (SELECT COUNT(*) FROM job_applications) as total_applications,
        (SELECT COUNT(*) FROM posts) as total_posts,
        (SELECT COUNT(*) FROM notifications WHERE is_read = 0) as unread_notifications,
        (SELECT COUNT(*) FROM collaborations WHERE status = 'open') as open_collaborations,
        (SELECT COUNT(*) FROM saved_jobs) as total_saved_jobs
    `);

    // Get recent activity (last 24 hours)
    const recentActivity = await query(`
      SELECT
        'user_registration' as type,
        COUNT(*) as count
      FROM users
      WHERE created_at >= date('now', '-1 day')

      UNION ALL

      SELECT
        'job_posted' as type,
        COUNT(*) as count
      FROM jobs
      WHERE created_at >= date('now', '-1 day')

      UNION ALL

      SELECT
        'application_submitted' as type,
        COUNT(*) as count
      FROM job_applications
      WHERE created_at >= date('now', '-1 day')

      UNION ALL

      SELECT
        'connection_made' as type,
        COUNT(*) as count
      FROM connections
      WHERE status = 'accepted' AND created_at >= date('now', '-1 day')
    `);

    // Get database performance
    const dbPerformance = process.env.DB_PROVIDER === 'postgresql'
      ? await query(`
          SELECT tablename AS table_name,
                 (xpath('/row/c/text()', query_to_xml('SELECT count(*) AS c FROM ' || quote_ident(tablename), false, true, '')))[1]::text::bigint AS row_count
          FROM pg_tables
          WHERE schemaname = 'public'
          ORDER BY tablename
        `)
      : await query(`
          SELECT
            name as table_name,
            (SELECT COUNT(*) FROM "${name}") as row_count
          FROM sqlite_master
          WHERE type='table'
          AND name NOT LIKE 'sqlite_%'
          ORDER BY name
        `);

    res.json({
      system: systemStats[0] || {},
      recentActivity,
      database: dbPerformance,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('System analytics error:', err);
    res.status(500).json({ error: 'Failed to load system analytics' });
  }
});

// ─────────────────────────────────────────────
// GET /api/analytics/reports - Generate custom reports
// ─────────────────────────────────────────────
router.get('/reports', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const { reportType, startDate, endDate } = req.query;

  try {
    let reportData = {};

    switch (reportType) {
      case 'monthly':
        reportData = await getMonthlyReport(startDate, endDate);
        break;
      case 'growth':
        reportData = await getGrowthReport(startDate, endDate);
        break;
      case 'engagement':
        reportData = await getEngagementReport(startDate, endDate);
        break;
      default:
        reportData = await getOverviewReport();
    }

    res.json({
      reportType,
      period: { startDate, endDate },
      generatedAt: new Date().toISOString(),
      data: reportData
    });
  } catch (err) {
    console.error('Reports error:', err);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// Date formatting differs between SQLite and PostgreSQL — strftime() is a
// SQLite builtin, PostgreSQL needs to_char() with an explicit format mask.
// Accepts the SQLite-style pattern so callers stay provider-agnostic.
function dateExpr(column, pattern) {
  if (process.env.DB_PROVIDER === 'postgresql') {
    const mask = pattern === '%Y-%m' ? 'YYYY-MM' : 'YYYY-MM-DD';
    return `to_char(${column}, '${mask}')`;
  }
  return `strftime('${pattern}', ${column})`;
}

// Helper functions for reports
async function getMonthlyReport(startDate, endDate) {
  const monthlyData = await query(`
    SELECT
      ${dateExpr('created_at', '%Y-%m')} as month,
      COUNT(*) as new_users
    FROM users
    WHERE created_at BETWEEN ? AND ?
    GROUP BY month
    ORDER BY month
  `, [startDate, endDate]);

  return { monthlyData };
}

async function getGrowthReport(startDate, endDate) {
  const growthData = await query(`
    SELECT
      ${dateExpr('created_at', '%Y-%m-%d')} as date,
      COUNT(*) as new_users
    FROM users
    WHERE created_at BETWEEN ? AND ?
    GROUP BY date
    ORDER BY date
  `, [startDate, endDate]);

  return { growthData };
}

async function getEngagementReport(startDate, endDate) {
  const engagementData = await query(`
    SELECT
      ${dateExpr('created_at', '%Y-%m-%d')} as date,
      COUNT(*) as new_jobs
    FROM jobs
    WHERE created_at BETWEEN ? AND ?
    GROUP BY date
    ORDER BY date
  `, [startDate, endDate]);

  return { engagementData };
}

async function getOverviewReport() {
  const overview = await query(`
    SELECT
      'total_users' as metric,
      COUNT(*) as value
    FROM users

    UNION ALL

    SELECT
      'active_users' as metric,
      COUNT(*) as value
    FROM users WHERE is_active = 1

    UNION ALL

    SELECT
      'total_jobs' as metric,
      COUNT(*) as value
    FROM jobs

    UNION ALL

    SELECT
      'open_jobs' as metric,
      COUNT(*) as value
    FROM jobs WHERE status = 'open'

    UNION ALL

    SELECT
      'total_applications' as metric,
      COUNT(*) as value
    FROM job_applications

    UNION ALL

    SELECT
      'total_posts' as metric,
      COUNT(*) as value
    FROM posts
  `);

  return { overview };
}

export default router;