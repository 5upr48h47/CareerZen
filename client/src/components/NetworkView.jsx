import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  Users,
  UserCheck,
  UserPlus,
  Clock,
  Check,
  X,
  MessageSquare,
  Sparkles,
  Search,
  MapPin,
  Building,
} from 'lucide-react';

export default function NetworkView({ onSelectUser, onOpenChat }) {
  const { user, openAuthModal } = useAuth();
  const [data, setData] = useState({ connections: [], incoming: [], outgoing: [] });
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchFilter, setSearchFilter] = useState('');
  const [activeTab, setActiveTab] = useState('suggestions'); // 'suggestions' | 'connections' | 'pending'

  useEffect(() => {
    fetchNetwork();
  }, []);

  async function fetchNetwork() {
    setLoading(true);
    try {
      const [net, sugg] = await Promise.all([api.getConnections(), api.getSuggestions()]);
      setData(net);
      setSuggestions(sugg);
    } catch (err) {
      console.error('Fetch network error:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleAccept(requestId) {
    try {
      await api.acceptConnection(requestId);
      await fetchNetwork();
    } catch (err) {
      alert(err.message || 'Failed to accept request');
    }
  }

  async function handleReject(requestId) {
    try {
      await api.rejectConnection(requestId);
      await fetchNetwork();
    } catch (err) {
      alert(err.message || 'Failed to decline request');
    }
  }

  async function handleSendRequest(targetUserId) {
    if (!user) return openAuthModal();
    try {
      await api.sendConnectionRequest(targetUserId);
      setSuggestions((prev) => prev.filter((s) => s.id !== targetUserId));
      await fetchNetwork();
    } catch (err) {
      alert(err.message || 'Failed to send request');
    }
  }

  async function handleRemoveConnection(targetUserId) {
    if (!confirm('Are you sure you want to remove this connection?')) return;
    try {
      await api.removeConnection(targetUserId);
      await fetchNetwork();
    } catch (err) {
      alert(err.message || 'Failed to remove connection');
    }
  }

  async function handleCancelRequest(targetUserId) {
    if (!confirm('Cancel this connection request?')) return;
    try {
      await api.removeConnectionRequest(targetUserId);
      await fetchNetwork();
    } catch (err) {
      alert(err.message || 'Failed to cancel request');
    }
  }

  const filteredConnections = data.connections.filter((c) => {
    const term = searchFilter.toLowerCase();
    return (
      (c.full_name && c.full_name.toLowerCase().includes(term)) ||
      (c.headline && c.headline.toLowerCase().includes(term)) ||
      (c.username && c.username.toLowerCase().includes(term))
    );
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Top Header Card */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-200/80 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-brand-500" /> Professional Network & Peer Discovery
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Build meaningful relationships with peers, open-source collaborators, and university recruiters.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center space-x-2 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl self-start md:self-auto text-xs font-bold">
          <button
            onClick={() => setActiveTab('suggestions')}
            className={`px-3.5 py-1.5 rounded-xl transition ${
              activeTab === 'suggestions'
                ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Discover ({suggestions.length})
          </button>
          <button
            onClick={() => setActiveTab('connections')}
            className={`px-3.5 py-1.5 rounded-xl transition ${
              activeTab === 'connections'
                ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Connections ({data.connections.length})
          </button>
          <button
            onClick={() => setActiveTab('pending')}
            className={`relative px-3.5 py-1.5 rounded-xl transition ${
              activeTab === 'pending'
                ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Requests ({data.incoming.length})
            {data.incoming.length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 text-[9px] bg-red-500 text-white rounded-full">
                {data.incoming.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Incoming Requests Banner (if any exist) */}
      {data.incoming.length > 0 && activeTab !== 'pending' && (
        <div className="bg-gradient-to-r from-brand-50 to-indigo-50 dark:from-brand-950/40 dark:to-indigo-950/40 rounded-3xl p-5 border border-brand-200/80 dark:border-brand-900/60 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-brand-900 dark:text-brand-300 uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-brand-600" /> Pending Connection Requests ({data.incoming.length})
            </h3>
            <button
              onClick={() => setActiveTab('pending')}
              className="text-xs font-bold text-brand-600 dark:text-brand-400 hover:underline"
            >
              View All
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {data.incoming.slice(0, 3).map((req) => (
              <div
                key={req.request_id}
                className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between"
              >
                <div
                  onClick={() => onSelectUser && onSelectUser(req.sender_id)}
                  className="flex items-center space-x-2.5 cursor-pointer flex-1 min-w-0"
                >
                  <img
                    src={req.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${req.username}`}
                    alt={req.full_name}
                    className="w-10 h-10 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-xs text-slate-900 dark:text-white truncate">
                      {req.full_name || req.username}
                    </p>
                    <p className="text-[10px] text-slate-400 truncate">{req.headline}</p>
                  </div>
                </div>

                <div className="flex items-center space-x-1 ml-2">
                  <button
                    onClick={() => handleAccept(req.request_id)}
                    className="p-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition"
                    title="Accept"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleReject(req.request_id)}
                    className="p-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-500 rounded-lg transition"
                    title="Decline"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Tab Content */}
      {activeTab === 'suggestions' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-500" /> Recommended Peers & Early-Talent Recruiters
            </h2>
            <span className="text-xs text-slate-400">Based on your tech stack and interests</span>
          </div>

          {suggestions.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-12 text-center border border-slate-200 dark:border-slate-800">
              <Users className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
              <p className="text-xs text-slate-500">You're connected with everyone available!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {suggestions.map((sug) => (
                <div
                  key={sug.id}
                  className="bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-sm border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between hover:shadow-md hover:border-brand-500/40 transition"
                >
                  <div>
                    <div
                      onClick={() => onSelectUser && onSelectUser(sug.id)}
                      className="cursor-pointer text-center"
                    >
                      <img
                        src={sug.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${sug.username}`}
                        alt={sug.full_name}
                        className="w-16 h-16 rounded-full object-cover mx-auto border-2 border-slate-200 dark:border-slate-700 mb-3"
                      />
                      <h3 className="font-bold text-xs text-slate-900 dark:text-white hover:text-brand-600 dark:hover:text-brand-400 transition truncate">
                        {sug.full_name || sug.username}
                      </h3>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 mt-1 min-h-[32px]">
                        {sug.headline || 'CareerZen Member'}
                      </p>
                    </div>

                    {sug.top_skills && sug.top_skills.length > 0 && (
                      <div className="flex flex-wrap gap-1 justify-center mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                        {sug.top_skills.map((sk, idx) => (
                          <span
                            key={idx}
                            className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold"
                          >
                            {sk}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => handleSendRequest(sug.id)}
                    className="mt-4 w-full py-2 bg-brand-50 hover:bg-brand-600 text-brand-700 hover:text-white dark:bg-brand-950/60 dark:text-brand-300 dark:hover:bg-brand-600 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1 border border-brand-200 dark:border-brand-800"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Connect</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'connections' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
              <UserCheck className="w-4 h-4 text-emerald-500" /> My Connections ({filteredConnections.length})
            </h2>

            <div className="relative max-w-xs w-full">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input id="NetworkView-searchFilter" name="searchFilter"
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Filter connections by name or title..."
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          {filteredConnections.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-12 text-center border border-slate-200 dark:border-slate-800">
              <Users className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
              <p className="text-xs text-slate-500">
                {searchFilter ? 'No connections match your filter.' : 'You haven’t connected with anyone yet.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredConnections.map((conn) => (
                <div
                  key={conn.connection_id}
                  className="bg-white dark:bg-slate-900 rounded-3xl p-4 shadow-sm border border-slate-200/80 dark:border-slate-800 flex items-start justify-between gap-3"
                >
                  <div
                    onClick={() => onSelectUser && onSelectUser(conn.user_id)}
                    className="flex items-start space-x-3 cursor-pointer flex-1 min-w-0"
                  >
                    <img
                      src={conn.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${conn.username}`}
                      alt={conn.full_name}
                      className="w-12 h-12 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-xs text-slate-900 dark:text-white truncate hover:text-brand-600 transition">
                        {conn.full_name || conn.username}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5">
                        {conn.headline}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col space-y-1">
                    <button
                      onClick={() => onOpenChat && onOpenChat(conn.user_id)}
                      className="p-2 bg-brand-50 hover:bg-brand-100 dark:bg-brand-950/60 dark:hover:bg-brand-900/60 text-brand-600 dark:text-brand-300 rounded-xl transition"
                      title="Send Message"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleRemoveConnection(conn.user_id)}
                      className="p-2 text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded-xl transition"
                      title="Remove connection"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'pending' && (
        <div className="space-y-6">
          {/* Incoming */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Incoming Requests ({data.incoming.length})
            </h3>
            {data.incoming.length === 0 ? (
              <p className="text-xs text-slate-400 py-3">No pending incoming requests.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {data.incoming.map((req) => (
                  <div
                    key={req.request_id}
                    className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 flex items-center justify-between"
                  >
                    <div
                      onClick={() => onSelectUser && onSelectUser(req.sender_id)}
                      className="flex items-center space-x-3 cursor-pointer flex-1 min-w-0"
                    >
                      <img
                        src={req.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${req.username}`}
                        alt={req.full_name}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-xs text-slate-900 dark:text-white truncate">
                          {req.full_name || req.username}
                        </p>
                        <p className="text-[10px] text-slate-400 truncate">{req.headline}</p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-1.5 ml-2">
                      <button
                        onClick={() => handleAccept(req.request_id)}
                        className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold transition"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => handleReject(req.request_id)}
                        className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl text-xs font-bold transition"
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Outgoing */}
          <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Outgoing Requests Sent ({data.outgoing.length})
            </h3>
            {data.outgoing.length === 0 ? (
              <p className="text-xs text-slate-400 py-3">No pending outgoing requests.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {data.outgoing.map((req) => (
                  <div
                    key={req.request_id}
                    className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 flex items-center justify-between"
                  >
                    <div
                      onClick={() => onSelectUser && onSelectUser(req.receiver_id)}
                      className="flex items-center space-x-3 cursor-pointer flex-1 min-w-0"
                    >
                      <img
                        src={req.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${req.username}`}
                        alt={req.full_name}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-xs text-slate-900 dark:text-white truncate">
                          {req.full_name || req.username}
                        </p>
                        <p className="text-[10px] text-slate-400 truncate">{req.headline}</p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 ml-2">
                      <span className="text-[10px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/60 px-2 py-1 rounded-lg">
                        Pending
                      </span>
                      <button
                        onClick={() => handleCancelRequest(req.receiver_id)}
                        className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-lg transition"
                        title="Cancel request"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
