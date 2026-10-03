import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import {
  MessageSquare,
  Send,
  User,
  Search,
  CheckCheck,
  Check,
  Sparkles,
  ExternalLink,
} from 'lucide-react';

export default function MessagesView({ targetUserId, onSelectUser }) {
  const { user } = useAuth();
  const { on, isConnected } = useSocket();

  const [conversations, setConversations] = useState([]);
  const [activeUserId, setActiveUserId] = useState(targetUserId || null);
  const [activeUser, setActiveUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [loadingConv, setLoadingConv] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [searchConv, setSearchConv] = useState('');

  const messagesEndRef = useRef(null);

  useEffect(() => {
    fetchConversations();
  }, [user?.id]);

  useEffect(() => {
    if (targetUserId) {
      setActiveUserId(targetUserId);
    }
  }, [targetUserId]);

  useEffect(() => {
    if (activeUserId) {
      fetchMessages(activeUserId);
    }
  }, [activeUserId]);

  // Poll for new messages even when the WebSocket is down. Browsers throttle
  // timers in background tabs and drop connections, so real-time delivery
  // alone is not enough — without this the chat only updates on refresh.
  useEffect(() => {
    if (!user) return;
    const id = setInterval(() => {
      fetchConversations();
      if (activeUserId) fetchMessages(activeUserId);
    }, 15000);
    return () => clearInterval(id);
  }, [user, activeUserId]);

  // Real-time socket message handler
  useEffect(() => {
    const unsubscribe = on('new_message', (data) => {
      const msg = data.message;
      // If current open conversation is with this sender
      if (activeUserId && (msg.sender_id === activeUserId || msg.receiver_id === activeUserId)) {
        setMessages((prev) => [...prev, msg]);
        scrollToBottom();
      }
      // Update conversations list snippet
      fetchConversations();
    });

    return () => unsubscribe();
  }, [on, activeUserId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }

  async function fetchConversations() {
    try {
      const list = await api.getConversations();
      setConversations(list);
      if (!activeUserId && list.length > 0) {
        setActiveUserId(list[0].other_user_id);
      }
    } catch (err) {
      console.error('Fetch conversations error:', err);
    } finally {
      setLoadingConv(false);
    }
  }

  async function fetchMessages(otherId) {
    setLoadingMessages(true);
    try {
      const data = await api.getMessages(otherId);
      setActiveUser(data.otherUser);
      setMessages(data.messages || []);
    } catch (err) {
      console.error('Fetch messages error:', err);
    } finally {
      setLoadingMessages(false);
    }
  }

  async function handleSendMessage(e) {
    e.preventDefault();
    if (!messageText.trim() || !activeUserId) return;

    const content = messageText.trim();
    setMessageText('');

    try {
      const sentMsg = await api.sendMessage({
        receiverId: activeUserId,
        content
      });

      setMessages((prev) => [...prev, sentMsg]);
      scrollToBottom();
      fetchConversations();
    } catch (err) {
      console.error('Send message error:', err);
    }
  }

  const filteredConversations = conversations.filter((c) => {
    const term = searchConv.toLowerCase();
    return (
      (c.other_name && c.other_name.toLowerCase().includes(term)) ||
      (c.other_username && c.other_username.toLowerCase().includes(term))
    );
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200/80 dark:border-slate-800 h-[750px] flex overflow-hidden">
        {/* Left Sidebar: Conversations list */}
        <div className="w-full sm:w-80 md:w-96 border-r border-slate-200 dark:border-slate-800 flex flex-col">
          {/* Header & Search */}
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 space-y-3">
            <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-brand-500" /> Direct Messages
            </h2>
            <div className="relative">
              <label htmlFor="msg-search" className="sr-only">Search conversations</label>
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="msg-search"
                name="search"
                type="text"
                value={searchConv}
                onChange={(e) => setSearchConv(e.target.value)}
                placeholder="Search conversations..."
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60">
            {loadingConv ? (
              <div className="text-center py-12 text-xs text-slate-400">Loading messages...</div>
            ) : filteredConversations.length === 0 ? (
              <div className="text-center py-12 px-4 text-xs text-slate-400">
                No active conversations yet. Visit a profile or applicant card to start a chat!
              </div>
            ) : (
              filteredConversations.map((conv) => {
                const isSelected = activeUserId === conv.other_user_id;
                return (
                  <div
                    key={conv.id}
                    onClick={() => setActiveUserId(conv.other_user_id)}
                    className={`p-4 cursor-pointer transition flex items-start space-x-3 ${
                      isSelected
                        ? 'bg-brand-50/70 dark:bg-brand-950/40 border-l-4 border-brand-500'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-850/50'
                    }`}
                  >
                    <img
                      src={conv.other_avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${conv.other_username}`}
                      alt={conv.other_name}
                      className="w-11 h-11 rounded-full object-cover border border-slate-200 dark:border-slate-700 flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-xs text-slate-900 dark:text-white truncate">
                          {conv.other_name || conv.other_username}
                        </h4>
                        <span className="text-[10px] text-slate-400">
                          {conv.last_message_time &&
                            new Date(conv.last_message_time).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 truncate mt-0.5">
                        {conv.last_message || 'Start conversation'}
                      </p>
                    </div>

                    {conv.unread_count > 0 && (
                      <span className="w-5 h-5 rounded-full bg-brand-600 text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                        {conv.unread_count}
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Pane: Active Chat Window */}
        <div className="hidden sm:flex flex-1 flex-col bg-slate-50/50 dark:bg-slate-900/50">
          {activeUserId && activeUser ? (
            <>
              {/* Chat Header */}
              <div className="p-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div
                  onClick={() => onSelectUser && onSelectUser(activeUser.id)}
                  className="flex items-center space-x-3 cursor-pointer"
                >
                  <img
                    src={activeUser.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${activeUser.username}`}
                    alt={activeUser.full_name}
                    className="w-10 h-10 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                  />
                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 className="font-bold text-sm text-slate-900 dark:text-white hover:text-brand-600 transition">
                        {activeUser.full_name || activeUser.username}
                      </h3>
                      {activeUser.role === 'recruiter' && (
                        <span className="text-[10px] font-bold px-2 py-0.2 rounded bg-purple-100 text-purple-700 dark:bg-purple-950/80 dark:text-purple-300">
                          Recruiter
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 truncate max-w-sm">
                      {activeUser.headline || 'CareerZen Member'}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => onSelectUser && onSelectUser(activeUser.id)}
                  className="text-xs text-brand-600 dark:text-brand-400 font-semibold hover:underline flex items-center gap-1"
                >
                  <span>View Profile</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              </div>

              {/* Message Thread */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {loadingMessages ? (
                  <div className="text-center py-12 text-xs text-slate-400">Loading conversation history...</div>
                ) : messages.length === 0 ? (
                  <div className="text-center py-12 text-xs text-slate-400">
                    <Sparkles className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
                    Say hello to {activeUser.full_name || activeUser.username}!
                  </div>
                ) : (
                  messages.map((m) => {
                    const isMe = m.sender_id === user?.id;
                    return (
                      <div
                        key={m.id}
                        className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                      >
                        <div
                          className={`max-w-md p-3.5 rounded-2xl text-xs leading-relaxed ${
                            isMe
                              ? 'bg-brand-600 text-white rounded-br-none shadow-sm'
                              : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-bl-none border border-slate-200/80 dark:border-slate-700/60 shadow-sm'
                          }`}
                        >
                          <p>{m.content}</p>
                        </div>
                        <div className="flex items-center space-x-1 mt-1 text-[10px] text-slate-400 px-1">
                          <span>
                            {new Date(m.created_at).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                          {isMe && (
                            <span>
                              {m.is_read ? (
                                <CheckCheck className="w-3 h-3 text-brand-500 inline" />
                              ) : (
                                <Check className="w-3 h-3 inline" />
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input Box */}
              <form
                onSubmit={handleSendMessage}
                className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center space-x-2"
              >
                <input
                  id="msg-compose"
                  name="message"
                  type="text"
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder={`Write a message to ${activeUser.full_name || activeUser.username}...`}
                  className="flex-1 text-xs rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-3 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                <button
                  type="submit"
                  disabled={!messageText.trim()}
                  className="p-3 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white rounded-2xl transition shadow-md shadow-brand-500/20"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8 text-center">
              <MessageSquare className="w-12 h-12 text-slate-300 dark:text-slate-700 mb-2" />
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">Your Direct Messages</h3>
              <p className="text-xs mt-1">Select a chat on the left to start communicating in real time.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
