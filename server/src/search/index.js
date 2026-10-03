import { logger } from '../logger.js';
import { run, get, query } from '../db.js';

class SearchService {
  constructor() {
    this.fallbackToRawSql = true;
    logger.info('Search service initialized (using raw SQL fallback)');
  }

  async searchJobs(queryParams) {
    try {
      let sql = `SELECT j.id, j.title, j.description, j.requirements, j.location, j.workplace_type, j.job_type, j.experience_level, j.salary_range, j.required_skills, j.status, j.created_at, j.premium_required, c.id as company_id, c.name as company_name, c.logo_url as company_logo, u.id as recruiter_id, pr.full_name as recruiter_name, pr.avatar_url as recruiter_avatar, (SELECT COUNT(*) FROM job_applications ja WHERE ja.job_id = j.id) as applicants_count FROM jobs j JOIN companies c ON j.company_id = c.id JOIN users u ON j.recruiter_id = u.id LEFT JOIN profiles pr ON u.id = pr.user_id WHERE j.status = 'open'`;

      const params = [];

      if (queryParams.search && queryParams.search.trim()) {
        sql += ' AND (LOWER(j.title) LIKE ? OR LOWER(j.description) LIKE ? OR LOWER(c.name) LIKE ?)';
        const term = `%${queryParams.search.trim().toLowerCase()}%`;
        params.push(term, term, term);
      }

      if (queryParams.location && queryParams.location.trim() && queryParams.location !== 'All') {
        sql += ' AND LOWER(j.location) LIKE ?';
        params.push(`%${queryParams.location.trim().toLowerCase()}%`);
      }

      if (queryParams.workplaceType && queryParams.workplaceType !== 'All') {
        sql += ' AND j.workplace_type = ?';
        params.push(queryParams.workplaceType);
      }

      if (queryParams.experienceLevel && queryParams.experienceLevel !== 'All') {
        sql += ' AND (j.experience_level = ? OR (? = "Fresher" AND (j.experience_level = "Fresher" OR j.experience_level = "Internship" OR j.experience_level = "0-1 years")))';
        params.push(queryParams.experienceLevel, queryParams.experienceLevel);
      }

      if (queryParams.jobType && queryParams.jobType !== 'All') {
        sql += ' AND j.job_type = ?';
        params.push(queryParams.jobType);
      }

      sql += ' ORDER BY j.premium_required DESC, j.created_at DESC';

      const jobs = await query(sql, params);

      const formattedJobs = jobs.map((job) => {
        const requiredSkills = JSON.parse(job.required_skills || '[]');

        return {
          id: job.id,
          title: job.title,
          description: job.description,
          requirements: job.requirements,
          location: job.location,
          workplace_type: job.workplace_type,
          job_type: job.job_type,
          experience_level: job.experience_level,
          salary_range: job.salary_range,
          required_skills: requiredSkills,
          status: job.status,
          premium_required: job.premium_required || 0,
          company_id: job.company_id,
          recruiter_id: job.recruiter_id,
          company_name: job.company_name,
          company_logo: job.company_logo,
          recruiter_name: job.recruiter_name,
          recruiter_avatar: job.recruiter_avatar,
          applicants_count: job.applicants_count,
          created_at: job.created_at,
          updated_at: job.updated_at,
          has_applied: false,
          application_status: null,
          skill_match_percentage: 0,
          matched_skills_count: 0
        };
      });

      return { hits: formattedJobs.map(job => ({ document: job })) };
    } catch (error) {
      logger.error(error, 'Error searching jobs');
      throw error;
    }
  }

  async searchProfiles(queryParams) {
    try {
      let sql = `SELECT p.id, p.user_id, p.full_name, p.headline, p.bio, p.location, p.avatar_url, p.banner_url, p.target_role, p.education, p.experience, p.projects, p.social_links, p.student_id_verified, p.created_at, p.updated_at, u.username, u.role FROM profiles p JOIN users u ON p.user_id = u.id WHERE 1=1`;

      const params = [];

      if (queryParams.search && queryParams.search.trim()) {
        sql += ' AND (LOWER(p.full_name) LIKE ? OR LOWER(p.headline) LIKE ? OR LOWER(p.target_role) LIKE ?)';
        const term = `%${queryParams.search.trim().toLowerCase()}%`;
        params.push(term, term, term);
      }

      if (queryParams.location && queryParams.location.trim() && queryParams.location !== 'All') {
        sql += ' AND LOWER(p.location) LIKE ?';
        params.push(`%${queryParams.location.trim().toLowerCase()}%`);
      }

      sql += ' ORDER BY p.created_at DESC';

      const profiles = await query(sql, params);
      return { hits: profiles.map(p => ({ document: p })) };
    } catch (error) {
      logger.error(error, 'Error searching profiles');
      throw error;
    }
  }

  async searchPosts(queryParams) {
    try {
      let sql = `SELECT p.id, p.author_id, p.content, p.media_url, p.category, p.tags, p.created_at, p.updated_at, u.username FROM posts p JOIN users u ON p.author_id = u.id WHERE 1=1`;

      const params = [];

      if (queryParams.search && queryParams.search.trim()) {
        sql += ' AND LOWER(p.content) LIKE ?';
        const term = `%${queryParams.search.trim().toLowerCase()}%`;
        params.push(term);
      }

      if (queryParams.category && queryParams.category !== 'All') {
        sql += ' AND p.category = ?';
        params.push(queryParams.category);
      }

      sql += ' ORDER BY p.created_at DESC';

      const posts = await query(sql, params);
      return { hits: posts.map(p => ({ document: p })) };
    } catch (error) {
      logger.error(error, 'Error searching posts');
      throw error;
    }
  }
}

const searchService = new SearchService();
export default searchService;