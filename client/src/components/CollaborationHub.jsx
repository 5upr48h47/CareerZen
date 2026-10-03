import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  Users,
  Plus,
  Search,
  Sparkles,
  Rocket,
  Code,
  GraduationCap,
  MessageSquare,
  CheckCircle2,
  X,
  Filter,
  UserPlus,
  Send,
} from 'lucide-react';

export default function CollaborationHub({ onOpenChat, onSelectUser }) {
  const { user, openAuthModal } = useAuth();
  const [collaborations, setCollaborations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [projectType, setProjectType] = useState('All');
  const [skillFilter, setSkillFilter] = useState('');

  // Create Collab Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    project_type: 'Hackathon',
    description: '',
    skills_needed: 'React, TypeScript, UI/UX Design',
    team_size: 3,
    contact_info: ''
  });
  const [submitting, setSubmitting] = useState(false);

  // "My Projects" — listings this user created, where they can manage the team
  const [showMine, setShowMine] = useState(false);
  const [myCollabIds, setMyCollabIds] = useState(new Set());
  const [rosterCollab, setRosterCollab] = useState(null);
  const [roster, setRoster] = useState([]);
  const [rosterLoading, setRosterLoading] = useState(false);

  useEffect(() => {
    fetchCollaborations();
  }, [projectType]);

  // Track which listings belong to the current user so their cards can show a
  // "Manage Team" action. Runs whenever the list or the signed-in user changes.
  useEffect(() => {
    let cancelled = false;
    async function loadMine() {
      if (!user) { setMyCollabIds(new Set()); return; }
      try {
        const mine = await api.getMyCollaborations();
        if (cancelled) return;
        setMyCollabIds(new Set(mine.map((c) => c.id)));
      } catch (err) {
        console.error('Fetch my collaborations error:', err);
      }
    }
    loadMine();
    return () => { cancelled = true; };
  }, [user, collaborations]);

  async function fetchCollaborations() {
    setLoading(true);
    try {
      const data = await api.getCollaborations({
        projectType: projectType !== 'All' ? projectType : undefined,
        skill: skillFilter.trim() || undefined
      });
      setCollaborations(data);
    } catch (err) {
      console.error('Fetch collaborations error:', err);
    } finally {
      setLoading(false);
    }
  }

  function handleSearchSubmit(e) {
    e.preventDefault();
    fetchCollaborations();
  }

  async function handleCreateCollab(e) {
    e.preventDefault();
    // Surface why the post did not send — a silent return here looks like a
    // broken button when the real cause is an empty required field.
    if (!formData.title.trim() || !formData.description.trim()) {
      alert('Please fill in both the project title and description before posting.');
      return;
    }

    setSubmitting(true);
    try {
      const skillsArray = formData.skills_needed
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      await api.createCollaboration({
        ...formData,
        skills_needed: skillsArray
      });

      setModalOpen(false);
      setFormData({
        title: '',
        project_type: 'Hackathon',
        description: '',
        skills_needed: 'React, TypeScript, UI/UX Design',
        team_size: 3,
        contact_info: ''
      });
      await fetchCollaborations();
      alert('Project team-up listing posted! Other students can now discover and join your team. 🚀');
    } catch (err) {
      alert(err.message || 'Failed to create listing');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleJoinTeam(collabId) {
    if (!user) return openAuthModal();
    try {
      await api.joinCollaboration(collabId, { message: 'Excited to join the team!' });
      await fetchCollaborations();
      alert('You have joined the project team! The creator has been notified.');
    } catch (err) {
      alert(err.message || 'Failed to join team');
    }
  }

  // Creator: open the team roster for one of their own listings
  async function openRoster(collab) {
    setRosterCollab(collab);
    setRosterLoading(true);
    try {
      const data = await api.getCollaborationMembers(collab.id);
      setRoster(data.members || []);
    } catch (err) {
      console.error('Fetch team roster error:', err);
      setRoster([]);
    } finally {
      setRosterLoading(false);
    }
  }

  // Creator: accept or remove a team member
  async function manageMember(collab, member, action) {
    try {
      await api.manageCollaborationMember(collab.id, member.user_id, action);
      const data = await api.getCollaborationMembers(collab.id);
      setRoster(data.members || []);
      await fetchCollaborations();
    } catch (err) {
      alert(err.message || (action === 'accept' ? 'Could not accept member' : 'Could not remove member'));
    }
  }

  const projectTypes = [
    { id: 'All', label: 'All Projects' },
    { id: 'Hackathon', label: '🏆 Hackathons' },
    { id: 'Open Source', label: '🌐 Open Source' },
    { id: 'Capstone / Course Project', label: '🎓 Capstones' },
    { id: 'Startup MVP', label: '⚡ Startup MVPs' }
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header Banner */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200/80 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-brand-50 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300 text-xs font-bold border border-brand-200 dark:border-brand-800">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Student & Early-Talent Team-Up</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
            Project & Hackathon Collaboration Hub
          </h1>
          <p className="text-xs text-slate-500">
            Find co-builders, join hackathon teams, and build open-source software with peers.
          </p>
        </div>

        <button
          onClick={() => {
            if (!user) return openAuthModal();
            setModalOpen(true);
          }}
          className="flex items-center justify-center space-x-1.5 px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-2xl text-xs font-bold transition shadow-md shadow-brand-500/25 self-start md:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Post Team-Up Request</span>
        </button>
      </div>

      {/* Filter Tabs & Skill Search */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl shadow-sm border border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Project Types */}
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none text-xs">
          {projectTypes.map((pt) => (
            <button
              key={pt.id}
              onClick={() => setProjectType(pt.id)}
              className={`px-3.5 py-1.5 rounded-xl font-bold whitespace-nowrap transition ${
                projectType === pt.id
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {pt.label}
            </button>
          ))}
        </div>

        {/* Search by Skill */}
        <form onSubmit={handleSearchSubmit} className="relative max-w-xs w-full" role="search">
          <label htmlFor="collab-skill-filter" className="sr-only">Filter by needed skill</label>
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            id="collab-skill-filter"
            name="skill"
            type="search"
            value={skillFilter}
            onChange={(e) => setSkillFilter(e.target.value)}
            placeholder="Filter by needed skill (e.g. React, Python)..."
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
          />
        </form>
      </div>

      {/* Collaborations Grid */}
      {loading ? (
        <div className="text-center py-16">
          <div className="inline-block animate-spin w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full" />
          <p className="text-xs text-slate-400 mt-2">Loading active teams...</p>
        </div>
      ) : collaborations.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-12 text-center border border-slate-200 dark:border-slate-800">
          <Rocket className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
          <h3 className="font-bold text-sm text-slate-900 dark:text-white">No active teams found</h3>
          <p className="text-xs text-slate-400 mt-1">Be the first to post a team-up request for your next project!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {collaborations.map((collab) => {
            const isCreator = user?.id === collab.creator_id;
            return (
              <div
                key={collab.id}
                className="bg-white dark:bg-slate-900 p-5 rounded-3xl shadow-sm border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between hover:shadow-md hover:border-brand-500/40 transition"
              >
                <div className="space-y-3">
                  {/* Top Creator and Tag */}
                  <div className="flex items-start justify-between gap-2">
                    <div
                      onClick={() => onSelectUser && onSelectUser(collab.creator_id)}
                      className="flex items-center space-x-2.5 cursor-pointer"
                    >
                      <img
                        src={collab.creator_avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${collab.creator_username}`}
                        alt={collab.creator_name}
                        className="w-9 h-9 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                      />
                      <div>
                        <p className="font-bold text-xs text-slate-900 dark:text-white hover:text-brand-600 transition">
                          {collab.creator_name || collab.creator_username}
                        </p>
                        <p className="text-[10px] text-slate-400 truncate max-w-[140px]">
                          {collab.creator_headline || 'Project Lead'}
                        </p>
                      </div>
                    </div>

                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                      {collab.project_type}
                    </span>
                  </div>

                  {/* Title & Description */}
                  <div>
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white leading-snug">
                      {collab.title}
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-1.5 line-clamp-3 leading-relaxed">
                      {collab.description}
                    </p>
                  </div>

                  {/* Skills Needed */}
                  <div>
                    <strong className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                      Teammate Skills Needed:
                    </strong>
                    <div className="flex flex-wrap gap-1">
                      {collab.skills_needed.map((sk, idx) => (
                        <span
                          key={idx}
                          className="text-[10px] px-2 py-0.5 rounded bg-brand-50 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300 font-semibold border border-brand-100 dark:border-brand-900/60"
                        >
                          {sk}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Footer / Join & Message Actions */}
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 text-xs">
                  <span className="text-[11px] text-slate-500 font-medium">
                    Team: <strong>{collab.current_members_count}</strong> / {collab.team_size} members
                  </span>

                  <div className="flex items-center space-x-1.5">
                    <button
                      onClick={() => onOpenChat && onOpenChat(collab.creator_id)}
                      className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl transition"
                      title="Message Creator"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                    </button>

                    {!isCreator && (
                      <button
                        onClick={() => handleJoinTeam(collab.id)}
                        className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-bold transition flex items-center space-x-1 shadow-sm"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>Join Team</span>
                      </button>
                    )}

                    {/* Creator: see who joined and manage the roster */}
                    {isCreator && (
                      <button
                        onClick={() => openRoster(collab)}
                        className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 rounded-xl font-bold transition flex items-center space-x-1 shadow-sm"
                      >
                        <Users className="w-3.5 h-3.5" />
                        <span>Manage Team</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Post Collab Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <h3 className="font-bold text-base text-slate-900 dark:text-white">Post Project Team-Up</h3>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCollab} className="space-y-3 text-xs" noValidate>
              <div>
                <label htmlFor="collab-title" className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Project / Hackathon Title</label>
                <input
                  id="collab-title"
                  name="title"
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g. EcoTrack AI — HackMIT 2026 Submission"
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="collab-category" className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Project Category</label>
                  <select
                    id="collab-category"
                    name="project_type"
                    value={formData.project_type}
                    onChange={(e) => setFormData({ ...formData, project_type: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  >
                    <option value="Hackathon">🏆 Hackathon</option>
                    <option value="Open Source">🌐 Open Source</option>
                    <option value="Capstone / Course Project">🎓 Capstone / Course Project</option>
                    <option value="Startup MVP">⚡ Startup MVP</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="collab-team-size" className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Target Team Size</label>
                  <input
                    id="collab-team-size"
                    name="team_size"
                    type="number"
                    min="2"
                    max="8"
                    value={formData.team_size}
                    onChange={(e) => setFormData({ ...formData, team_size: Number(e.target.value) })}
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="collab-skills" className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Skills Needed (comma-separated)
                </label>
                <input
                  id="collab-skills"
                  name="skills_needed"
                  type="text"
                  value={formData.skills_needed}
                  onChange={(e) => setFormData({ ...formData, skills_needed: e.target.value })}
                  placeholder="React, Python, OpenCV, UI/UX Design"
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                />
              </div>

              <div>
                <label htmlFor="collab-description" className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Project Description & Goal</label>
                <textarea
                  id="collab-description"
                  name="description"
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="What are you building? What role are you seeking?"
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 resize-none"
                  required
                />
              </div>

              <div>
                <label htmlFor="collab-contact" className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Contact Info / Discord</label>
                <input
                  id="collab-contact"
                  name="contact_info"
                  type="text"
                  value={formData.contact_info}
                  onChange={(e) => setFormData({ ...formData, contact_info: e.target.value })}
                  placeholder="your.email@edu / Discord tag"
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                />
              </div>

              <div className="pt-3 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-bold shadow-md"
                >
                  {submitting ? 'Posting...' : 'Publish Listing'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Team Roster Modal — creator's view of who joined their project */}
      {rosterCollab && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white">Team Roster</h3>
                <p className="text-xs text-slate-500 mt-0.5">{rosterCollab.title}</p>
              </div>
              <button onClick={() => setRosterCollab(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {rosterLoading ? (
              <div className="text-center py-10">
                <div className="inline-block animate-spin w-7 h-7 border-4 border-brand-500 border-t-transparent rounded-full" />
                <p className="text-xs text-slate-400 mt-2">Loading team members...</p>
              </div>
            ) : roster.length === 0 ? (
              <div className="text-center py-10">
                <Users className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
                <p className="text-sm font-bold text-slate-700 dark:text-slate-200">No one has joined yet</p>
                <p className="text-xs text-slate-400 mt-1">
                  You'll be notified here the moment someone joins your team.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {roster.map((m) => {
                  const isOwner = m.user_id === rosterCollab.creator_id;
                  return (
                    <div
                      key={m.id}
                      className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700"
                    >
                      <img
                        src={m.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${m.username}`}
                        alt=""
                        className="w-10 h-10 rounded-full object-cover"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                          {m.full_name || m.username}
                          {isOwner && (
                            <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-brand-100 text-brand-700 dark:bg-brand-950 dark:text-brand-300 font-bold">
                              Owner
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-slate-500 truncate">{m.role_title || 'Contributor'}</p>
                      </div>

                      {!isOwner && (
                        <div className="flex items-center gap-1.5 shrink-0">
                          {onSelectUser && (
                            <button
                              onClick={() => onSelectUser(m.user_id)}
                              className="p-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl transition"
                              title="View Profile"
                            >
                              <Search className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {onOpenChat && (
                            <button
                              onClick={() => onOpenChat(m.user_id)}
                              className="p-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl transition"
                              title="Message Member"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => manageMember(rosterCollab, m, 'reject')}
                            className="p-2 bg-red-100 hover:bg-red-200 dark:bg-red-950 dark:hover:bg-red-900 text-red-600 dark:text-red-400 rounded-xl transition"
                            title="Remove from Team"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
