import React, { useState } from 'react';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { NotificationProvider } from './context/NotificationContext';
import Navbar from './components/Navbar';
import Feed from './components/Feed';
import NetworkView from './components/NetworkView';
import JobMarketplace from './components/JobMarketplace';
import RecruiterDashboard from './components/RecruiterDashboard';
import MessagesView from './components/MessagesView';
import ProfileView from './components/ProfileView';
import CollaborationHub from './components/CollaborationHub';
import AdminDashboard from './components/AdminDashboard';
import PlatformEcosystemModal from './components/PlatformEcosystemModal';
import AuthModal from './components/AuthModal';
import { Zap, Sparkles, Heart, Sun, Moon, Laptop } from 'lucide-react';

function FooterThemeSwitcher() {
  const { themeMode, setThemeMode } = useTheme();

  return (
    <div className="flex items-center space-x-1 p-0.5 rounded-xl bg-slate-200/70 dark:bg-slate-800/80 border border-slate-300/60 dark:border-slate-700/60 text-[11px]">
      <button
        onClick={() => setThemeMode('light')}
        className={`flex items-center space-x-1 px-2 py-1 rounded-lg transition font-medium ${
          themeMode === 'light'
            ? 'bg-white text-amber-600 shadow-sm font-bold'
            : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
        }`}
        title="Light Mode"
      >
        <Sun className="w-3 h-3 text-amber-500" />
        <span className="hidden sm:inline">Light</span>
      </button>

      <button
        onClick={() => setThemeMode('dark')}
        className={`flex items-center space-x-1 px-2 py-1 rounded-lg transition font-medium ${
          themeMode === 'dark'
            ? 'bg-slate-900 text-indigo-400 shadow-sm font-bold'
            : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
        }`}
        title="Dark Mode"
      >
        <Moon className="w-3 h-3 text-indigo-400" />
        <span className="hidden sm:inline">Dark</span>
      </button>

      <button
        onClick={() => setThemeMode('system')}
        className={`flex items-center space-x-1 px-2 py-1 rounded-lg transition font-medium ${
          themeMode === 'system'
            ? 'bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-300 shadow-sm font-bold border border-brand-200 dark:border-brand-800'
            : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
        }`}
        title="Sync with System Theme"
      >
        <Laptop className="w-3 h-3 text-slate-500" />
        <span className="hidden sm:inline">Auto</span>
      </button>
    </div>
  );
}

function AppContent() {
  const { user } = useAuth();
  const [currentTab, setCurrentTab] = useState('feed');
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [chatTargetUserId, setChatTargetUserId] = useState(null);
  const [ecosystemModalOpen, setEcosystemModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = (query) => {
    setSearchQuery(query);
    setCurrentTab('jobs');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectUser = (userId) => {
    setSelectedUserId(userId);
    setCurrentTab('profile');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenChat = (targetUserId) => {
    setChatTargetUserId(targetUserId);
    setCurrentTab('messages');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectJob = (jobId) => {
    setSelectedJobId(jobId);
    setCurrentTab('jobs');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleEcosystemNavigate = (tabName) => {
    setCurrentTab(tabName);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 transition-colors">
      <Navbar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        onSearch={handleSearch}
        onSelectUser={handleSelectUser}
        onOpenEcosystem={() => setEcosystemModalOpen(true)}
      />

      <main className="flex-1 pb-16">
        {currentTab === 'feed' && (
          <Feed
            onSelectUser={handleSelectUser}
            onSelectJob={handleSelectJob}
          />
        )}

        {currentTab === 'network' && (
          <NetworkView
            onSelectUser={handleSelectUser}
            onOpenChat={handleOpenChat}
          />
        )}

        {currentTab === 'jobs' && (
          <JobMarketplace
            searchQuery={searchQuery}
            onSelectJobId={selectedJobId}
            onSelectUser={handleSelectUser}
          />
        )}

        {currentTab === 'collab' && (
          <CollaborationHub
            onOpenChat={handleOpenChat}
            onSelectUser={handleSelectUser}
          />
        )}

        {currentTab === 'admin' && user?.role === 'admin' && (
          <AdminDashboard />
        )}

        {currentTab === 'recruiter' && (
          <RecruiterDashboard
            onOpenChat={handleOpenChat}
            onSelectUser={handleSelectUser}
          />
        )}

        {currentTab === 'messages' && (
          <MessagesView
            targetUserId={chatTargetUserId}
            onSelectUser={handleSelectUser}
          />
        )}

        {currentTab === 'profile' && (
          <ProfileView
            userId={selectedUserId || user?.id}
            onOpenChat={handleOpenChat}
            onSelectUser={handleSelectUser}
          />
        )}
      </main>

      {/* Platform Ecosystem 3-Pillar Explorer Modal */}
      <PlatformEcosystemModal
        isOpen={ecosystemModalOpen}
        onClose={() => setEcosystemModalOpen(false)}
        onNavigate={handleEcosystemNavigate}
      />

      {/* Global Auth Modal */}
      <AuthModal />

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800/80 bg-white/50 dark:bg-slate-900/50 py-8 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center text-white font-bold text-xs">
              <Zap className="w-3.5 h-3.5 fill-current" />
            </div>
            <span className="font-bold text-slate-800 dark:text-slate-200">
              CareerZen • Next-Gen Early-Career Network
            </span>
          </div>

          <div className="flex items-center gap-4">
            <FooterThemeSwitcher />
            <p className="flex items-center gap-1">
              Engineered with <Heart className="w-3.5 h-3.5 text-red-500 fill-current inline" /> for Students, Freshers & Early Talent
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <SocketProvider>
          <NotificationProvider>
            <AppContent />
          </NotificationProvider>
        </SocketProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
