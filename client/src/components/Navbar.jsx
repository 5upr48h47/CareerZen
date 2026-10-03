import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { useTheme } from '../context/ThemeContext';
import {
  Briefcase,
  Users,
  MessageSquare,
  Bell,
  Home,
  User,
  PlusCircle,
  Building,
  LogOut,
  ChevronDown,
  Search,
  X,
  Sparkles,
  Sun,
  Moon,
  Zap,
  ShieldCheck,
  Laptop,
  Check,
  Crown,
} from 'lucide-react';
import PremiumModal from './PremiumModal';


export default function Navbar({ currentTab, setCurrentTab, onSearch, onSelectUser, onOpenEcosystem }) {
  const { user, logout, openAuthModal } = useAuth();
  const { unreadCount, notifications, markAsRead, markAllAsRead } = useNotifications();
  const { themeMode, effectiveTheme, isDark, toggleTheme, setThemeMode } = useTheme();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [notifDropdownOpen, setNotifDropdownOpen] = useState(false);
  const [themeDropdownOpen, setThemeDropdownOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [premiumOpen, setPremiumOpen] = useState(false);

  const notifRef = useRef(null);
  const themeRef = useRef(null);
  const profileRef = useRef(null);

  // Close all dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifDropdownOpen(false);
      }
      if (themeRef.current && !themeRef.current.contains(e.target)) {
        setThemeDropdownOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Cmd/Ctrl+K to open floating search
  useEffect(() => {
    function handleKeyDown(e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
      if (e.key === 'Escape') {
        setSearchOpen(false);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (onSearch) onSearch(searchTerm);
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Brand Logo */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setCurrentTab('feed')}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center text-white shadow-lg shadow-brand-500/25">
              <Zap className="w-6 h-6 fill-current" />
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-brand-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent dark:from-brand-400 dark:to-indigo-300">
                  CareerZen
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-brand-50 text-brand-700 dark:bg-brand-900/50 dark:text-brand-300 border border-brand-200 dark:border-brand-700">
                  Social • Jobs • AI
                </span>
              </div>
            </div>
          </div>

          {/* Quick 3-Pillar Ecosystem Explorer Button */}
          {onOpenEcosystem && (
            <button
              onClick={onOpenEcosystem}
              className="hidden lg:flex items-center space-x-1.5 px-3 py-1 text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-brand-50 hover:text-brand-600 dark:hover:bg-brand-950/60 dark:hover:text-brand-300 rounded-full border border-slate-200 dark:border-slate-700 transition"
              title="View the 3-Pillar Platform Map"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Platform Matrix</span>
            </button>
          )}

          {/* Global Search Bar - icon that opens floating search */}
          <div className="hidden md:flex flex-1 justify-center">
            <button
              onClick={() => setSearchOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-slate-400 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
              title="Search (⌘K)"
            >
              <Search className="w-3.5 h-3.5 flex-shrink-0" />
              <kbd className="hidden sm:inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-500">
                ⌘K
              </kbd>
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="flex items-center space-x-1 sm:space-x-2">
            <button
              onClick={() => setCurrentTab('feed')}
              className={`flex flex-col items-center justify-center px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                currentTab === 'feed'
                  ? 'text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-950/40'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Home className="w-4 h-4 mb-0.5" />
              <span>Feed</span>
            </button>

            <button
              onClick={() => setCurrentTab('network')}
              className={`flex flex-col items-center justify-center px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                currentTab === 'network'
                  ? 'text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-950/40'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Users className="w-4 h-4 mb-0.5" />
              <span>Network</span>
            </button>

            <button
              onClick={() => setCurrentTab('jobs')}
              className={`flex flex-col items-center justify-center px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                currentTab === 'jobs'
                  ? 'text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-950/40'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Briefcase className="w-4 h-4 mb-0.5" />
              <span>Jobs Hub</span>
            </button>

            {/* Collab Hub */}
            <button
              onClick={() => setCurrentTab('collab')}
              className={`flex flex-col items-center justify-center px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                currentTab === 'collab'
                  ? 'text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-950/40'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Users className="w-4 h-4 mb-0.5 text-indigo-500" />
              <span>Collab Hub</span>
            </button>

            <button
              onClick={() => setCurrentTab('messages')}
              className={`flex flex-col items-center justify-center px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                currentTab === 'messages'
                  ? 'text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-950/40'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <MessageSquare className="w-4 h-4 mb-0.5" />
              <span>Messages</span>
            </button>

            {user?.role === 'admin' && (
              <button
                onClick={() => setCurrentTab('admin')}
                className={`flex flex-col items-center justify-center px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  currentTab === 'admin' ? 'text-amber-600 bg-amber-50 dark:bg-amber-950/40' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
                title="Admin Control Center"
              >
                <ShieldCheck className="w-4 h-4 mb-0.5" />
                <span>Admin</span>
              </button>
            )}

            {/* Notifications with badge */}
            <div className="relative">
              <button
                onClick={() => setNotifDropdownOpen(!notifDropdownOpen)}
                className={`relative flex flex-col items-center justify-center px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  notifDropdownOpen
                    ? 'text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-950/40'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <div className="relative">
                  <Bell className="w-4 h-4 mb-0.5" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1.5 -right-2 px-1.5 py-0.2 text-[10px] font-bold rounded-full bg-red-500 text-white animate-pulse">
                      {unreadCount}
                    </span>
                  )}
                </div>
                <span>Alerts</span>
              </button>

              {/* Notifications Dropdown Panel */}
              {notifDropdownOpen && (
                <div ref={notifRef} className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-4 z-50 animate-fadeIn">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-2">
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Bell className="w-4 h-4 text-brand-500" /> Notifications
                    </h3>
                    {unreadCount > 0 && (
                      <button
                        onClick={markAllAsRead}
                        className="text-xs text-brand-600 dark:text-brand-400 hover:underline font-medium"
                      >
                        Mark all as read
                      </button>
                    )}
                  </div>

                  <div className="max-h-80 overflow-y-auto space-y-2">
                    {notifications.length === 0 ? (
                      <div className="text-center py-8 text-slate-400 text-xs">
                        No notifications yet.
                      </div>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          onClick={() => {
                            markAsRead(n.id);
                            if (n.type === 'like' || n.type === 'comment') setCurrentTab('feed');
                            else if (n.type === 'connection_request' || n.type === 'connection_accepted') setCurrentTab('network');
                            else if (n.type === 'application_status' || n.type === 'job_applied') setCurrentTab('jobs');
                            else if (n.type === 'new_message') setCurrentTab('messages');
                            setNotifDropdownOpen(false);
                          }}
                          className={`p-3 rounded-xl cursor-pointer transition text-xs flex items-start gap-3 ${
                            n.is_read
                              ? 'bg-slate-50/50 dark:bg-slate-800/30 text-slate-600 dark:text-slate-400'
                              : 'bg-brand-50/60 dark:bg-brand-950/40 text-slate-900 dark:text-slate-100 font-medium border border-brand-100 dark:border-brand-900/50'
                          }`}
                        >
                          <div className="w-7 h-7 rounded-full bg-brand-100 dark:bg-brand-900/60 text-brand-600 flex items-center justify-center flex-shrink-0 text-xs font-bold">
                            {n.type === 'like' ? '❤️' : n.type === 'comment' ? '💬' : n.type === 'connection_request' ? '👥' : '⚡'}
                          </div>
                          <div className="flex-1">
                            <p className="line-clamp-2 leading-relaxed">{n.message}</p>
                            <span className="text-[10px] text-slate-400 mt-1 block">
                              {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Recruiter Tab / Hub */}
            {user?.role === 'recruiter' && (
              <button
                onClick={() => setCurrentTab('recruiter')}
                className={`flex flex-col items-center justify-center px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  currentTab === 'recruiter'
                    ? 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Building className="w-4 h-4 mb-0.5" />
                <span className="text-purple-600 dark:text-purple-400 font-semibold">Recruiter Hub</span>
              </button>
            )}
          </nav>

          {/* Right Action Tools */}
          <div className="flex items-center space-x-2">
            {/* Dark & Light mode toggle with dropdown option */}
            <div className="relative">
              <button
                onClick={() => setThemeDropdownOpen(!themeDropdownOpen)}
                className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-full text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition text-xs font-semibold border border-slate-200/80 dark:border-slate-800"
                title={`Theme: ${themeMode} (${effectiveTheme})`}
                aria-label="Toggle theme"
              >
                {effectiveTheme === 'dark' ? (
                  <Moon className="w-4 h-4 text-indigo-400 fill-indigo-400/20" />
                ) : (
                  <Sun className="w-4 h-4 text-amber-500 fill-amber-500/20" />
                )}
                <span className="hidden sm:inline capitalize text-[11px] font-medium">
                  {themeMode === 'system' ? 'Auto' : themeMode}
                </span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              {themeDropdownOpen && (
                <div
                  ref={themeRef}
                  className="absolute right-0 mt-2 w-44 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-1.5 z-50 animate-fadeIn text-xs"
                  onMouseLeave={() => setThemeDropdownOpen(false)}
                >
                  <div className="px-2.5 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Appearance
                  </div>

                  <button
                    onClick={() => {
                      setThemeMode('light');
                      setThemeDropdownOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl transition ${
                      themeMode === 'light'
                        ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-300 font-bold'
                        : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span className="flex items-center space-x-2">
                      <Sun className="w-3.5 h-3.5 text-amber-500" />
                      <span>Light Mode</span>
                    </span>
                    {themeMode === 'light' && <Check className="w-3.5 h-3.5 text-amber-600" />}
                  </button>

                  <button
                    onClick={() => {
                      setThemeMode('dark');
                      setThemeDropdownOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl transition ${
                      themeMode === 'dark'
                        ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-300 font-bold'
                        : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span className="flex items-center space-x-2">
                      <Moon className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Dark Mode</span>
                    </span>
                    {themeMode === 'dark' && <Check className="w-3.5 h-3.5 text-indigo-400" />}
                  </button>

                  <button
                    onClick={() => {
                      setThemeMode('system');
                      setThemeDropdownOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl transition ${
                      themeMode === 'system'
                        ? 'bg-brand-50 dark:bg-brand-950/40 text-brand-900 dark:text-brand-300 font-bold'
                        : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span className="flex items-center space-x-2">
                      <Laptop className="w-3.5 h-3.5 text-slate-500" />
                      <span>System Sync</span>
                    </span>
                    {themeMode === 'system' && <Check className="w-3.5 h-3.5 text-brand-600" />}
                  </button>
                </div>
              )}
            </div>

            {/* User Profile Avatar / Sign In */}
            {user ? (
              <div className="relative">
                <button
                  onClick={() => setProfileMenuOpen(!profileMenuOpen)}
                  className="flex items-center space-x-2 p-1 rounded-full hover:ring-2 hover:ring-brand-500 transition"
                >
                  <div className="relative">
                    <img
                      src={user.profile?.avatar_url || user.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`}
                      alt={user.profile?.full_name || user.username}
                      className="w-8 h-8 rounded-full object-cover border-2 border-brand-500 shadow"
                    />
                    {user.aadhaar_verified && (
                      <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 text-white flex items-center justify-center border border-white dark:border-slate-900" title="Aadhaar Verified">
                        <ShieldCheck className="w-2.5 h-2.5" />
                      </span>
                    )}
                  </div>
                </button>

                {profileMenuOpen && (
                  <div ref={profileRef} className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-2 z-50 animate-fadeIn">
                    <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800">
                      <div className="flex items-center space-x-1.5">
                        <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {user.profile?.full_name || user.username}
                        </p>
                        {user.aadhaar_verified && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 font-bold border border-emerald-200 dark:border-emerald-800 flex items-center gap-0.5">
                            <ShieldCheck className="w-2.5 h-2.5 text-emerald-600" />
                            <span>Verified</span>
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-500 truncate mt-0.5">@{user.username} • {user.email}</p>
                    </div>

                    <div className="mt-1 space-y-1">
                      <button
                        onClick={() => {
                          if (onSelectUser) onSelectUser(user.id);
                          setCurrentTab('profile');
                          setProfileMenuOpen(false);
                        }}
                        className="w-full flex items-center space-x-2 px-3 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
                      >
                        <User className="w-3.5 h-3.5" />
                        <span>My Profile & KYC</span>
                      </button>
                      <button
                        onClick={() => {
                          setPremiumOpen(true);
                          setProfileMenuOpen(false);
                        }}
                        className="w-full flex items-center space-x-2 px-3 py-2 text-xs text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/50 rounded-lg transition"
                      >
                        <Crown className="w-3.5 h-3.5" />
                        <span>Premium &amp; Plans</span>
                      </button>
                      {user.role === 'recruiter' && (
                        <button
                          onClick={() => {
                            setCurrentTab('recruiter');
                            setProfileMenuOpen(false);
                          }}
                          className="w-full flex items-center space-x-2 px-3 py-2 text-xs text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/50 rounded-lg transition"
                        >
                          <Building className="w-3.5 h-3.5" />
                          <span>Recruiter Dashboard</span>
                        </button>
                      )}
                      {/* Theme Quick Selector in Menu */}
                      <div className="pt-2 pb-1 px-1 border-t border-slate-100 dark:border-slate-800">
                        <div className="text-[10px] font-semibold text-slate-400 mb-1.5 px-2 flex items-center justify-between">
                          <span>Theme Mode</span>
                          <span className="capitalize text-brand-600 dark:text-brand-400 font-bold">{themeMode}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                          <button
                            type="button"
                            onClick={() => setThemeMode('light')}
                            className={`flex items-center justify-center space-x-1 py-1 px-1.5 rounded-lg text-[10px] font-bold transition ${
                              themeMode === 'light'
                                ? 'bg-white text-slate-900 shadow-sm'
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                            }`}
                            title="Light mode"
                          >
                            <Sun className="w-3 h-3 text-amber-500" />
                            <span>Light</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setThemeMode('dark')}
                            className={`flex items-center justify-center space-x-1 py-1 px-1.5 rounded-lg text-[10px] font-bold transition ${
                              themeMode === 'dark'
                                ? 'bg-slate-900 text-white shadow-sm'
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                            }`}
                            title="Dark mode"
                          >
                            <Moon className="w-3 h-3 text-indigo-400" />
                            <span>Dark</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setThemeMode('system')}
                            className={`flex items-center justify-center space-x-1 py-1 px-1.5 rounded-lg text-[10px] font-bold transition ${
                              themeMode === 'system'
                                ? 'bg-white dark:bg-slate-700 text-brand-600 dark:text-brand-300 shadow-sm'
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                            }`}
                            title="System sync"
                          >
                            <Laptop className="w-3 h-3 text-slate-500" />
                            <span>Auto</span>
                          </button>
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          logout();
                          setProfileMenuOpen(false);
                        }}
                        className="w-full flex items-center space-x-2 px-3 py-2 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-lg transition border-t border-slate-100 dark:border-slate-800"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => openAuthModal('login')}
                  className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition"
                >
                  Sign In
                </button>
                <button
                  onClick={() => openAuthModal('register')}
                  className="px-3.5 py-1.5 text-xs font-semibold bg-brand-600 hover:bg-brand-700 text-white rounded-full transition shadow-sm"
                >
                  Join CareerZen
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Floating Search Modal */}
      {searchOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] sm:pt-[20vh] px-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn"
          onClick={() => { setSearchOpen(false); }}
        >
          <div
            className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-scaleIn"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center px-3 py-2 border-b border-slate-100 dark:border-slate-800">
              <Search className="w-4 h-4 text-slate-400 mr-2 flex-shrink-0" />
              <input id="Navbar-searchTerm" name="searchTerm"
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search jobs, projects, skills..."
                autoFocus
                className="flex-1 bg-transparent text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 outline-none"
              />
              <button
                onClick={() => { setSearchTerm(''); }}
                className={`text-slate-400 hover:text-slate-600 transition ${searchTerm ? 'opacity-100' : 'opacity-0'}`}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="p-2">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 px-2">Quick Actions</p>
              <button
                onClick={() => { handleSearchSubmit({ preventDefault: () => {} }); }}
                className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] font-medium text-slate-700 dark:text-slate-200 hover:bg-brand-50 dark:hover:bg-brand-950/40 hover:text-brand-600 transition"
              >
                <Briefcase className="w-3.5 h-3.5 text-brand-500" />
                Search Jobs
              </button>
              <button
                onClick={() => { setCurrentTab('feed'); setSearchOpen(false); }}
                className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] font-medium text-slate-700 dark:text-slate-200 hover:bg-brand-50 dark:hover:bg-brand-950/40 hover:text-brand-600 transition"
              >
                <Home className="w-3.5 h-3.5 text-brand-500" />
                Browse Feed
              </button>
            </div>
          </div>
        </div>
      )}
      <PremiumModal isOpen={premiumOpen} onClose={() => setPremiumOpen(false)} />
    </header>
  );
}
