import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  Building,
  Briefcase,
  Users,
  Plus,
  Edit3,
  Sparkles,
  ExternalLink,
  MessageSquare,
  FileText,
  X,
  MapPin,
  DollarSign,
  ChevronRight,
  TrendingUp,
  Upload,
  Zap,
} from 'lucide-react';

function RecruiterDashboardContent({ onOpenChat, onSelectUser }) {
  const { user } = useAuth();
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Selected Job to view Applicants Pipeline
  const [selectedJobPipeline, setSelectedJobPipeline] = useState(null);
  const [jobApplicantsData, setJobApplicantsData] = useState(null);
  const [loadingApplicants, setLoadingApplicants] = useState(false);

  // Post New Job Modal
  const [postJobModalOpen, setPostJobModalOpen] = useState(false);
  const [jobForm, setJobForm] = useState({
    title: '',
    description: '',
    requirements: '',
    location: 'Remote',
    workplace_type: 'Remote',
    job_type: 'Full-time',
    experience_level: 'Fresher',
    salary_range: '$80,000 - $105,000 / year',
    required_skills: 'React, Node.js, TypeScript, Tailwind CSS',
    premium: false
  });
  const [submittingJob, setSubmittingJob] = useState(false);

  // Packages view state
  const [showPackages, setShowPackages] = useState(false);

  // Company Profile Modal
  const [companyModalOpen, setCompanyModalOpen] = useState(false);
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState('');
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [companyForm, setCompanyForm] = useState({
    name: '',
    tagline: '',
    description: '',
    website: '',
    logo_url: '',
    location: '',
    industry: '',
    company_size: ''
  });

  useEffect(() => {
    fetchDashboard();
  }, []);

  async function fetchDashboard() {
    setLoading(true);
    try {
      const data = await api.getRecruiterDashboard();
      setDashboardData(data);
      if (data.company) {
        setCompanyForm({
          name: data.company.name || '',
          tagline: data.company.tagline || '',
          description: data.company.description || '',
          website: data.company.website || '',
          logo_url: data.company.logo_url || '',
          location: data.company.location || '',
          industry: data.company.industry || '',
          company_size: data.company.company_size || ''
        });
      }
    } catch (err) {
      console.error('Fetch dashboard error:', err);
    } finally {
      setLoading(false);
    }
  }

  async function openPipeline(job) {
    setSelectedJobPipeline(job);
    setLoadingApplicants(true);
    try {
      const data = await api.getJobApplicants(job.id);
      setJobApplicantsData(data);
    } catch (err) {
      console.error('Fetch applicants error:', err);
    } finally {
      setLoadingApplicants(false);
    }
  }

  async function handleUpdateStatus(applicationId, newStatus) {
    try {
      await api.updateApplicationStatus(applicationId, newStatus);
      if (selectedJobPipeline) {
        const data = await api.getJobApplicants(selectedJobPipeline.id);
        setJobApplicantsData(data);
      }
      await fetchDashboard();
    } catch (err) {
      alert(err.message || 'Failed to update status');
    }
  }

  async function handlePostJob(e) {
    e.preventDefault();
    if (!jobForm.title.trim() || !jobForm.description.trim()) return;

    setSubmittingJob(true);
    try {
      const skillsArray = jobForm.required_skills
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      await api.createJob({
        ...jobForm,
        required_skills: skillsArray
      });

      setPostJobModalOpen(false);
      setJobForm({
        title: '',
        description: '',
        requirements: '',
        location: 'Remote',
        workplace_type: 'Remote',
        job_type: 'Full-time',
        experience_level: 'Fresher',
        salary_range: '$80,000 - $105,000 / year',
        required_skills: 'React, Node.js, TypeScript, Tailwind CSS',
        premium: false
      });
      await fetchDashboard();
      alert('Job posted successfully! It is now live in the marketplace and announced on the feed. 🎉');
    } catch (err) {
      alert(err.message || 'Failed to post job');
    } finally {
      setSubmittingJob(false);
    }
  }

  async function handleSaveCompany(e) {
    e.preventDefault();
    try {
      await api.updateCompany(companyForm);
      setCompanyModalOpen(false);
      await fetchDashboard();
    } catch (err) {
      alert(err.message || 'Failed to update company');
    }
  }

  // Upload a company logo image file, then persist the returned URL
  async function handleLogoUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    // Local preview while uploading
    const reader = new FileReader();
    reader.onload = () => setLogoPreview(reader.result);
    reader.readAsDataURL(file);
    setLogoFile(file);

    setUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append('logo', file);
      const res = await api.uploadCompanyLogo(formData);
      if (res.success) {
        setCompanyForm((prev) => ({ ...prev, logo_url: res.logo_url }));
        await fetchDashboard();
      } else {
        setLogoFile(null);
        setLogoPreview('');
        alert(res.error || 'Logo upload failed');
      }
    } catch (err) {
      setLogoFile(null);
      setLogoPreview('');
      alert(err.message || 'Logo upload failed');
    } finally {
      setUploadingLogo(false);
    }
  }

  function clearLogo() {
    setLogoFile(null);
    setLogoPreview('');
    setCompanyForm((prev) => ({ ...prev, logo_url: '' }));
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center">
        <div className="inline-block animate-spin w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full" />
        <p className="text-xs text-slate-400 mt-2">Loading recruiter hub...</p>
      </div>
    );
  }

  const { company, jobs, totalJobs, totalApplicants, subscription } = dashboardData || {};

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Top Header Card */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-200/80 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <img
            src={company?.logo_url || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=100&auto=format&fit=crop&q=80'}
            alt={company?.name}
            className="w-16 h-16 rounded-2xl object-cover border border-slate-200 dark:border-slate-700 bg-white"
          />
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-black text-slate-900 dark:text-white">
                {company?.name || 'My Organization'}
              </h1>
              <button
                onClick={() => setCompanyModalOpen(true)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                title="Edit Company Info"
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">{company?.tagline || 'Early-Career Hiring Dashboard'}</p>
            <p className="text-[11px] text-slate-400 mt-1">{company?.location} • {company?.company_size}</p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => setPostJobModalOpen(true)}
            className="flex items-center space-x-1.5 px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-2xl text-xs font-bold transition shadow-md shadow-brand-500/25"
          >
            <Plus className="w-4 h-4" />
            <span>Post New Job</span>
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl shadow-sm border border-slate-200/80 dark:border-slate-800">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Active Job Postings</span>
          <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{totalJobs || 0}</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl shadow-sm border border-slate-200/80 dark:border-slate-800">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Candidate Applications</span>
          <p className="text-2xl font-black text-brand-600 dark:text-brand-400 mt-1">{totalApplicants || 0}</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl shadow-sm border border-slate-200/80 dark:border-slate-800">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Candidate Pipeline Status</span>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">Active Review</p>
        </div>
      </div>

      {/* Active Recruiter Package Subscription */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-sm border border-slate-200/80 dark:border-slate-800">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
            <DollarSign className="w-4 h-4 text-brand-500" /> Your Recruiter Package
          </h2>
          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
            subscription ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
              : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
          }`}>
            {subscription ? '● Active' : '○ No active package'}
          </span>
        </div>

        {subscription ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-bold text-slate-900 dark:text-white">{subscription.package_name}</h3>
              <span className="text-xs font-bold text-brand-600 dark:text-brand-400">₹{subscription.price}</span>
              {subscription.job_limit === -1 ? (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800">Unlimited</span>
              ) : null}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                <span className="block text-[10px] uppercase font-bold text-slate-400">Jobs Allowed</span>
                <span className="font-extrabold text-slate-900 dark:text-white">
                  {subscription.job_limit === -1 ? 'Unlimited' : subscription.job_limit}
                </span>
              </div>
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                <span className="block text-[10px] uppercase font-bold text-slate-400">Posted</span>
                <span className="font-extrabold text-slate-900 dark:text-white">{subscription.active_jobs || 0}</span>
              </div>
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                <span className="block text-[10px] uppercase font-bold text-slate-400">Duration</span>
                <span className="font-extrabold text-slate-900 dark:text-white">{subscription.duration_days} days</span>
              </div>
            </div>

            {subscription.job_limit > 0 && (
              <div>
                <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                  <span>Job posting quota used</span>
                  <span className="font-bold text-slate-700 dark:text-slate-300">
                    {subscription.active_jobs} / {subscription.job_limit}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-brand-500 rounded-full transition-all"
                    style={{ width: `${Math.min(100, (subscription.active_jobs / subscription.job_limit) * 100)}%` }}
                  />
                </div>
              </div>
            )}

            <p className="text-[11px] text-slate-400">
              Package valid until {new Date(subscription.end_date).toLocaleDateString()}.
              {subscription.job_limit === -1 ? 'Post as many jobs as you need.' : 'Upgrade your package to post more jobs.'}
            </p>
          </div>
        ) : (
          <div className="text-center py-6">
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">You don't have an active recruiter package yet.</p>
            <button
              onClick={() => setShowPackages(true)}
              className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold transition"
            >
              Browse Packages
            </button>
          </div>
        )}
      </div>

      {/* Posted Jobs & Candidate Applications Pipeline */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Posted Jobs List */}
        <div className="lg:col-span-5 space-y-3">
          <h2 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5 mb-2">
            <Briefcase className="w-4 h-4 text-brand-500" /> Your Posted Jobs ({jobs?.length || 0})
          </h2>

          {jobs?.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 text-center border border-slate-200 dark:border-slate-800">
              <p className="text-xs text-slate-400">No jobs posted yet. Click "Post New Job" to get started.</p>
            </div>
          ) : (
            jobs?.map((job) => {
              const isSelected = selectedJobPipeline?.id === job.id;
              return (
                <div
                  key={job.id}
                  onClick={() => openPipeline(job)}
                  className={`bg-white dark:bg-slate-900 p-5 rounded-3xl shadow-sm border cursor-pointer transition-all ${
                    isSelected
                      ? 'border-purple-500 ring-2 ring-purple-500/20 shadow-md'
                      : 'border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white line-clamp-1">
                        {job.title}
                      </h3>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {job.experience_level} • {job.workplace_type} • {job.job_type}
                      </p>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                      {job.total_applicants} Applicants
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <span>{job.salary_range}</span>
                    <span className="font-bold text-brand-600 dark:text-brand-400 flex items-center gap-0.5">
                      Review Pipeline <ChevronRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right: Candidate Applicants Pipeline */}
        <div className="lg:col-span-7">
          {selectedJobPipeline ? (
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-200/80 dark:border-slate-800 space-y-5">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                    Applicant Pipeline: {selectedJobPipeline.title}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Review candidate profiles, skill match scores, and progress their application.
                  </p>
                </div>
              </div>

              {loadingApplicants ? (
                <div className="text-center py-12">
                  <div className="inline-block animate-spin w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full" />
                  <p className="text-xs text-slate-400 mt-2">Loading candidate pipeline...</p>
                </div>
              ) : jobApplicantsData?.applicants?.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-xs">
                  No applications received yet for this position.
                </div>
              ) : (
                <div className="space-y-4">
                  {jobApplicantsData?.applicants?.map((app) => (
                    <div
                      key={app.application_id}
                      className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 space-y-4"
                    >
                      {/* Candidate Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div
                          onClick={() => onSelectUser && onSelectUser(app.candidate_id)}
                          className="flex items-center space-x-3 cursor-pointer"
                        >
                          <img
                            src={app.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${app.username}`}
                            alt={app.full_name}
                            className="w-12 h-12 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                          />
                          <div>
                            <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white hover:text-brand-600 transition">
                              {app.full_name || app.username}
                            </h4>
                            <p className="text-[11px] text-slate-500 line-clamp-1">{app.headline}</p>
                            <p className="text-[10px] text-slate-400">{app.location} • Applied {new Date(app.applied_at).toLocaleDateString()}</p>
                          </div>
                        </div>

                        {/* Match Score Badge */}
                        <div className="flex items-center space-x-2">
                          <span className="px-3 py-1 rounded-xl text-xs font-bold bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800 flex items-center gap-1">
                            <Sparkles className="w-3 h-3 text-amber-500" />
                            <span>{app.matchScore}% Match</span>
                          </span>

                          <button
                            onClick={() => onOpenChat && onOpenChat(app.candidate_id)}
                            className="p-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl transition"
                            title="Direct Message"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Candidate Cover Note */}
                      {app.cover_note && (
                        <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200/60 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300">
                          <strong className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Cover Note:</strong>
                          <p className="italic">"{app.cover_note}"</p>
                        </div>
                      )}

                      {/* Candidate Skills */}
                      {app.skills && app.skills.length > 0 && (
                        <div>
                          <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Candidate Verified Skills:</span>
                          <div className="flex flex-wrap gap-1.5">
                            {app.skills.map((s, idx) => (
                              <span
                                key={idx}
                                className="text-[10px] px-2 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-semibold text-slate-700 dark:text-slate-300"
                              >
                                {s.name} ({s.proficiency})
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Resume / Portfolio links */}
                      <div className="flex items-center space-x-3 text-xs pt-1">
                        {app.resume_url && (
                          <a
                            href={app.resume_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-brand-600 dark:text-brand-400 font-semibold flex items-center gap-1 hover:underline"
                          >
                            <FileText className="w-3.5 h-3.5" /> View Resume / CV
                          </a>
                        )}
                        {app.portfolio_url && (
                          <a
                            href={app.portfolio_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-slate-600 dark:text-slate-300 font-semibold flex items-center gap-1 hover:underline"
                          >
                            <ExternalLink className="w-3.5 h-3.5" /> Portfolio
                          </a>
                        )}
                      </div>

                      {/* Status Management Actions */}
                      <div className="pt-3 border-t border-slate-200/80 dark:border-slate-700/80 flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs text-slate-500">
                          Current Status: <strong className="text-slate-900 dark:text-white capitalize">{app.status.replace('_', ' ')}</strong>
                        </span>

                        <div className="flex flex-wrap gap-1.5 text-xs font-bold">
                          <button
                            onClick={() => handleUpdateStatus(app.application_id, 'under_review')}
                            className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/60 dark:text-amber-300 transition"
                          >
                            Review
                          </button>
                          <button
                            onClick={() => handleUpdateStatus(app.application_id, 'shortlisted')}
                            className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300 transition"
                          >
                            Shortlist 🎉
                          </button>
                          <button
                            onClick={() => handleUpdateStatus(app.application_id, 'interview')}
                            className="px-2.5 py-1 rounded-lg bg-purple-50 text-purple-700 hover:bg-purple-100 dark:bg-purple-950/60 dark:text-purple-300 transition"
                          >
                            Interview 🗓️
                          </button>
                          <button
                            onClick={() => handleUpdateStatus(app.application_id, 'hired')}
                            className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition"
                          >
                            Hire / Offer 🚀
                          </button>
                          <button
                            onClick={() => handleUpdateStatus(app.application_id, 'rejected')}
                            className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 transition"
                          >
                            Archive
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-12 text-center border border-slate-200 dark:border-slate-800">
              <Users className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">Select a Job</h3>
              <p className="text-xs text-slate-400 mt-1">Select any job on the left to view candidates in the hiring pipeline.</p>
            </div>
          )}
        </div>
      </div>

      {/* Post New Job Modal */}
      {postJobModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <h3 className="font-bold text-base text-slate-900 dark:text-white">Post Early-Career Opportunity</h3>
              <button onClick={() => setPostJobModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePostJob} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Job Title</label>
                <input id="RecruiterDashboard-title" name="title"
                  type="text"
                  value={jobForm.title}
                  onChange={(e) => setJobForm({ ...jobForm, title: e.target.value })}
                  placeholder="e.g. Junior Full-Stack Developer (2026 Cohort)"
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Experience Level</label>
                  <select id="RecruiterDashboard-experience_level" name="experience_level"
                    value={jobForm.experience_level}
                    onChange={(e) => setJobForm({ ...jobForm, experience_level: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  >
                    <option value="Fresher">🎓 Fresher / New Grad</option>
                    <option value="Internship">🚀 Internship</option>
                    <option value="0-1 years">0-1 years</option>
                    <option value="1-3 years">1-3 years</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Workplace Type</label>
                  <select id="RecruiterDashboard-workplace_type" name="workplace_type"
                    value={jobForm.workplace_type}
                    onChange={(e) => setJobForm({ ...jobForm, workplace_type: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  >
                    <option value="Remote">Remote</option>
                    <option value="Hybrid">Hybrid</option>
                    <option value="On-site">On-site</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Location</label>
                  <input id="RecruiterDashboard-location" name="location"
                    type="text"
                    value={jobForm.location}
                    onChange={(e) => setJobForm({ ...jobForm, location: e.target.value })}
                    placeholder="e.g. San Francisco, CA / Remote"
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Salary / Stipend</label>
                  <input id="RecruiterDashboard-salary_range" name="salary_range"
                    type="text"
                    value={jobForm.salary_range}
                    onChange={(e) => setJobForm({ ...jobForm, salary_range: e.target.value })}
                    placeholder="e.g. $85,000 - $105,000 / year"
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Required Skills (comma-separated)</label>
                <input id="RecruiterDashboard-required_skills" name="required_skills"
                  type="text"
                  value={jobForm.required_skills}
                  onChange={(e) => setJobForm({ ...jobForm, required_skills: e.target.value })}
                  placeholder="React, TypeScript, Node.js, SQL"
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Job Description</label>
                <textarea id="RecruiterDashboard-description" name="description"
                  rows={3}
                  value={jobForm.description}
                  onChange={(e) => setJobForm({ ...jobForm, description: e.target.value })}
                  placeholder="Describe the role, mentorship opportunities, and product impact..."
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 resize-none"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Requirements / Qualifications</label>
                <textarea id="RecruiterDashboard-requirements" name="requirements"
                  rows={2}
                  value={jobForm.requirements}
                  onChange={(e) => setJobForm({ ...jobForm, requirements: e.target.value })}
                  placeholder="• Basic knowledge of React..."
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 resize-none"
                />
              </div>

              <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={jobForm.premium}
                    onChange={(e) => setJobForm({ ...jobForm, premium: e.target.checked })}
                    className="mt-0.5 w-4 h-4 rounded accent-amber-500"
                  />
                  <div>
                    <p className="font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1">
                      <Zap className="w-3.5 h-3.5 text-amber-500" />
                      Post as Premium Job (Faster Process)
                    </p>
                    <p className="text-[10px] text-amber-700 dark:text-amber-400 mt-0.5">
                      Premium jobs are pinned to the top of the Job Hub and get priority screening so
                      applicants are processed faster. Available with a recruiter package or to admins.
                    </p>
                  </div>
                </label>
              </div>

              <div className="pt-3 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setPostJobModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingJob}
                  className="px-6 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-bold shadow-md"
                >
                  {submittingJob ? 'Publishing...' : 'Publish Job'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Company Profile Modal */}
      {companyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
            <h3 className="font-bold text-base text-slate-900 dark:text-white mb-3">Update Company Profile</h3>
            <form onSubmit={handleSaveCompany} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Company Name</label>
                <input id="RecruiterDashboard-name" name="name"
                  type="text"
                  value={companyForm.name}
                  onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Tagline</label>
                <input id="RecruiterDashboard-tagline" name="tagline"
                  type="text"
                  value={companyForm.tagline}
                  onChange={(e) => setCompanyForm({ ...companyForm, tagline: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Industry & Size</label>
                <div className="grid grid-cols-2 gap-2">
                  <input id="RecruiterDashboard-industry" name="industry"
                    type="text"
                    value={companyForm.industry}
                    onChange={(e) => setCompanyForm({ ...companyForm, industry: e.target.value })}
                    placeholder="Software / AI"
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  />
                  <input id="RecruiterDashboard-company_size" name="company_size"
                    type="text"
                    value={companyForm.company_size}
                    onChange={(e) => setCompanyForm({ ...companyForm, company_size: e.target.value })}
                    placeholder="50-200 employees"
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Company Logo</label>

                {/* Logo preview */}
                {(logoPreview || companyForm.logo_url) && (
                  <div className="flex items-center gap-3 mb-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    <img
                      src={logoPreview}
                      alt="Company logo"
                      className="w-12 h-12 rounded-xl object-cover border border-slate-200 dark:border-slate-700 bg-white"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-bold text-slate-600 dark:text-slate-300 truncate">
                        {logoFile ? logoFile.name : 'Current logo'}
                      </p>
                      {uploadingLogo && (
                        <p className="text-[10px] text-brand-600 dark:text-brand-400">Uploading...</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={clearLogo}
                      disabled={uploadingLogo}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition"
                      title="Remove logo"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* File picker */}
                <label className="flex items-center justify-center gap-2 w-full p-3 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-brand-500 hover:bg-brand-50 dark:hover:bg-brand-950/30 cursor-pointer transition">
                  <Upload className="w-4 h-4 text-slate-400" />
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {uploadingLogo ? 'Uploading...' : 'Upload logo image (max 5MB)'}
                  </span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleLogoUpload}
                    disabled={uploadingLogo}
                    className="hidden"
                  />
                </label>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">About Company</label>
                <textarea id="RecruiterDashboard-description" name="description"
                  rows={3}
                  value={companyForm.description}
                  onChange={(e) => setCompanyForm({ ...companyForm, description: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 resize-none"
                />
              </div>

              <div className="pt-3 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setCompanyModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold"
                >
                  Save Company
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

import RecruiterPackages from './RecruiterPackages';

export default function RecruiterDashboard({ onOpenChat, onSelectUser }) {
  const [showPackages, setShowPackages] = useState(false);

  if (showPackages) {
    return <RecruiterPackages onNavigateBack={() => setShowPackages(false)} />;
  }

  return <RecruiterDashboardContent onOpenChat={onOpenChat} onSelectUser={onSelectUser} showPackages={setShowPackages} />;
}
