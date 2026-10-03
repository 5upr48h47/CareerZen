import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import {
  Heart,
  MessageCircle,
  Share2,
  Image as ImageIcon,
  Send,
  Sparkles,
  Tag,
  Briefcase,
  Code,
  GraduationCap,
  TrendingUp,
  Bookmark,
  CheckCircle2,
  Upload,
  X,
  Video,
  MoreVertical,
  Edit3,
  Trash2,
} from 'lucide-react';

export default function Feed({ onSelectUser, onSelectJob }) {
  const { user, openAuthModal } = useAuth();
  const { on } = useSocket();

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedTag, setSelectedTag] = useState('');
  const [feedTopics, setFeedTopics] = useState([]);

  // Post composer state
  const [newContent, setNewContent] = useState('');
  const [newCategory, setNewCategory] = useState('Project Showcase');
  const [newMediaUrl, setNewMediaUrl] = useState('');
  const [newTags, setNewTags] = useState('#StudentProject, #React');
  const [showMediaInput, setShowMediaInput] = useState(false);
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaPreview, setMediaPreview] = useState('');
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Active comments expansion
  const [activeCommentsPostId, setActiveCommentsPostId] = useState(null);
  const [commentsMap, setCommentsMap] = useState({});
  const [commentInput, setCommentInput] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [postMenuOpen, setPostMenuOpen] = useState(null);

  // Edit post modal state
  const [editPostId, setEditPostId] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [editPostOpen, setEditPostOpen] = useState(false);

  async function handleEditPost(postId) {
    const post = posts.find((p) => p.id === postId);
    if (!post) return;
    setEditPostId(postId);
    setEditContent(post.content);
    setEditPostOpen(true);
  }

  async function handleSaveEdit() {
    if (!editContent.trim()) return;
    try {
      await api.updatePost(editPostId, { content: editContent.trim() });
      setPosts((prev) =>
        prev.map((p) =>
          p.id === editPostId ? { ...p, content: editContent.trim() } : p
        )
      );
      setEditPostOpen(false);
      setEditPostId(null);
      setEditContent('');
    } catch (err) {
      console.error('Edit post error:', err);
      alert(err.message || 'Failed to edit post');
    }
  }

  async function handleDeletePost(postId) {
    if (!confirm('Delete this post? This cannot be undone.')) return;
    try {
      await api.deletePost(postId);
      setPosts((prev) => prev.filter((p) => p.id !== postId));
    } catch (err) {
      console.error('Delete post error:', err);
      alert(err.message || 'Failed to delete post');
    }
  }

  useEffect(() => {
    fetchPosts();
  }, [selectedCategory, selectedTag]);

  useEffect(() => {
    async function loadFeedTopics() {
      try {
        const data = await api.getFeedTopics();
        setFeedTopics(data || []);
      } catch (err) {
        console.error('Fetch feed topics error:', err);
      }
    }
    loadFeedTopics();
  }, []);

  // Poll for new posts even when the WebSocket is down. Browsers throttle
  // timers in background tabs and drop connections, so real-time delivery
  // alone is not enough — without this the feed only updates on refresh.
  useEffect(() => {
    if (!user) return;
    const id = setInterval(() => {
      api.getPosts({ category: selectedCategory }).then(setPosts).catch(() => {});
    }, 15000);
    return () => clearInterval(id);
  }, [user, selectedCategory]);

  // Close the post menu when the user clicks elsewhere.
  useEffect(() => {
    if (postMenuOpen === null) return;
    const handler = (e) => {
      if (!e.target.closest('[data-post-menu]')) setPostMenuOpen(null);
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [postMenuOpen]);

  // Real-time socket events for posts, likes, and comments
  useEffect(() => {
    const unsubNewPost = on('new_post', (data) => {
      setPosts((prev) => [data.post, ...prev]);
    });

    const unsubPostLiked = on('post_liked', (data) => {
      setPosts((prev) =>
        prev.map((p) => {
          if (p.id === data.postId) {
            return {
              ...p,
              likes_count: data.likesCount,
              has_liked: user?.id === data.userId ? data.liked : p.has_liked
            };
          }
          return p;
        })
      );
    });

    const unsubNewComment = on('new_comment', (data) => {
      const comment = data.comment;
      setPosts((prev) =>
        prev.map((p) => (p.id === comment.post_id ? { ...p, comments_count: (p.comments_count || 0) + 1 } : p))
      );
      setCommentsMap((prev) => {
        const existing = prev[comment.post_id] || [];
        return {
          ...prev,
          [comment.post_id]: [...existing, comment]
        };
      });
    });

    return () => {
      unsubNewPost();
      unsubPostLiked();
      unsubNewComment();
    };
  }, [on, user?.id]);

  async function fetchPosts() {
    setLoading(true);
    try {
      const data = await api.getPosts({ category: selectedCategory });
      setPosts(data);
    } catch (err) {
      console.error('Fetch feed error:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleMediaChange(e) {
    const file = e.target.files[0];
    if (!file) return;

    // Preview
    const reader = new FileReader();
    reader.onload = () => setMediaPreview(reader.result);
    reader.readAsDataURL(file);
    setMediaFile(file);

    // Upload to server to get a stable URL
    setUploadingMedia(true);
    try {
      const formData = new FormData();
      formData.append('media', file);
      const result = await api.uploadPostMedia(formData);
      if (result.success) {
        setNewMediaUrl(result.media_url);
      } else {
        setNewMediaUrl('');
        alert(result.error || 'Media upload failed');
      }
    } catch (err) {
      console.error('Media upload failed:', err);
      setNewMediaUrl('');
      alert('Media upload failed');
    } finally {
      setUploadingMedia(false);
    }
  }

  function clearMedia() {
    setMediaFile(null);
    setMediaPreview('');
    setNewMediaUrl('');
  }

  async function handleCreatePost(e) {
    e.preventDefault();
    if (!user) return openAuthModal();
    if (!newContent.trim()) return;

    setSubmitting(true);
    try {
      const tagsArray = newTags
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0)
        .map((t) => (t.startsWith('#') ? t : `#${t}`));

      const created = await api.createPost({
        content: newContent,
        category: newCategory,
        media_url: newMediaUrl.trim() || null,
        tags: tagsArray
      });

      // Insert if not already inserted by socket
      setPosts((prev) => {
        if (prev.some((p) => p.id === created.id)) return prev;
        return [created, ...prev];
      });

      setNewContent('');
      clearMedia();
      setShowMediaInput(false);
    } catch (err) {
      console.error('Create post failed:', err);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleLike(postId) {
    if (!user) return openAuthModal();

    // Optimistic UI update
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id === postId) {
          const nextLiked = !p.has_liked;
          return {
            ...p,
            has_liked: nextLiked,
            likes_count: nextLiked ? p.likes_count + 1 : Math.max(0, p.likes_count - 1)
          };
        }
        return p;
      })
    );

    try {
      await api.toggleLike(postId);
    } catch (err) {
      console.error('Toggle like error:', err);
      // Revert if error
      fetchPosts();
    }
  }

  async function toggleComments(postId) {
    if (activeCommentsPostId === postId) {
      setActiveCommentsPostId(null);
      return;
    }

    setActiveCommentsPostId(postId);
    if (!commentsMap[postId]) {
      try {
        const comments = await api.getComments(postId);
        setCommentsMap((prev) => ({ ...prev, [postId]: comments }));
      } catch (err) {
        console.error('Fetch comments error:', err);
      }
    }
  }

  async function handleAddComment(e, postId) {
    e.preventDefault();
    if (!user) return openAuthModal();
    if (!commentInput.trim()) return;

    setSubmittingComment(true);
    try {
      const comment = await api.addComment(postId, { content: commentInput.trim() });
      setCommentsMap((prev) => ({
        ...prev,
        [postId]: [...(prev[postId] || []), comment]
      }));
      setPosts((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, comments_count: (p.comments_count || 0) + 1 } : p))
      );
      setCommentInput('');
    } catch (err) {
      console.error('Add comment error:', err);
    } finally {
      setSubmittingComment(false);
    }
  }

  const categories = [
    { id: 'All', label: '🌟 All Updates' },
    { id: 'Project Showcase', label: '🚀 Project Showcase' },
    { id: 'Hiring', label: '🏢 Hiring & Jobs' },
    { id: 'Career Update', label: '🎓 Career Milestone' },
    { id: 'Question', label: '💡 Questions & Advice' }
  ];

  return (
    <>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Sidebar: User profile snapshot & early career highlights */}
        <div className="lg:col-span-3 space-y-6">
          {user ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200/80 dark:border-slate-800 p-5 text-center relative overflow-hidden">
              <div className="h-16 bg-gradient-to-r from-brand-600 to-indigo-600 -mx-5 -mt-5 mb-8" />
              <div className="relative -mt-16 inline-block">
                <img
                  src={user.profile?.avatar_url || user.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`}
                  alt={user.profile?.full_name}
                  className="w-16 h-16 rounded-full mx-auto border-4 border-white dark:border-slate-900 object-cover shadow-md"
                />
              </div>
              <h3
                onClick={() => onSelectUser && onSelectUser(user.id)}
                className="font-bold text-slate-900 dark:text-white text-base hover:text-brand-600 dark:hover:text-brand-400 cursor-pointer transition"
              >
                {user.profile?.full_name || user.username}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                {user.profile?.headline || 'Early-Career Technologist'}
              </p>

              <div className="border-t border-slate-100 dark:border-slate-800 mt-4 pt-4 text-xs flex justify-around text-slate-600 dark:text-slate-300">
                <div>
                  <span className="block font-bold text-slate-900 dark:text-white text-sm">
                    {user.skills?.length || 0}
                  </span>
                  <span className="text-[10px] text-slate-400">Verified Skills</span>
                </div>
                <div>
                  <span className="block font-bold text-brand-600 dark:text-brand-400 text-sm">
                    {user.role === 'recruiter' ? 'Recruiter' : 'Active'}
                  </span>
                  <span className="text-[10px] text-slate-400">Status</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-gradient-to-br from-brand-600 to-indigo-700 rounded-2xl p-6 text-white text-center shadow-lg">
              <Sparkles className="w-8 h-8 mx-auto mb-2 text-brand-200" />
              <h3 className="font-extrabold text-lg">Welcome to CareerZen</h3>
              <p className="text-xs text-brand-100 mt-2 leading-relaxed">
                Connect with peer students, showcase real projects, and land internships & junior roles.
              </p>
              <button
                onClick={() => openAuthModal('register')}
                className="mt-4 w-full py-2 bg-white text-brand-700 font-bold rounded-xl text-xs hover:bg-brand-50 transition shadow"
              >
                Get Started Free
              </button>
            </div>
          )}

          {/* Early Career Spotlight Card */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200/80 dark:border-slate-800 p-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-brand-500" /> Student & Fresher Topics
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {(feedTopics.length > 0 ? feedTopics : [
                { tag: '#BuildInPublic', color: 'brand' },
                { tag: '#Freshers2026', color: 'purple' },
                { tag: '#React', color: 'emerald' },
                { tag: '#OpenSource', color: 'amber' },
                { tag: '#InternshipHunt', color: 'indigo' },
                { tag: '#ResumeReview', color: 'rose' },
                { tag: '#AI', color: 'cyan' }
              ]).map((topic) => {
                const colorClasses = {
                  brand: 'bg-brand-50 text-brand-700 dark:bg-brand-950/50 dark:text-brand-300 hover:bg-brand-100 dark:hover:bg-brand-950/70 border-brand-200 dark:border-brand-800',
                  purple: 'bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-950/70 border-purple-200 dark:border-purple-800',
                  emerald: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-950/70 border-emerald-200 dark:border-emerald-800',
                  amber: 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-950/70 border-amber-200 dark:border-amber-800',
                  indigo: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-950/70 border-indigo-200 dark:border-indigo-800',
                  rose: 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-950/70 border-rose-200 dark:border-rose-800',
                  cyan: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-300 hover:bg-cyan-100 dark:hover:bg-cyan-950/70 border-cyan-200 dark:border-cyan-800',
                  slate: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700'
                };
                const topicTag = topic.tag;
                return (
                  <button
                    key={topicTag}
                    type="button"
                    onClick={() => setSelectedTag((prev) => (prev === topicTag ? '' : topicTag))}
                    className={`text-[11px] px-2.5 py-1 rounded-lg border transition font-medium ${
                      selectedTag === topicTag
                        ? 'text-white border-transparent shadow-md'
                        : colorClasses[topic.color] || colorClasses.slate
                    }`}
                    title="Filter feed by this topic"
                  >
                    {topicTag}
                  </button>
                );
              })}
            </div>
            {selectedTag && (
              <button
                type="button"
                onClick={() => setSelectedTag('')}
                className="mt-2 text-[10px] font-bold text-brand-600 dark:text-brand-400 hover:underline"
              >
                ✕ Clear topic filter
              </button>
            )}
          </div>
        </div>

        {/* Center: Post Composer, Filters & Feed */}
        <div className="lg:col-span-6 space-y-6">
          {/* Post Composer */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200/80 dark:border-slate-800 p-5">
            <div className="flex items-start space-x-3">
              <img
                src={user?.profile?.avatar_url || user?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.username || 'guest'}`}
                alt="Avatar"
                className="w-10 h-10 rounded-full object-cover border border-slate-200 dark:border-slate-700"
              />
              <div className="flex-1">
                <textarea id="Feed-newContent" name="newContent"
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  placeholder={
                    user?.role === 'recruiter'
                      ? "Share an opening, company update, or hiring tip for early-career devs..."
                      : "Showcase a project, ask a career question, or share what you learned today..."
                  }
                  rows={3}
                  className="w-full text-sm rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-3 focus:ring-2 focus:ring-brand-500 focus:outline-none text-slate-900 dark:text-slate-100 placeholder-slate-400 resize-none transition"
                />

                {showMediaInput && (
                  <div className="mt-2 space-y-2">
                    {!mediaFile ? (
                      <label className="flex items-center justify-center gap-2 w-full text-xs rounded-lg bg-slate-50 dark:bg-slate-800/50 border-2 border-dashed border-slate-300 dark:border-slate-700 p-3 cursor-pointer hover:border-brand-500 hover:bg-brand-50 dark:hover:bg-brand-950/30 transition">
                        <Upload className="w-4 h-4 text-slate-500" />
                        <span className="text-slate-600 dark:text-slate-300">
                          {uploadingMedia ? 'Uploading...' : 'Upload image or video (max 50MB)'}
                        </span>
                        <input
                          type="file"
                          accept="image/*,video/*"
                          className="hidden"
                          onChange={handleMediaChange}
                          disabled={uploadingMedia}
                        />
                      </label>
                    ) : null}

                    <div className="flex items-center gap-2">
                      <input id="Feed-newMediaUrl" name="newMediaUrl"
                        type="url"
                        value={newMediaUrl}
                        onChange={(e) => setNewMediaUrl(e.target.value)}
                        placeholder="Or paste Image / Screenshot URL (e.g. Unsplash or GitHub preview)..."
                        className="flex-1 text-xs rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-2 text-slate-900 dark:text-slate-100"
                      />
                      {mediaFile && (
                        <button
                          type="button"
                          onClick={clearMedia}
                          disabled={uploadingMedia}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition"
                          title="Remove media"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {mediaPreview && (
                      <div className="relative rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800 max-h-48">
                        <img src={mediaPreview} alt="Preview" className="w-full object-contain max-h-48" />
                        {uploadingMedia && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-white text-xs">
                            Uploading...
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center space-x-2">
                    <select id="Feed-newCategory" name="newCategory"
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                      className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg px-2.5 py-1.5 border-none focus:ring-1 focus:ring-brand-500 font-medium"
                    >
                      <option value="Project Showcase">🚀 Project Showcase</option>
                      <option value="Hiring">🏢 Hiring / Job</option>
                      <option value="Career Update">🎓 Career Milestone</option>
                      <option value="Question">💡 Question / Advice</option>
                      <option value="General">💬 General</option>
                    </select>

                    <button
                      type="button"
                      onClick={() => setShowMediaInput(!showMediaInput)}
                      className={`p-1.5 rounded-lg text-xs flex items-center space-x-1 transition ${
                        showMediaInput
                          ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/50 dark:text-brand-300'
                          : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                      title="Attach image or video"
                    >
                      <ImageIcon className="w-4 h-4" />
                      <span className="hidden sm:inline">Media</span>
                    </button>
                  </div>

                  <button
                    onClick={handleCreatePost}
                    disabled={submitting || !newContent.trim()}
                    className="flex items-center space-x-1.5 px-4 py-1.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition shadow-sm"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{submitting ? 'Posting...' : 'Post'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-none">
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedCategory(c.id)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition ${
                  selectedCategory === c.id
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {c.label}
              </button>
            ))}
            {selectedTag && (
              <span className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800 whitespace-nowrap">
                <Tag className="w-3 h-3" /> {selectedTag}
                <button onClick={() => setSelectedTag('')} className="hover:text-purple-900 dark:hover:text-purple-100">✕</button>
              </span>
            )}
          </div>

          {/* Feed Posts List */}
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full" />
              <p className="text-xs text-slate-400 mt-2">Loading fresh updates...</p>
            </div>
          ) : posts.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-12 text-center border border-slate-200 dark:border-slate-800">
              <Sparkles className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
              <h4 className="font-bold text-slate-900 dark:text-white text-sm">No posts found</h4>
              <p className="text-xs text-slate-400 mt-1">Be the first to share a project or update in this category!</p>
            </div>
          ) : (
            posts.map((post) => (
              <div
                key={post.id}
                className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200/80 dark:border-slate-800 overflow-hidden transition-all duration-200 hover:border-slate-300 dark:hover:border-slate-700"
              >
                {/* Post Header */}
                <div className="p-5 pb-3 flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    <img
                      src={post.author_avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${post.username}`}
                      alt={post.author_name}
                      onClick={() => onSelectUser && onSelectUser(post.author_id)}
                      className="w-11 h-11 rounded-full object-cover border border-slate-200 dark:border-slate-700 cursor-pointer hover:opacity-90"
                    />
                    <div>
                      <div className="flex items-center space-x-2">
                        <h4
                          onClick={() => onSelectUser && onSelectUser(post.author_id)}
                          className="font-bold text-slate-900 dark:text-white text-sm hover:text-brand-600 dark:hover:text-brand-400 cursor-pointer transition"
                        >
                          {post.author_name || post.username}
                        </h4>
                        {post.author_role === 'recruiter' && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-950/80 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                            Recruiter
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">
                        {post.author_headline || 'CareerZen Member'}
                      </p>
                      <span className="text-[10px] text-slate-400">
                        {new Date(post.created_at).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                  </div>

                  {post.category && (
                    <span className="text-[11px] font-medium px-2.5 py-1 rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300 border border-brand-200 dark:border-brand-800">
                      {post.category}
                    </span>
                  )}

                  {/* Edit / Delete menu — only the author or an admin sees it. */}
                  {(user?.id === post.author_id || user?.role === 'admin') && (
                    <div className="relative" data-post-menu>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setPostMenuOpen(post.id);
                        }}
                        className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                        title="More options"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                      {postMenuOpen === post.id && (
                        <div
                          className="absolute right-0 mt-1 w-36 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 z-20 overflow-hidden"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={() => handleEditPost(post.id)}
                            className="w-full flex items-center space-x-2 px-3 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Edit Post</span>
                          </button>
                          <button
                            onClick={() => handleDeletePost(post.id)}
                            className="w-full flex items-center space-x-2 px-3 py-2 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Delete Post</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Post Body Content */}
                <div className="px-5 py-2">
                  <p className="text-slate-800 dark:text-slate-200 text-sm whitespace-pre-line leading-relaxed font-normal">
                    {post.content}
                  </p>

                  {/* Hashtags */}
                  {post.tags && post.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {post.tags.map((t, idx) => (
                        <span
                          key={idx}
                          className="text-[11px] font-medium text-brand-600 dark:text-brand-400 hover:underline cursor-pointer"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Media Image */}
                {post.media_url && (
                  <div className="mt-3 bg-slate-100 dark:bg-slate-800/50 max-h-96 overflow-hidden flex items-center justify-center">
                    <img
                      src={post.media_url}
                      alt="Post attachment"
                      className="w-full object-cover max-h-96"
                      onError={(e) => (e.currentTarget.style.display = 'none')}
                    />
                  </div>
                )}

                {/* Action Bar (Like, Comment, Share) */}
                <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <div className="flex items-center space-x-4">
                    <button
                      onClick={() => handleToggleLike(post.id)}
                      className={`flex items-center space-x-1.5 py-1 px-2.5 rounded-lg transition ${
                        post.has_liked
                          ? 'text-red-500 font-bold bg-red-50 dark:bg-red-950/40'
                          : 'hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
                      }`}
                    >
                      <Heart className={`w-4 h-4 ${post.has_liked ? 'fill-current' : ''}`} />
                      <span>{post.likes_count || 0}</span>
                    </button>

                    <button
                      onClick={() => toggleComments(post.id)}
                      className="flex items-center space-x-1.5 py-1 px-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 transition"
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span>{post.comments_count || 0} Comments</span>
                    </button>
                  </div>

                  <button
                    onClick={async () => {
                      const url = window.location.href;
                      // navigator.clipboard requires a secure context and is the
                      // modern path. Fall back to execCommand('copy') for older
                      // browsers or non-HTTPS origins where the Clipboard API is
                      // unavailable — otherwise the button silently does nothing.
                      let copied = false;
                      try {
                        if (navigator.clipboard && navigator.clipboard.writeText) {
                          await navigator.clipboard.writeText(url);
                          copied = true;
                        }
                      } catch {
                        /* fall through to the legacy path */
                      }

                      if (!copied) {
                        const ta = document.createElement('textarea');
                        ta.value = url;
                        ta.style.position = 'fixed';
                        ta.style.opacity = '0';
                        document.body.appendChild(ta);
                        ta.select();
                        try {
                          document.execCommand('copy');
                          copied = true;
                        } catch {
                          /* last resort: show the URL in a prompt */
                          window.prompt('Copy this link to share the post:', url);
                        } finally {
                          document.body.removeChild(ta);
                        }
                      }

                      if (copied) {
                        alert('Post link copied to clipboard!');
                      }
                    }}
                    className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                    title="Share"
                  >
                    <Share2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Expandable Comments Section */}
                {activeCommentsPostId === post.id && (
                  <div className="bg-slate-50 dark:bg-slate-850/50 p-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
                    {/* Add Comment Input */}
                    <form onSubmit={(e) => handleAddComment(e, post.id)} className="flex items-center space-x-2">
                      <input id="Feed-commentInput" name="commentInput"
                        type="text"
                        value={commentInput}
                        onChange={(e) => setCommentInput(e.target.value)}
                        placeholder="Write a constructive comment or question..."
                        className="flex-1 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                      <button
                        type="submit"
                        disabled={submittingComment || !commentInput.trim()}
                        className="p-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white rounded-xl transition"
                      >
                        <Send className="w-3.5 h-3.5" />
                      </button>
                    </form>

                    {/* Comments List */}
                    <div className="space-y-2 mt-2">
                      {commentsMap[post.id]?.length === 0 ? (
                        <p className="text-[11px] text-slate-400 text-center py-2">No comments yet. Start the conversation!</p>
                      ) : (
                        commentsMap[post.id]?.map((c) => (
                          <div
                            key={c.id}
                            className="flex items-start space-x-2.5 p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 text-xs"
                          >
                            <img
                              src={c.author_avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${c.username}`}
                              alt={c.author_name}
                              className="w-7 h-7 rounded-full object-cover flex-shrink-0"
                            />
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-slate-900 dark:text-white text-[11px]">
                                  {c.author_name || c.username}
                                </span>
                                <span className="text-[10px] text-slate-400">
                                  {new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              <p className="text-slate-700 dark:text-slate-300 mt-0.5 leading-snug">{c.content}</p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Right Sidebar: Featured Early-Career Opportunities & Mentors */}
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200/80 dark:border-slate-800 p-5">
            <h4 className="font-bold text-sm text-slate-900 dark:text-white mb-3 flex items-center gap-1.5">
              <Briefcase className="w-4 h-4 text-brand-500" /> Early-Talent Opportunities
            </h4>
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 hover:border-brand-500 transition cursor-pointer">
                <p className="text-xs font-bold text-slate-900 dark:text-white">Junior Full-Stack Developer</p>
                <p className="text-[11px] text-slate-500">TechCorp Innovations • Remote</p>
                <span className="mt-1 inline-block text-[10px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 font-semibold">
                  Fresher Eligible
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 hover:border-brand-500 transition cursor-pointer">
                <p className="text-xs font-bold text-slate-900 dark:text-white">Frontend Engineering Intern</p>
                <p className="text-[11px] text-slate-500">TechCorp Innovations • Hybrid</p>
                <span className="mt-1 inline-block text-[10px] px-2 py-0.5 rounded bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 font-semibold">
                  Summer 2026
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200/80 dark:border-slate-800 p-5">
            <h4 className="font-bold text-sm text-slate-900 dark:text-white mb-3 flex items-center gap-1.5">
              <GraduationCap className="w-4 h-4 text-purple-500" /> Why CareerZen?
            </h4>
            <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-2 leading-relaxed">
              <li className="flex items-start gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-brand-500 flex-shrink-0 mt-0.5" />
                <span>Project-first profiles over empty resumes</span>
              </li>
              <li className="flex items-start gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-brand-500 flex-shrink-0 mt-0.5" />
                <span>Skills match calculator with direct feedback</span>
              </li>
              <li className="flex items-start gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-brand-500 flex-shrink-0 mt-0.5" />
                <span>Recruiter transparency & direct application tracking</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>

  {/* Edit Post Modal — sibling of the grid, not inside it, so the fixed
      overlay sits on top of the whole page rather than being clipped by
      the grid container. */}
  {editPostOpen && (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
          <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
            <Edit3 className="w-4 h-4 text-brand-500" /> Edit Post
          </h3>
          <button onClick={() => setEditPostOpen(false)} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <textarea
          value={editContent}
          onChange={(e) => setEditContent(e.target.value)}
          rows={5}
          className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 resize-none text-sm"
          placeholder="Edit your post..."
        />
        <div className="flex justify-end space-x-2 mt-4">
          <button
            type="button"
            onClick={() => setEditPostOpen(false)}
            className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSaveEdit}
            disabled={!editContent.trim()}
            className="px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-bold text-xs"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  )}
  </>
  );
}
