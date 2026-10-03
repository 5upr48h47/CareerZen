import React from 'react';
import {
  Sparkles,
  Users,
  Briefcase,
  Bot,
  MessageSquare,
  FileText,
  Building,
  Mic,
  CheckCircle2,
  TrendingUp,
  X,
  ArrowRight,
  Zap,
  Globe,
  Award,
} from 'lucide-react';

export default function PlatformEcosystemModal({ isOpen, onClose, onNavigate }) {
  if (!isOpen) return null;

  const pillars = [
    {
      id: 'social',
      title: 'Social & Network Pillar',
      icon: Users,
      badge: 'Community & Peer Graph',
      gradient: 'from-blue-600 to-cyan-600',
      bgLight: 'bg-blue-50/70 dark:bg-blue-950/40',
      borderLight: 'border-blue-200 dark:border-blue-800/60',
      textColor: 'text-blue-700 dark:text-blue-300',
      items: [
        {
          name: 'Posts & Feed',
          desc: 'Share project updates, milestones, code showcases, and like/comment in real-time.',
          action: () => {
            onNavigate('feed');
            onClose();
          }
        },
        {
          name: 'Peer Network',
          desc: 'Build connections with early engineers, explore suggested peers, and grow your network.',
          action: () => {
            onNavigate('network');
            onClose();
          }
        },
        {
          name: '1-on-1 Messages',
          desc: 'Real-time WebSocket direct messaging with candidates, peers, and technical recruiters.',
          action: () => {
            onNavigate('messages');
            onClose();
          }
        },
        {
          name: 'Collab & Hackathons',
          desc: 'Find teammates and co-builders for hackathons, capstones, and open-source projects.',
          action: () => {
            onNavigate('collab');
            onClose();
          }
        }
      ]
    },
    {
      id: 'jobs',
      title: 'Jobs & Recruiter Pillar',
      icon: Briefcase,
      badge: 'Early-Talent Marketplace',
      gradient: 'from-emerald-600 to-teal-600',
      bgLight: 'bg-emerald-50/70 dark:bg-emerald-950/40',
      borderLight: 'border-emerald-200 dark:border-emerald-800/60',
      textColor: 'text-emerald-700 dark:text-emerald-300',
      items: [
        {
          name: 'Jobs Marketplace',
          desc: 'Curated roles for students and freshers with transparent salary and skill match metrics.',
          action: () => {
            onNavigate('jobs');
            onClose();
          }
        },
        {
          name: 'Recruiter Hub',
          desc: 'Post company openings, manage candidate pipelines, review applications, and update status.',
          action: () => {
            onNavigate('recruiter');
            onClose();
          }
        },
        {
          name: 'Tracked Applications',
          desc: 'Live candidate application tracking with recruiter feedback, bookmarks, and status sync.',
          action: () => {
            onNavigate('jobs');
            onClose();
          }
        },
        {
          name: 'Company Profiles',
          desc: 'Transparent company cultures, tech stacks, and hiring manager connections.',
          action: () => {
            onNavigate('jobs');
            onClose();
          }
        }
      ]
    },
    {
      id: 'ai',
      title: 'AI Intelligence Pillar',
      icon: Sparkles,
      badge: 'Career Growth Engine',
      gradient: 'from-purple-600 to-indigo-600',
      bgLight: 'bg-purple-50/70 dark:bg-purple-950/40',
      borderLight: 'border-purple-200 dark:border-purple-800/60',
      textColor: 'text-purple-700 dark:text-purple-300',
      items: [
        {
          name: 'AI Job & Skill Matching',
          desc: 'Deep skill gap analyzer with personalized 3-day project blueprints to bridge missing skills.',
          action: () => {
            onNavigate('jobs');
            onClose();
          }
        }
      ]
    }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-md p-4 animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-5xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[90vh] overflow-y-auto space-y-6">
        {/* Header with Diagram Banner */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-brand-50 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300 text-xs font-bold border border-brand-200 dark:border-brand-800">
              <Zap className="w-3.5 h-3.5 fill-current" />
              <span>CareerZen Architecture Matrix</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-1.5">
              The 3 Pillars of CareerZen
            </h2>
            <p className="text-xs text-slate-500 max-w-2xl mt-0.5">
              An all-in-one early-career ecosystem bridging social networking, job recruiting, and proprietary AI career intelligence.
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Visual Pillar Diagram Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {pillars.map((pillar) => {
            const Icon = pillar.icon;
            return (
              <div
                key={pillar.id}
                className={`rounded-3xl p-5 border ${pillar.bgLight} ${pillar.borderLight} flex flex-col justify-between space-y-4`}
              >
                {/* Pillar Header */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className={`w-9 h-9 rounded-2xl bg-gradient-to-tr ${pillar.gradient} flex items-center justify-center text-white shadow-md`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${pillar.textColor} bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800`}>
                      {pillar.badge}
                    </span>
                  </div>

                  <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                    {pillar.title}
                  </h3>
                </div>

                {/* Subsystem Modules */}
                <div className="space-y-2 flex-1">
                  {pillar.items.map((item, idx) => (
                    <div
                      key={idx}
                      onClick={item.action}
                      className="p-3 rounded-2xl bg-white/90 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 hover:border-brand-500 dark:hover:border-brand-500 hover:shadow-md cursor-pointer transition group"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-slate-900 dark:text-white group-hover:text-brand-600 dark:group-hover:text-brand-400 transition">
                          {item.name}
                        </span>
                        <ArrowRight className="w-3 h-3 text-slate-300 group-hover:text-brand-600 transition transform group-hover:translate-x-0.5" />
                      </div>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed line-clamp-2">
                        {item.desc}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Note */}
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
          <span>Click on any module above to instantly launch that workspace.</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-bold hover:opacity-90 transition"
          >
            Close Overview
          </button>
        </div>
      </div>
    </div>
  );
}
