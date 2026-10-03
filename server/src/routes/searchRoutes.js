import express from 'express';
import { authenticate, optionalAuth } from '../auth.js';
import searchService from '../search/index.js';

const router = express.Router();

// ─────────────────────────────────────────────
// GET /api/search/jobs - Search jobs with filters
// ─────────────────────────────────────────────
router.get('/search/jobs', optionalAuth, async (req, res) => {
  try {
    const searchResults = await searchService.searchJobs(req.query);
    const jobs = searchResults.hits.map((hit) => (hit && hit.document) ? hit.document : hit);
    res.json(jobs);
  } catch (err) {
    console.error('Search jobs error:', err);
    res.status(500).json({ error: 'Search failed, please try again' });
  }
});

// ─────────────────────────────────────────────
// GET /api/search/profiles - Search profiles
// ─────────────────────────────────────────────
router.get('/search/profiles', optionalAuth, async (req, res) => {
  try {
    const searchResults = await searchService.searchProfiles(req.query);
    const profiles = searchResults.hits.map((hit) => (hit && hit.document) ? hit.document : hit);
    res.json(profiles);
  } catch (err) {
    console.error('Search profiles error:', err);
    res.status(500).json({ error: 'Search failed, please try again' });
  }
});

// ─────────────────────────────────────────────
// GET /api/search/posts - Search posts
// ─────────────────────────────────────────────
router.get('/search/posts', optionalAuth, async (req, res) => {
  try {
    const searchResults = await searchService.searchPosts(req.query);
    const posts = searchResults.hits.map((hit) => (hit && hit.document) ? hit.document : hit);
    res.json(posts);
  } catch (err) {
    console.error('Search posts error:', err);
    res.status(500).json({ error: 'Search failed, please try again' });
  }
});

export default router;