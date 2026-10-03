import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  Briefcase,
  Search,
  MapPin,
  DollarSign,
  Building,
  CheckCircle2,
  Sparkles,
  ExternalLink,
  Clock,
  Send,
  X,
  FileText,
  Filter,
  Check,
  TrendingUp,
  Bookmark,
  BookmarkCheck,
  Bot,
  Lightbulb,
  Zap,
} from 'lucide-react';

export default function JobMarketplace({ onSelectJobId, onSelectUser, searchQuery = '' }) {
  const { user, openAuthModal } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [myApplications, setMyApplications] = useState([]);
  const [savedJobIds, setSavedJobIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('browse'); // 'browse' | 'my_applications' | 'saved'

  // Filters
  const [search, setSearch] = useState('');
  const [location, setLocation] = useState('All');
  const [workplaceType, setWorkplaceType] = useState('All');
  const [experienceLevel, setExperienceLevel] = useState('All');
  const [jobType, setJobType] = useState('All');

  // Sync global search bar with local filter
  useEffect(() => {
    setSearch(searchQuery);
  }, [searchQuery]);

  // Selected Job Details Drawer
  const [selectedJob, setSelectedJob] = useState(null);

  // Skill Gap Modal
  const [skillGapModalOpen, setSkillGapModalOpen] = useState(false);
  const [skillGapData, setSkillGapData] = useState(null);
  const [loadingSkillGap, setLoadingSkillGap] = useState(false);

  // Premium escalation state
  const [escalatingId, setEscalatingId] = useState(null);

  // Apply Modal
  const [applyModalOpen, setApplyModalOpen] = useState(false);
  const [applyJob, setApplyJob] = useState(null);
  const [coverNote, setCoverNote] = useState('');
  const [resumeUrl, setResumeUrl] = useState('');
  const [resumeFile, setResumeFile] = useState(null);
  const [portfolioUrl, setPortfolioUrl] = useState('');
  const [submittingApply, setSubmittingApply] = useState(false);
  const [generatingPitch, setGeneratingPitch] = useState(false);

  useEffect(() => {
    fetchJobs();
    if (user) {
      fetchMyApplications();
      fetchSavedJobs();
    }
  }, [user?.id, workplaceType, experienceLevel, jobType]);

  async function fetchJobs() {
    setLoading(true);
    try {
      const params = {};
      if (search.trim()) params.search = search.trim();
      if (location !== 'All') params.location = location;
      if (workplaceType !== 'All') params.workplaceType = workplaceType;
      if (experienceLevel !== 'All') params.experienceLevel = experienceLevel;
      if (jobType !== 'All') params.jobType = jobType;

      const list = await api.getJobs(params);
      setJobs(list);
      if (list.length > 0 && !selectedJob) {
        setSelectedJob(list[0]);
      }
    } catch (err) {
      console.error('Fetch jobs error:', err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchMyApplications() {
    try {
      const apps = await api.getMyApplications();
      setMyApplications(apps);
    } catch (err) {
      console.error('Fetch my applications error:', err);
    }
  }

  async function handleEscalate(applicationId) {
    if (!user) return openAuthModal();
    setEscalatingId(applicationId);
    try {
      await api.escalateApplication(applicationId);
      await fetchMyApplications();
      alert('⚡ Escalated! Your application is now prioritized for faster review.');
    } catch (err) {
      console.error('Escalate application error:', err);
      alert(err.message || 'Failed to escalate application.');
    } finally {
      setEscalatingId(null);
    }
  }

  async function fetchSavedJobs() {
    try {
      const saved = await api.getSavedJobs();
      setSavedJobIds(new Set(saved.map((j) => j.id)));
    } catch (err) {
      console.error('Fetch saved jobs error:', err);
    }
  }

  async function handleToggleSave(e, jobId) {
    e.stopPropagation();
    if (!user) return openAuthModal();
    try {
      const res = await api.toggleSaveJob(jobId);
      setSavedJobIds((prev) => {
        const next = new Set(prev);
        if (res.isSaved) next.add(jobId);
        else next.delete(jobId);
        return next;
      });
    } catch (err) {
      console.error('Toggle save error:', err);
    }
  }

  function handleSearchSubmit(e) {
    e.preventDefault();
    fetchJobs();
  }

  function openApplyModal(job) {
    if (!user) return openAuthModal();
    setApplyJob(job);
    setCoverNote(
      `Hello! I'm really excited about the ${job.title} role at ${job.company_name}. With my hands-on background in ${user?.skills?.map((s) => s.name).slice(0, 3).join(', ') || 'modern software engineering'}, I'm confident I can make an immediate impact.`
    );
    setResumeUrl(user?.profile?.social_links?.portfolio || 'https://resume.example.com/cv.pdf');
    setPortfolioUrl(user?.profile?.social_links?.portfolio || user?.profile?.social_links?.github || '');
    setApplyModalOpen(true);
  }

  async function handleGenerateAIPitch() {
    if (!applyJob) return;
    setGeneratingPitch(true);
    try {
      const res = await api.careerCopilot({
        action: 'cover_letter',
        jobTitle: applyJob.title,
        companyName: applyJob.company_name
      });
      if (res.coverLetter) {
        setCoverNote(res.coverLetter);
      }
    } catch (err) {
      console.error('Generate pitch error:', err);
    } finally {
      setGeneratingPitch(false);
    }
  }

  async function handleOpenSkillGap(jobId) {
    setLoadingSkillGap(true);
    setSkillGapModalOpen(true);
    try {
      const data = await api.getSkillGap(jobId);
      setSkillGapData(data);
    } catch (err) {
      console.error('Skill gap error:', err);
    } finally {
      setLoadingSkillGap(false);
    }
  }

  async function handleSubmitApplication(e) {
    e.preventDefault();
    if (!applyJob) return;

    setSubmittingApply(true);
    try {
      // If the user attached a resume file, upload it first so recruiters can
      // actually view the CV. The "Attach PDF" button only used to set the
      // filename text — now it persists the file server-side.
      let finalResumeUrl = resumeUrl;
      if (resumeFile) {
        const formData = new FormData();
        formData.append('resume', resumeFile);
        const upload = await api.uploadResume(formData);
        if (upload?.success) {
          finalResumeUrl = upload.resume_url;
        }
      }

      await api.applyToJob({
        jobId: applyJob.id,
        cover_note: coverNote,
        resume_url: finalResumeUrl,
        portfolio_url: portfolioUrl
      });

      setApplyModalOpen(false);
      setResumeFile(null);
      await fetchJobs();
      await fetchMyApplications();
      alert(`Application submitted to ${applyJob.company_name}! 🎉`);
    } catch (err) {
      alert(err.message || 'Application failed');
    } finally {
      setSubmittingApply(false);
    }
  }

  const getStatusBadge = (status) => {
    switch (status) {
      case 'applied':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800 flex items-center gap-1">
            <Clock className="w-3 h-3" /> Applied
          </span>
        );
      case 'under_review':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800 flex items-center gap-1">
            <Clock className="w-3 h-3" /> Under Review
          </span>
        );
      case 'shortlisted':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
            <Sparkles className="w-3 h-3" /> Shortlisted 🎉
          </span>
        );
      case 'interview':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800 flex items-center gap-1">
            <Clock className="w-3 h-3" /> Interview Scheduled
          </span>
        );
      case 'hired':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-600 text-white flex items-center gap-1">
            <Check className="w-3 h-3" /> Hired / Offered 🚀
          </span>
        );
      case 'rejected':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-500 dark:bg-slate-800">
            Archived
          </span>
        );
      default:
        return null;
    }
  };

  const displayedJobs = activeTab === 'saved' ? jobs.filter((j) => savedJobIds.has(j.id)) : jobs;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Top Banner & Search */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-200/80 dark:border-slate-800 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-brand-500" /> Early-Career Opportunities & Internships
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Curated roles for students, freshers, and early engineers with transparent skill matching and AI gap analysis.
            </p>
          </div>

          {/* Tab Switcher */}
          <div className="flex items-center space-x-2 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl self-start md:self-auto text-xs font-bold">
            <button
              onClick={() => setActiveTab('browse')}
              className={`px-3.5 py-1.5 rounded-xl transition ${
                activeTab === 'browse'
                  ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Browse Jobs ({jobs.length})
            </button>
            {user && (
              <>
                <button
                  onClick={() => setActiveTab('saved')}
                  className={`px-3.5 py-1.5 rounded-xl transition ${
                    activeTab === 'saved'
                      ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Saved ({savedJobIds.size})
                </button>
                <button
                  onClick={() => setActiveTab('my_applications')}
                  className={`px-3.5 py-1.5 rounded-xl transition ${
                    activeTab === 'my_applications'
                      ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  My Applications ({myApplications.length})
                </button>
              </>
            )}
          </div>
        </div>

        {/* Search Bar and Dropdown Filters */}
        {activeTab !== 'my_applications' && (
          <form onSubmit={handleSearchSubmit} className="space-y-3 pt-2">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input id="JobMarketplace-search" name="search"
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Job title, keywords, or company..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <button
                type="submit"
                className="px-6 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-2xl text-xs font-bold transition shadow-md shadow-brand-500/20"
              >
                Search
              </button>
            </div>

            {/* Quick Filter Badges */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-slate-400 font-medium flex items-center gap-1 mr-1">
                <Filter className="w-3 h-3" /> Filters:
              </span>

              <select id="JobMarketplace-experienceLevel" name="experienceLevel"
                value={experienceLevel}
                onChange={(e) => setExperienceLevel(e.target.value)}
                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1 text-slate-700 dark:text-slate-300 text-xs font-medium"
              >
                <option value="All">All Experience</option>
                <option value="Fresher">🎓 Fresher / Entry-Level</option>
                <option value="Internship">🚀 Internship</option>
                <option value="0-1 years">0-1 years</option>
                <option value="1-3 years">1-3 years</option>
              </select>

              <select id="JobMarketplace-workplaceType" name="workplaceType"
                value={workplaceType}
                onChange={(e) => setWorkplaceType(e.target.value)}
                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1 text-slate-700 dark:text-slate-300 text-xs font-medium"
              >
                <option value="All">Workplace: All</option>
                <option value="Remote">🌐 Remote</option>
                <option value="Hybrid">🏢 Hybrid</option>
                <option value="On-site">📍 On-site</option>
              </select>

              <select id="JobMarketplace-jobType" name="jobType"
                value={jobType}
                onChange={(e) => setJobType(e.target.value)}
                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1 text-slate-700 dark:text-slate-300 text-xs font-medium"
              >
                <option value="All">Type: All</option>
                <option value="Full-time">Full-time</option>
                <option value="Internship">Internship</option>
                <option value="Contract">Contract</option>
              </select>
            </div>
          </form>
        )}
      </div>

      {/* Tab: Browse & Saved Jobs */}
      {activeTab !== 'my_applications' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Job Cards List */}
          <div className="lg:col-span-5 space-y-3">
            {loading ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full" />
                <p className="text-xs text-slate-400 mt-2">Loading jobs...</p>
              </div>
            ) : displayedJobs.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 text-center border border-slate-200 dark:border-slate-800">
                <Briefcase className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
                <h3 className="font-bold text-xs text-slate-900 dark:text-white">
                  {activeTab === 'saved' ? 'No saved jobs yet' : 'No jobs matched your filters'}
                </h3>
                <p className="text-[11px] text-slate-400 mt-1">
                  {activeTab === 'saved' ? 'Click the bookmark icon on any job to save it here.' : 'Try clearing filters or search terms.'}
                </p>
              </div>
            ) : (
              displayedJobs.map((job) => {
                const isSelected = selectedJob?.id === job.id;
                const isSaved = savedJobIds.has(job.id);
                return (
                  <div
                    key={job.id}
                    onClick={() => setSelectedJob(job)}
                    className={`bg-white dark:bg-slate-900 p-5 rounded-3xl shadow-sm border cursor-pointer transition-all ${
                      isSelected
                        ? 'border-brand-500 ring-2 ring-brand-500/20 shadow-md'
                        : 'border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start space-x-3">
                        {job.premium_required && (
                          <span className="shrink-0 px-1.5 py-0.5 rounded-md text-[9px] font-black bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow-sm">
                            ⚡ PREMIUM
                          </span>
                        )}
                        <img
                          src={job.company_logo || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=100&auto=format&fit=crop&q=80'}
                          alt={job.company_name}
                          className="w-12 h-12 rounded-2xl object-cover border border-slate-200 dark:border-slate-700 bg-white"
                        />
                        <div>
                          <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white hover:text-brand-600 transition line-clamp-1">
                            {job.title}
                          </h3>
                          <p className="text-xs text-slate-500 font-medium">{job.company_name}</p>
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-1">
                            <MapPin className="w-3 h-3" />
                            <span>{job.location}</span>
                            <span>•</span>
                            <span className="font-semibold text-slate-600 dark:text-slate-300">{job.workplace_type}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-1">
                        <button
                          onClick={(e) => handleToggleSave(e, job.id)}
                          className={`p-1.5 rounded-lg transition ${
                            isSaved ? 'text-brand-600' : 'text-slate-400 hover:text-slate-600'
                          }`}
                          title="Save Job"
                        >
                          {isSaved ? <BookmarkCheck className="w-4 h-4 fill-current" /> : <Bookmark className="w-4 h-4" />}
                        </button>

                        {job.has_applied && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            Applied
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Skill Match Indicator */}
                    {user && (
                      <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px]">
                        <span className="text-slate-500 flex items-center gap-1">
                          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                          <span>Skill Match:</span>
                          <strong className="text-brand-600 dark:text-brand-400 font-bold">
                            {job.skill_match_percentage}%
                          </strong>
                        </span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400 text-xs">
                          {job.salary_range}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Right Column: Selected Job Full Details */}
          <div className="lg:col-span-7">
            {selectedJob ? (
              <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-200/80 dark:border-slate-800 space-y-6 sticky top-24">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-6 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-start space-x-4">
                    <img
                      src={selectedJob.company_logo || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=100&auto=format&fit=crop&q=80'}
                      alt={selectedJob.company_name}
                      className="w-16 h-16 rounded-3xl object-cover border border-slate-200 dark:border-slate-700 shadow-sm"
                    />
                    <div>
                      <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
                        {selectedJob.title}
                      </h2>
                      <p className="text-xs font-bold text-brand-600 dark:text-brand-400">
                        {selectedJob.company_name}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-2">
                        <span className="px-2.5 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 font-semibold">
                          {selectedJob.job_type}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 font-semibold">
                          {selectedJob.workplace_type}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 font-bold">
                          {selectedJob.experience_level}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col sm:items-end gap-2">
                    {selectedJob.has_applied ? (
                      <div className="text-right">
                        <span className="inline-flex items-center gap-1 px-4 py-2 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 rounded-xl text-xs font-bold border border-emerald-200 dark:border-emerald-800">
                          <CheckCircle2 className="w-4 h-4" /> Application Submitted
                        </span>
                        <p className="text-[10px] text-slate-400 mt-1">Status: {selectedJob.application_status}</p>
                      </div>
                    ) : (
                      <button
                        onClick={() => openApplyModal(selectedJob)}
                        className="w-full sm:w-auto px-6 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-brand-500/25 flex items-center justify-center space-x-1.5"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Apply Now</span>
                      </button>
                    )}

                    <button
                      onClick={() => handleOpenSkillGap(selectedJob.id)}
                      className="w-full sm:w-auto px-4 py-1.5 bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 rounded-xl text-xs font-bold transition border border-purple-200 dark:border-purple-800 flex items-center justify-center space-x-1.5"
                    >
                      <Bot className="w-3.5 h-3.5" />
                      <span>Analyze Skill Gap with AI</span>
                    </button>
                  </div>
                </div>

                {/* Compensation & Match Bar */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Compensation</span>
                    <span className="font-extrabold text-slate-900 dark:text-white text-sm text-emerald-600 dark:text-emerald-400">
                      {selectedJob.salary_range || 'Competitive'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Recruiter</span>
                    <span
                      onClick={() => onSelectUser && onSelectUser(selectedJob.recruiter_id)}
                      className="font-bold text-slate-900 dark:text-white text-xs hover:text-brand-600 cursor-pointer"
                    >
                      {selectedJob.recruiter_name || 'Hiring Team'}
                    </span>
                  </div>
                </div>

                {/* Required Skills Match */}
                {selectedJob.required_skills && selectedJob.required_skills.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        Required Skills & Matching
                      </h3>
                      <button
                        onClick={() => handleOpenSkillGap(selectedJob.id)}
                        className="text-[11px] text-brand-600 dark:text-brand-400 font-bold hover:underline"
                      >
                        View Gap Roadmap ➔
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {selectedJob.required_skills.map((skill, idx) => {
                        const hasSkill = user?.skills?.some((s) => s.name.toLowerCase() === skill.toLowerCase());
                        return (
                          <span
                            key={idx}
                            className={`px-3 py-1 rounded-xl text-xs font-semibold flex items-center gap-1.5 border ${
                              hasSkill
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-700'
                                : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                            }`}
                          >
                            {hasSkill ? <Check className="w-3 h-3 text-emerald-600" /> : null}
                            <span>{skill}</span>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Job Description */}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                    About The Role
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 whitespace-pre-line leading-relaxed">
                    {selectedJob.description}
                  </p>
                </div>

                {/* Requirements */}
                {selectedJob.requirements && (
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                      Qualifications & Requirements
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 whitespace-pre-line leading-relaxed">
                      {selectedJob.requirements}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-900 rounded-3xl p-12 text-center border border-slate-200 dark:border-slate-800">
                <Briefcase className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
                <p className="text-xs text-slate-400">Select a job from the list to view full specifications.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: My Applications */}
      {activeTab === 'my_applications' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-brand-500" /> Tracked Applications ({myApplications.length})
            </h2>
            <span className="text-xs text-slate-400">Real-time status synced with recruiters</span>
          </div>

          {myApplications.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-12 text-center border border-slate-200 dark:border-slate-800">
              <Briefcase className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">No applications yet</h3>
              <p className="text-xs text-slate-400 mt-1">Browse early-talent openings and submit your first application!</p>
              <button
                onClick={() => setActiveTab('browse')}
                className="mt-4 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold transition"
              >
                Browse Opportunities
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {myApplications.map((app) => (
                <div
                  key={app.application_id}
                  className="bg-white dark:bg-slate-900 p-5 rounded-3xl shadow-sm border border-slate-200/80 dark:border-slate-800 space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-bold text-sm text-slate-900 dark:text-white">{app.job_title}</h3>
                      <p className="text-xs text-slate-500 font-medium">{app.company_name} • {app.location}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {app.premium_escalated && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-gradient-to-r from-amber-400 to-orange-500 text-white">
                          ⚡ ESCALATED
                        </span>
                      )}
                      {getStatusBadge(app.status)}
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-xl">
                    <strong className="text-slate-400 block text-[10px] uppercase">Your Cover Note:</strong>
                    "{app.cover_note || 'Profile & Resume submission'}"
                  </p>

                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <span>Applied: {new Date(app.applied_at).toLocaleDateString()}</span>
                    <span className="font-semibold text-brand-600 dark:text-brand-400">{app.salary_range}</span>
                  </div>

                  {!app.premium_escalated && (
                    <button
                      onClick={() => handleEscalate(app.application_id)}
                      disabled={escalatingId === app.application_id}
                      className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 disabled:opacity-50 text-white font-bold rounded-xl text-[11px] transition shadow-sm"
                    >
                      <Zap className="w-3.5 h-3.5" />
                      <span>
                        {escalatingId === app.application_id
                          ? 'Escalating…'
                          : '⚡ Escalate for Faster Processing'}
                      </span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* AI Skill Gap Modal */}
      {skillGapModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-purple-100 dark:bg-purple-950/80 text-purple-600 flex items-center justify-center">
                  <Bot className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">AI Skill Gap Analysis</h3>
                  <p className="text-[11px] text-slate-400">{skillGapData?.jobTitle} @ {skillGapData?.companyName}</p>
                </div>
              </div>
              <button onClick={() => setSkillGapModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {loadingSkillGap ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full" />
                <p className="text-xs text-slate-400 mt-2">Analyzing technical match matrix...</p>
              </div>
            ) : skillGapData ? (
              <div className="space-y-4 text-xs">
                {/* Match Percentage Banner */}
                <div className="p-4 rounded-2xl bg-purple-50/70 dark:bg-purple-950/40 border border-purple-200/80 dark:border-purple-900/60 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-purple-700 dark:text-purple-300">Your Current Match Score</span>
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      {skillGapData.missingSkills.length === 0 ? 'You match 100% of required skills!' : `Bridge ${skillGapData.missingSkills.length} missing skill(s) to reach 100%`}
                    </p>
                  </div>
                  <span className="text-2xl font-black text-purple-700 dark:text-purple-300">
                    {skillGapData.matchPercentage}%
                  </span>
                </div>

                {/* Missing Skills & Recommended Learning Path */}
                {skillGapData.learningPath.length > 0 ? (
                  <div className="space-y-3">
                    <h4 className="font-bold text-xs text-slate-900 dark:text-white uppercase tracking-wider text-slate-400">
                      Personalized 3-Day Action Plan:
                    </h4>
                    {skillGapData.learningPath.map((item, idx) => (
                      <div key={idx} className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs text-purple-700 dark:text-purple-300">{item.skill}</span>
                          <span className="text-[10px] font-bold text-slate-400">{item.estimatedTime}</span>
                        </div>
                        <p className="text-slate-700 dark:text-slate-300 leading-snug">
                          <strong>Recommended Quick Project:</strong> {item.recommendedProject}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 rounded-2xl bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 font-medium">
                    🎉 Excellent! You have all the core skills needed for this role.
                  </div>
                )}

                <div className="pt-2 flex justify-end">
                  <button
                    onClick={() => setSkillGapModalOpen(false)}
                    className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold"
                  >
                    Got It
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Apply Modal */}
      {applyModalOpen && applyJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white">Apply to {applyJob.title}</h3>
                <p className="text-xs text-slate-500">{applyJob.company_name}</p>
              </div>
              <button onClick={() => setApplyModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitApplication} className="space-y-4 text-xs">
              {/* Profile Snapshot with Verified Badge */}
              <div className="p-3 rounded-2xl bg-brand-50/60 dark:bg-brand-950/40 border border-brand-200/80 dark:border-brand-900/60 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <img
                    src={user?.profile?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.username}`}
                    alt="Avatar"
                    className="w-10 h-10 rounded-full object-cover border border-brand-300"
                  />
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className="font-bold text-slate-900 dark:text-white">{user?.profile?.full_name || user?.username}</p>
                      {user?.aadhaar_verified ? (
                        <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300">
                          🛡️ Verified Talent
                        </span>
                      ) : null}
                    </div>
                    <p className="text-[10px] text-slate-500">{user?.profile?.headline || 'Early-Career Technologist'}</p>
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300 block">
                    Tailored Cover Note / Intro
                  </label>
                  <button
                    type="button"
                    onClick={handleGenerateAIPitch}
                    disabled={generatingPitch}
                    className="text-[11px] font-bold text-purple-600 dark:text-purple-400 flex items-center gap-1 hover:underline"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>{generatingPitch ? 'Generating...' : '1-Click AI Pitch Polish'}</span>
                  </button>
                </div>
                <textarea id="JobMarketplace-coverNote" name="coverNote"
                  rows={4}
                  value={coverNote}
                  onChange={(e) => setCoverNote(e.target.value)}
                  placeholder="Introduce yourself and explain why you're a great fit for this early-career role..."
                  className="w-full p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 resize-none focus:outline-none focus:ring-2 focus:ring-brand-500"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Resume / CV (PDF or Link)
                </label>
                <div className="flex items-center space-x-2">
                  <input id="JobMarketplace-resumeUrl" name="resumeUrl"
                    type="text"
                    value={resumeUrl}
                    onChange={(e) => setResumeUrl(e.target.value)}
                    placeholder="resume.pdf or https://yourdomain.com/resume.pdf"
                    className="flex-1 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                  />
                  <label className="px-3 py-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 rounded-xl cursor-pointer text-[11px] font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                    <span>Attach PDF</span>
                    <input
                      type="file"
                      accept=".pdf,.docx,.txt"
                      onChange={(e) => {
                        if (e.target.files[0]) {
                          setResumeFile(e.target.files[0]);
                          setResumeUrl(e.target.files[0].name);
                        }
                      }}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>


              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Portfolio / GitHub URL
                </label>
                <input id="JobMarketplace-portfolioUrl" name="portfolioUrl"
                  type="url"
                  value={portfolioUrl}
                  onChange={(e) => setPortfolioUrl(e.target.value)}
                  placeholder="https://github.com/yourhandle"
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="pt-3 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setApplyModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingApply || !coverNote.trim()}
                  className="px-6 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-bold shadow-md shadow-brand-500/20"
                >
                  {submittingApply ? 'Submitting...' : 'Submit Application'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
