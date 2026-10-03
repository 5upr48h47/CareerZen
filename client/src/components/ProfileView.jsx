import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  MapPin,
  Briefcase,
  GraduationCap,
  FolderGit2,
  ExternalLink,
  Github,
  Linkedin,
  Globe,
  Plus,
  Trash2,
  Edit3,
  UserPlus,
  UserCheck,
  Clock,
  MessageSquare,
  Sparkles,
  CheckCircle,
  X,
  ShieldCheck,
  Image,
  Camera,
  Loader2,
  Crown,
  Zap,
} from 'lucide-react';
import AadhaarVerificationModal from './AadhaarVerificationModal';


export default function ProfileView({ userId, onOpenChat, onSelectUser }) {
  const { user: currentUser, openAuthModal, refreshUser } = useAuth();
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Edit Profile Modal
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [uploading, setUploading] = useState({ avatar: false, banner: false });
  const avatarInputRef = useRef(null);
  const bannerInputRef = useRef(null);

  // Add Skill Modal
  const [skillModalOpen, setSkillModalOpen] = useState(false);
  const [skillForm, setSkillForm] = useState({ name: '', category: 'Frontend', proficiency: 'Intermediate' });

  // Add Project Modal
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [projectForm, setProjectForm] = useState({ title: '', description: '', liveUrl: '', githubUrl: '', tech: '' });

  // Add Education & Experience Modals
  const [aadhaarModalOpen, setAadhaarModalOpen] = useState(false);
  const [eduModalOpen, setEduModalOpen] = useState(false);
  const [eduForm, setEduForm] = useState({ school: '', degree: '', year: '2022 - 2026', grade: '' });
  const [expModalOpen, setExpModalOpen] = useState(false);
  const [expForm, setExpForm] = useState({ role: '', company: '', period: '2024 - Present', description: '' });


  const targetId = userId || currentUser?.id;
  const isOwnProfile = currentUser && currentUser.id === Number(targetId);

  useEffect(() => {
    if (targetId) {
      fetchProfile();
    }
  }, [targetId]);

  async function fetchProfile() {
    setLoading(true);
    try {
      const data = await api.getProfile(targetId);
      setProfileData(data);
      setEditForm({
        full_name: data.profile?.full_name || data.username,
        headline: data.profile?.headline || '',
        bio: data.profile?.bio || '',
        location: data.profile?.location || '',
        target_role: data.profile?.target_role || '',
        avatar_url: data.profile?.avatar_url || '',
        banner_url: data.profile?.banner_url || '',
        education: data.profile?.education || [],
        experience: data.profile?.experience || [],
        projects: data.profile?.projects || [],
        social_links: data.profile?.social_links || {}
      });
    } catch (err) {
      console.error('Fetch profile error:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveProfile(e) {
    e.preventDefault();
    try {
      await api.updateProfile(editForm);
      setEditModalOpen(false);
      await fetchProfile();
      await refreshUser();
    } catch (err) {
      console.error('Update profile error:', err);
    }
  }

  async function handleAvatarUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(prev => ({ ...prev, avatar: true }));
    try {
      const formData = new FormData();
      formData.append('avatar', file);
      const result = await api.uploadAvatar(formData);
      if (result.success) {
        setEditForm(prev => ({ ...prev, avatar_url: result.avatar_url }));
        setProfileData(prev => ({
          ...prev,
          profile: { ...prev.profile, avatar_url: result.avatar_url }
        }));
        if (refreshUser) refreshUser();
      } else {
        alert(result.error || 'Upload failed');
      }
    } catch (err) {
      alert(err.message || 'Avatar upload failed');
    } finally {
      setUploading(prev => ({ ...prev, avatar: false }));
    }
  }

  async function handleRemoveAvatar() {
    if (!confirm('Remove your profile picture? It will revert to the default avatar.')) return;
    try {
      await api.updateProfile({ avatar_url: '' });
      setEditForm(prev => ({ ...prev, avatar_url: '' }));
      setProfileData(prev => ({
        ...prev,
        profile: { ...prev.profile, avatar_url: '' }
      }));
      if (refreshUser) refreshUser();
    } catch (err) {
      alert(err.message || 'Failed to remove avatar');
    }
  }

  async function handleRemoveBanner() {
    if (!confirm('Remove your background banner? It will revert to the default gradient.')) return;
    try {
      await api.updateProfile({ banner_url: '' });
      setEditForm(prev => ({ ...prev, banner_url: '' }));
      setProfileData(prev => ({
        ...prev,
        profile: { ...prev.profile, banner_url: '' }
      }));
      if (refreshUser) refreshUser();
    } catch (err) {
      alert(err.message || 'Failed to remove banner');
    }
  }

  async function handleBannerUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(prev => ({ ...prev, banner: true }));
    try {
      const formData = new FormData();
      formData.append('banner', file);
      const result = await api.uploadBanner(formData);
      if (result.success) {
        setEditForm(prev => ({ ...prev, banner_url: result.banner_url }));
        setProfileData(prev => ({
          ...prev,
          profile: { ...prev.profile, banner_url: result.banner_url }
        }));
      } else {
        alert(result.error || 'Upload failed');
      }
    } catch (err) {
      alert(err.message || 'Banner upload failed');
    } finally {
      setUploading(prev => ({ ...prev, banner: false }));
    }
  }

  async function handleAddSkill(e) {
    e.preventDefault();
    if (!skillForm.name.trim()) return;

    try {
      await api.addSkill(skillForm);
      setSkillModalOpen(false);
      setSkillForm({ name: '', category: 'Frontend', proficiency: 'Intermediate' });
      await fetchProfile();
      await refreshUser();
    } catch (err) {
      alert(err.message || 'Failed to add skill');
    }
  }

  async function handleDeleteSkill(skillId) {
    try {
      await api.deleteSkill(skillId);
      await fetchProfile();
      await refreshUser();
    } catch (err) {
      console.error('Delete skill error:', err);
    }
  }

  async function handleAddProject(e) {
    e.preventDefault();
    if (!projectForm.title.trim()) return;

    const techArray = projectForm.tech
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const newProject = {
      title: projectForm.title.trim(),
      description: projectForm.description.trim(),
      liveUrl: projectForm.liveUrl.trim(),
      githubUrl: projectForm.githubUrl.trim(),
      tech: techArray
    };

    const updatedProjects = [...(profileData.profile?.projects || []), newProject];

    try {
      await api.updateProfile({ projects: updatedProjects });
      setProjectModalOpen(false);
      setProjectForm({ title: '', description: '', liveUrl: '', githubUrl: '', tech: '' });
      await fetchProfile();
    } catch (err) {
      console.error('Add project error:', err);
    }
  }

  async function handleAddEducation(e) {
    e.preventDefault();
    if (!eduForm.school.trim()) return;

    const newEdu = {
      school: eduForm.school.trim(),
      degree: eduForm.degree.trim(),
      year: eduForm.year.trim(),
      gpa: eduForm.grade.trim()
    };

    const updated = [...(profileData.profile?.education || []), newEdu];
    try {
      await api.updateProfile({ education: updated });
      setEduModalOpen(false);
      setEduForm({ school: '', degree: '', year: '2022 - 2026', grade: '' });
      await fetchProfile();
      await refreshUser();
    } catch (err) {
      console.error('Add education error:', err);
    }
  }

  async function handleAddExperience(e) {
    e.preventDefault();
    if (!expForm.role.trim() || !expForm.company.trim()) return;

    const newExp = {
      role: expForm.role.trim(),
      company: expForm.company.trim(),
      period: expForm.period.trim(),
      description: expForm.description.trim()
    };

    const updated = [...(profileData.profile?.experience || []), newExp];
    try {
      await api.updateProfile({ experience: updated });
      setExpModalOpen(false);
      setExpForm({ role: '', company: '', period: '2024 - Present', description: '' });
      await fetchProfile();
      await refreshUser();
    } catch (err) {
      console.error('Add experience error:', err);
    }
  }


  async function handleConnect() {
    if (!currentUser) return openAuthModal();
    try {
      await api.sendConnectionRequest(targetId);
      setProfileData((prev) => ({ ...prev, connectionStatus: 'pending_sent' }));
    } catch (err) {
      alert(err.message || 'Connection request failed');
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <div className="inline-block animate-spin w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full" />
        <p className="text-xs text-slate-400 mt-2">Loading profile...</p>
      </div>
    );
  }

  if (!profileData) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <p className="text-sm text-slate-500">Profile not found.</p>
      </div>
    );
  }

  const { profile, skills, company, stats, connectionStatus } = profileData;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Profile Header Banner & Card */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200/80 dark:border-slate-800 overflow-hidden">
        {/* Cover Banner */}
        <div className="h-44 sm:h-52 bg-gradient-to-r from-brand-600 via-indigo-600 to-purple-600 relative group cursor-pointer overflow-hidden"
           onClick={() => !uploading?.banner && bannerInputRef.current?.click()}>
          <input type="file" accept="image/*" ref={bannerInputRef} onChange={handleBannerUpload} className="hidden" />
          {profile?.banner_url && (
            <img
              src={profile.banner_url}
              alt="Banner"
              className="w-full h-full object-cover opacity-60 transition group-hover:brightness-75"
            />
          )}
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition">
            {uploading?.banner ? (
              <Loader2 className="w-8 h-8 text-white animate-spin" />
            ) : (
              <div className="flex flex-col items-center gap-1">
                <Image className="w-8 h-8 text-white" />
                <span className="text-xs text-white font-bold">Change Banner</span>
              </div>
            )}
          </div>
          {profile?.banner_url && isOwnProfile && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); handleRemoveBanner(); }}
              className="absolute top-2 right-2 w-7 h-7 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition shadow-sm"
              title="Remove banner"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Profile Info Container */}
        <div className="px-6 pb-6 pt-0 relative">
          <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between -mt-16 sm:-mt-20 gap-4 mb-4">
            <div className="flex items-end space-x-4">
              <div className="relative group">
                <img
                  src={profile?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profileData.username}`}
                  alt={profile?.full_name}
                  className="w-28 h-28 sm:w-32 sm:h-32 rounded-3xl object-cover border-4 border-white dark:border-slate-900 shadow-xl bg-white dark:bg-slate-800 cursor-pointer transition group-hover:brightness-75"
                  onClick={() => !uploading?.avatar && avatarInputRef.current?.click()}
                />
                <div
                  className="absolute inset-0 flex items-center justify-center rounded-3xl cursor-pointer bg-black/40 opacity-0 group-hover:opacity-100 transition"
                  onClick={() => !uploading?.avatar && avatarInputRef.current?.click()}
                >
                  {uploading?.avatar ? (
                    <Loader2 className="w-6 h-6 text-white animate-spin" />
                  ) : (
                    <Camera className="w-6 h-6 text-white" />
                  )}
                </div>
                {profile?.avatar_url && isOwnProfile && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleRemoveAvatar(); }}
                    className="absolute -bottom-1.5 -right-1.5 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center border-2 border-white dark:border-slate-900 hover:bg-red-600 transition shadow-sm"
                    title="Remove profile picture"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <input type="file" accept="image/*" ref={avatarInputRef} onChange={handleAvatarUpload} className="hidden" />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center space-x-2 w-full sm:w-auto">
              {isOwnProfile ? (
                <button
                  onClick={() => setEditModalOpen(true)}
                  className="flex items-center justify-center space-x-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold transition shadow-sm"
                >
                  <Edit3 className="w-4 h-4" />
                  <span>Edit Profile</span>
                </button>
              ) : (
                <>
                  {connectionStatus === 'connected' ? (
                    <span className="flex items-center space-x-1.5 px-4 py-2 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 rounded-xl text-xs font-bold border border-emerald-200 dark:border-emerald-800">
                      <UserCheck className="w-4 h-4" />
                      <span>Connected</span>
                    </span>
                  ) : connectionStatus === 'pending_sent' ? (
                    <span className="flex items-center space-x-1.5 px-4 py-2 bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 rounded-xl text-xs font-bold border border-amber-200 dark:border-amber-800">
                      <Clock className="w-4 h-4" />
                      <span>Request Sent</span>
                    </span>
                  ) : (
                    <button
                      onClick={handleConnect}
                      className="flex items-center justify-center space-x-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold transition shadow-md shadow-brand-500/20"
                    >
                      <UserPlus className="w-4 h-4" />
                      <span>Connect</span>
                    </button>
                  )}

                  <button
                    onClick={() => onOpenChat && onOpenChat(profileData.id)}
                    className="flex items-center justify-center space-x-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold transition"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>Message</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Hint: click on avatar or banner to upload (own profile) */}
          {isOwnProfile && (
            <div className="flex items-center gap-4 mt-2 text-[11px] text-slate-400">
              <span className="flex items-center gap-1"><Camera className="w-3 h-3" /></span>
              <span className="flex items-center gap-1"><Image className="w-3 h-3" /></span>
            </div>
          )}

          {/* Name & Headline */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-black text-slate-900 dark:text-white">
                {profile?.full_name || profileData.username}
              </h1>

              {/* Aadhaar & Student KYC Verified Badge */}
              {(profileData.aadhaar_verified || (isOwnProfile && currentUser?.aadhaar_verified)) && (
                <span
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 shadow-sm"
                  title={`UIDAI Aadhaar Verified: ${profileData.aadhaar_masked || currentUser?.aadhaar_masked || 'XXXX-XXXX-9842'}`}
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Aadhaar Verified Talent</span>
                </span>
              )}

              {/* Premium plan badge — driven by the user's active subscription */}
              {(() => {
                const plan = isOwnProfile
                  ? currentUser?.premium_plan
                  : profileData.premium_plan;
                if (!plan || plan === 'free') return null;
                const isPro = plan === 'pro';
                return (
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border shadow-sm ${
                      isPro
                        ? 'bg-purple-100 text-purple-700 dark:bg-purple-950/80 dark:text-purple-300 border-purple-300 dark:border-purple-700'
                        : 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border-amber-300 dark:border-amber-700'
                    }`}
                    title={
                      isPro
                        ? 'Pro plan — includes every Premium feature plus Featured Profile, Interview Coaching, Salary Insights and Profile Analytics.'
                        : 'Premium plan — Unlimited Applications, AI Resume Review, Priority Support and Unlimited Connections.'
                    }
                  >
                    {isPro ? (
                      <Crown className="w-3.5 h-3.5 text-purple-600" />
                    ) : (
                      <Zap className="w-3.5 h-3.5 text-amber-600" />
                    )}
                    <span>{isPro ? '👑 Pro' : '⚡ Premium'}</span>
                  </span>
                );
              })()}

              {profileData.role === 'recruiter' ? (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-700 dark:bg-purple-950/80 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                  🏢 Recruiter {company ? `@ ${company.name}` : ''}
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> Open to Opportunities
                </span>
              )}
            </div>

            <p className="text-sm font-medium text-slate-700 dark:text-slate-300 leading-relaxed">
              {profile?.headline || 'Early-Career Technologist'}
            </p>

            {profile?.location && (
              <div className="flex items-center text-xs text-slate-500 dark:text-slate-400 gap-1 pt-1">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                <span>{profile.location}</span>
                <span className="mx-2">•</span>
                <span className="font-semibold text-brand-600 dark:text-brand-400">
                  {stats?.connectionsCount || 0} Connections
                </span>
              </div>
            )}

            {/* Verification prompt banner for own unverified profile */}
            {isOwnProfile && !currentUser?.aadhaar_verified && (
              <div className="mt-3 p-3.5 rounded-2xl bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 dark:from-emerald-950/40 dark:via-teal-950/40 dark:to-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
                <div className="flex items-center space-x-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center flex-shrink-0 shadow-md">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-xs text-slate-900 dark:text-white flex items-center gap-1">
                      Verify Your Profile with Aadhaar & Student ID
                    </h4>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">
                      Get the official verified badge, boost recruiter visibility by 3.8x, and apply to exclusive verified roles.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setAadhaarModalOpen(true)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition shadow-md shadow-emerald-500/20 whitespace-nowrap self-start sm:self-auto flex items-center gap-1.5"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Verify Identity</span>
                </button>
              </div>
            )}


            {/* Social Links */}
            {profile?.social_links && Object.keys(profile.social_links).length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2">
                {profile.social_links.github && (
                  <a
                    href={profile.social_links.github}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-brand-600 transition"
                  >
                    <Github className="w-3.5 h-3.5" />
                    <span>GitHub</span>
                  </a>
                )}
                {profile.social_links.linkedin && (
                  <a
                    href={profile.social_links.linkedin}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-brand-600 transition"
                  >
                    <Linkedin className="w-3.5 h-3.5" />
                    <span>LinkedIn</span>
                  </a>
                )}
                {profile.social_links.portfolio && (
                  <a
                    href={profile.social_links.portfolio}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-brand-600 transition"
                  >
                    <Globe className="w-3.5 h-3.5" />
                    <span>Portfolio</span>
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Bio / Summary */}
          {profile?.bio && (
            <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              {profile.bio}
            </div>
          )}
        </div>
      </div>

      {/* Skills Section */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200/80 dark:border-slate-800 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-brand-500" /> Verified Skills & Tech Stack
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Highlight your core programming languages, frameworks, and tools.
            </p>
          </div>
          {isOwnProfile && (
            <button
              onClick={() => setSkillModalOpen(true)}
              className="flex items-center space-x-1 px-3 py-1.5 bg-brand-50 hover:bg-brand-100 dark:bg-brand-950/60 dark:hover:bg-brand-900/60 text-brand-700 dark:text-brand-300 rounded-xl text-xs font-bold transition border border-brand-200 dark:border-brand-800"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Skill</span>
            </button>
          )}
        </div>

        {skills && skills.length > 0 ? (
          <div className="flex flex-wrap gap-2.5">
            {skills.map((skill) => (
              <div
                key={skill.id}
                className="group flex items-center space-x-2 px-3.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-800 dark:text-slate-200 shadow-sm"
              >
                <span>{skill.name}</span>
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-brand-100 text-brand-700 dark:bg-brand-900/60 dark:text-brand-300">
                  {skill.proficiency}
                </span>
                {isOwnProfile && (
                  <button
                    onClick={() => handleDeleteSkill(skill.id)}
                    className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 transition ml-1"
                    title="Remove skill"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 text-slate-400 text-xs">
            No skills added yet. {isOwnProfile && 'Click "Add Skill" above to showcase your capabilities!'}
          </div>
        )}
      </div>

      {/* Projects Showcase */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200/80 dark:border-slate-800 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <FolderGit2 className="w-4 h-4 text-brand-500" /> Featured Projects
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Show recruiters your real-world software, GitHub repos, and live deployments.
            </p>
          </div>
          {isOwnProfile && (
            <button
              onClick={() => setProjectModalOpen(true)}
              className="flex items-center space-x-1 px-3 py-1.5 bg-brand-50 hover:bg-brand-100 dark:bg-brand-950/60 dark:hover:bg-brand-900/60 text-brand-700 dark:text-brand-300 rounded-xl text-xs font-bold transition border border-brand-200 dark:border-brand-800"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Project</span>
            </button>
          )}
        </div>

        {profile?.projects && profile.projects.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {profile.projects.map((proj, idx) => (
              <div
                key={idx}
                className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <h3 className="font-bold text-slate-900 dark:text-white text-sm">{proj.title}</h3>
                    <div className="flex items-center space-x-1.5">
                      {proj.githubUrl && (
                        <a
                          href={proj.githubUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-slate-400 hover:text-slate-800 dark:hover:text-white"
                          title="GitHub Repository"
                        >
                          <Github className="w-4 h-4" />
                        </a>
                      )}
                      {proj.liveUrl && (
                        <a
                          href={proj.liveUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-brand-600 hover:text-brand-700"
                          title="Live Demo"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-2 leading-relaxed">
                    {proj.description}
                  </p>
                </div>

                {proj.tech && proj.tech.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-3 pt-3 border-t border-slate-200/50 dark:border-slate-700/50">
                    {proj.tech.map((t, tIdx) => (
                      <span
                        key={tIdx}
                        className="text-[10px] px-2 py-0.5 rounded bg-white dark:bg-slate-800 font-semibold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 text-slate-400 text-xs">
            No projects added yet. {isOwnProfile && 'Add your open-source projects or class capstones!'}
          </div>
        )}
      </div>

      {/* Education & Experience Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Education */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200/80 dark:border-slate-800 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-brand-500" /> Education
            </h2>
            {isOwnProfile && (
              <button
                type="button"
                onClick={() => setEduModalOpen(true)}
                className="flex items-center space-x-1 px-2.5 py-1 bg-brand-50 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300 rounded-lg text-xs font-bold hover:bg-brand-100 transition"
              >
                <Plus className="w-3 h-3" />
                <span>Add</span>
              </button>
            )}
          </div>
          {profile?.education && profile.education.length > 0 ? (
            <div className="space-y-4">
              {profile.education.map((edu, idx) => (
                <div key={idx} className="border-l-2 border-brand-500 pl-3">
                  <h3 className="font-bold text-xs text-slate-900 dark:text-white">{edu.school}</h3>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300">{edu.degree}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{edu.year} {edu.gpa ? `• GPA: ${edu.gpa}` : ''}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400">No education entries listed.</p>
          )}
        </div>

        {/* Experience */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200/80 dark:border-slate-800 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-brand-500" /> Experience & Internships
            </h2>
            {isOwnProfile && (
              <button
                type="button"
                onClick={() => setExpModalOpen(true)}
                className="flex items-center space-x-1 px-2.5 py-1 bg-brand-50 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300 rounded-lg text-xs font-bold hover:bg-brand-100 transition"
              >
                <Plus className="w-3 h-3" />
                <span>Add</span>
              </button>
            )}
          </div>
          {profile?.experience && profile.experience.length > 0 ? (
            <div className="space-y-4">
              {profile.experience.map((exp, idx) => (
                <div key={idx} className="border-l-2 border-indigo-500 pl-3">
                  <h3 className="font-bold text-xs text-slate-900 dark:text-white">{exp.role}</h3>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300">{exp.company} • <span className="text-slate-400">{exp.period}</span></p>
                  <p className="text-[10px] text-slate-500 mt-1 leading-snug">{exp.description}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400">No previous work experience listed.</p>
          )}
        </div>
      </div>


      {/* Edit Profile Modal */}
      {editModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <h3 className="font-bold text-base text-slate-900 dark:text-white">Edit Profile</h3>
              <button onClick={() => setEditModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Full Name</label>
                <input id="ProfileView-full_name" name="full_name"
                  type="text"
                  value={editForm.full_name || ''}
                  onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Headline</label>
                <input id="ProfileView-headline" name="headline"
                  type="text"
                  value={editForm.headline || ''}
                  onChange={(e) => setEditForm({ ...editForm, headline: e.target.value })}
                  placeholder="e.g. CS Senior @ Berkeley | Aspiring Full-Stack & AI Engineer"
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Bio / Summary</label>
                <textarea id="ProfileView-bio" name="bio"
                  rows={3}
                  value={editForm.bio || ''}
                  onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 resize-none"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Location</label>
                <input id="ProfileView-location" name="location"
                  type="text"
                  value={editForm.location || ''}
                  onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                  placeholder="e.g. San Francisco, CA (Open to Remote)"
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Social Links</label>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Github className="w-4 h-4 text-slate-400 shrink-0" />
                    <input id="ProfileView-social_github" name="social_github"
                      type="url"
                      value={editForm.social_links?.github || ''}
                      onChange={(e) => setEditForm({ ...editForm, social_links: { ...editForm.social_links, github: e.target.value } })}
                      placeholder="https://github.com/yourhandle"
                      className="flex-1 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Linkedin className="w-4 h-4 text-slate-400 shrink-0" />
                    <input id="ProfileView-social_linkedin" name="social_linkedin"
                      type="url"
                      value={editForm.social_links?.linkedin || ''}
                      onChange={(e) => setEditForm({ ...editForm, social_links: { ...editForm.social_links, linkedin: e.target.value } })}
                      placeholder="https://linkedin.com/in/yourhandle"
                      className="flex-1 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-slate-400 shrink-0" />
                    <input id="ProfileView-social_portfolio" name="social_portfolio"
                      type="url"
                      value={editForm.social_links?.portfolio || ''}
                      onChange={(e) => setEditForm({ ...editForm, social_links: { ...editForm.social_links, portfolio: e.target.value } })}
                      placeholder="https://your-portfolio.com"
                      className="flex-1 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Avatar Image URL</label>
                <input id="ProfileView-avatar_url" name="avatar_url"
                  type="url"
                  value={editForm.avatar_url || ''}
                  onChange={(e) => setEditForm({ ...editForm, avatar_url: e.target.value })}
                  placeholder="https://..."
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                />
              </div>

              <div className="pt-3 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold shadow-md shadow-brand-500/20"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Skill Modal */}
      {skillModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
            <h3 className="font-bold text-base text-slate-900 dark:text-white mb-3">Add Verified Skill</h3>
            <form onSubmit={handleAddSkill} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Skill Name</label>
                <input id="ProfileView-name" name="name"
                  type="text"
                  value={skillForm.name}
                  onChange={(e) => setSkillForm({ ...skillForm, name: e.target.value })}
                  placeholder="e.g. Next.js, Python, GraphQL, Docker..."
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Category</label>
                <select id="ProfileView-category" name="category"
                  value={skillForm.category}
                  onChange={(e) => setSkillForm({ ...skillForm, category: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                >
                  <option value="Frontend">Frontend</option>
                  <option value="Backend">Backend</option>
                  <option value="AI/ML">AI / Machine Learning</option>
                  <option value="Database">Database</option>
                  <option value="DevOps">DevOps & Cloud</option>
                  <option value="Design">Design & UI/UX</option>
                  <option value="Soft Skills">Soft Skills & Leadership</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Proficiency</label>
                <select id="ProfileView-proficiency" name="proficiency"
                  value={skillForm.proficiency}
                  onChange={(e) => setSkillForm({ ...skillForm, proficiency: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                >
                  <option value="Beginner">Beginner</option>
                  <option value="Intermediate">Intermediate</option>
                  <option value="Advanced">Advanced</option>
                  <option value="Expert">Expert</option>
                </select>
              </div>

              <div className="pt-3 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setSkillModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold"
                >
                  Add Skill
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Project Modal */}
      {projectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
            <h3 className="font-bold text-base text-slate-900 dark:text-white mb-3">Add Featured Project</h3>
            <form onSubmit={handleAddProject} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Project Title</label>
                <input id="ProfileView-title" name="title"
                  type="text"
                  value={projectForm.title}
                  onChange={(e) => setProjectForm({ ...projectForm, title: e.target.value })}
                  placeholder="e.g. AI Resume Matcher"
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Description</label>
                <textarea id="ProfileView-description" name="description"
                  rows={2}
                  value={projectForm.description}
                  onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })}
                  placeholder="What problem does it solve? What did you build?"
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 resize-none"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Tech Stack (comma separated)</label>
                <input id="ProfileView-tech" name="tech"
                  type="text"
                  value={projectForm.tech}
                  onChange={(e) => setProjectForm({ ...projectForm, tech: e.target.value })}
                  placeholder="React, Node.js, SQLite, Tailwind"
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">GitHub Repo URL</label>
                <input id="ProfileView-githubUrl" name="githubUrl"
                  type="url"
                  value={projectForm.githubUrl}
                  onChange={(e) => setProjectForm({ ...projectForm, githubUrl: e.target.value })}
                  placeholder="https://github.com/..."
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Live Demo URL</label>
                <input id="ProfileView-liveUrl" name="liveUrl"
                  type="url"
                  value={projectForm.liveUrl}
                  onChange={(e) => setProjectForm({ ...projectForm, liveUrl: e.target.value })}
                  placeholder="https://..."
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                />
              </div>

              <div className="pt-3 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setProjectModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold"
                >
                  Save Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Education Modal */}
      {eduModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
            <h3 className="font-bold text-base text-slate-900 dark:text-white mb-3 flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-brand-500" /> Add Education
            </h3>
            <form onSubmit={handleAddEducation} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">University / College / School</label>
                <input id="ProfileView-school" name="school"
                  type="text"
                  value={eduForm.school}
                  onChange={(e) => setEduForm({ ...eduForm, school: e.target.value })}
                  placeholder="e.g. Indian Institute of Technology (IIT) Delhi"
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Degree & Major</label>
                <input id="ProfileView-degree" name="degree"
                  type="text"
                  value={eduForm.degree}
                  onChange={(e) => setEduForm({ ...eduForm, degree: e.target.value })}
                  placeholder="e.g. B.Tech in Computer Science & Engineering"
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Years / Cohort</label>
                  <input id="ProfileView-year" name="year"
                    type="text"
                    value={eduForm.year}
                    onChange={(e) => setEduForm({ ...eduForm, year: e.target.value })}
                    placeholder="2022 - 2026"
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">CGPA / Percentage</label>
                  <input id="ProfileView-grade" name="grade"
                    type="text"
                    value={eduForm.grade}
                    onChange={(e) => setEduForm({ ...eduForm, grade: e.target.value })}
                    placeholder="e.g. 8.9 / 10"
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  />
                </div>
              </div>

              <div className="pt-3 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setEduModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold"
                >
                  Save Education
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Experience Modal */}
      {expModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
            <h3 className="font-bold text-base text-slate-900 dark:text-white mb-3 flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-indigo-500" /> Add Work / Internship Experience
            </h3>
            <form onSubmit={handleAddExperience} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Role / Job Title</label>
                <input id="ProfileView-role" name="role"
                  type="text"
                  value={expForm.role}
                  onChange={(e) => setExpForm({ ...expForm, role: e.target.value })}
                  placeholder="e.g. Software Engineer Intern"
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Company / Organization</label>
                <input id="ProfileView-company" name="company"
                  type="text"
                  value={expForm.company}
                  onChange={(e) => setExpForm({ ...expForm, company: e.target.value })}
                  placeholder="e.g. Razorpay / Swiggy / Stealth Startup"
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Duration / Period</label>
                <input id="ProfileView-period" name="period"
                  type="text"
                  value={expForm.period}
                  onChange={(e) => setExpForm({ ...expForm, period: e.target.value })}
                  placeholder="e.g. Jun 2024 - Aug 2024 (3 mos)"
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Responsibilities & Impact</label>
                <textarea id="ProfileView-description" name="description"
                  rows={3}
                  value={expForm.description}
                  onChange={(e) => setExpForm({ ...expForm, description: e.target.value })}
                  placeholder="What did you build? What was your impact or metric?"
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 resize-none"
                />
              </div>

              <div className="pt-3 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setExpModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
                >
                  Save Experience
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Aadhaar & Student KYC Verification Modal */}
      <AadhaarVerificationModal
        isOpen={aadhaarModalOpen}
        onClose={() => setAadhaarModalOpen(false)}
        onVerified={() => {
          fetchProfile();
          if (refreshUser) refreshUser();
        }}
      />
    </div>
  );
}

