import React, { useState, useEffect, useMemo, useRef } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  Activity,
  BarChart3,
  Bell,
  Briefcase,
  Calendar,
  ChevronDown,
  Clock,
  Database,
  Download,
  Euro,
  FileText,
  Globe,
  LayoutDashboard,
  Loader2,
  PieChart,
  RefreshCw,
  Search,
  Server,
  Share2,
  Shield,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
  Zap,
  AlertCircle,
  CheckCircle2,
  Clock3,
} from 'lucide-react';

const StatCard = ({ title, value, change, icon: Icon, color = 'brand' }) => {
  const colorMap = {
    brand: 'bg-brand-50 dark:bg-brand-950/40 text-brand-600 dark:text-brand-400',
    emerald: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400',
    red: 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400',
    amber: 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400',
    blue: 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400',
    indigo: 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400',
    purple: 'bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400',
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colorMap[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
          {title}
        </span>
      </div>
      <p className="text-2xl font-black text-slate-900 dark:text-white mb-1">{value || '—'}</p>
      {change && (
        <div className="flex items-center gap-1 text-xs text-slate-500">
          {change > 0 ? (
            <TrendingUp className="w-3 h-3 text-emerald-500" />
          ) : change < 0 ? (
            <TrendingDown className="w-3 h-3 text-red-500" />
          ) : null}
          <span>{change > 0 ? '+' : ''}{change}% from last period</span>
        </div>
      )}
    </div>
  );
};

const HiringFunnelChart = ({ funnel }) => {
  if (!funnel || funnel.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
        <p className="text-sm text-slate-400">No funnel data available</p>
      </div>
    );
  }

  const maxCount = Math.max(...funnel.map((f) => f.count));

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
      <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
        <Activity className="w-4 h-4 text-brand-500" />
        Hiring Funnel
      </h3>
      <div className="space-y-3">
        {funnel.map((stage, index) => {
          const width = maxCount > 0 ? (stage.count / maxCount) * 100 : 0;
          const colors = ['bg-indigo-500', 'bg-blue-500', 'bg-amber-500', 'bg-emerald-500'];
          return (
            <div key={stage.stage} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-slate-700 dark:text-slate-300 capitalize">{stage.stage}</span>
                <span className="font-bold text-slate-900 dark:text-white">{stage.count}</span>
              </div>
              <div className="relative h-6 bg-slate-100 dark:bg-slate-800 rounded-lg overflow-hidden">
                <div
                  className={`h-full rounded-lg transition-all duration-500 ${colors[index % colors.length]}`}
                  style={{ width: `${width}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const TimeSeriesChart = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
        <p className="text-sm text-slate-400">No time series data available</p>
      </div>
    );
  }

  const maxValue = Math.max(...data.map((d) => d.jobs_posted));

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
      <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
        <TrendingUp className="w-4 h-4 text-brand-500" />
        Jobs Posted (Last 30 Days)
      </h3>
      <div className="h-48">
        <svg width="100%" height="100%" viewBox="0 0 600 200" className="w-full h-full">
          {maxValue > 0 && (
            <polyline
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-brand-500"
              points={data
                .map((d, i) => {
                  const x = (i / (data.length - 1)) * 560 + 20;
                  const y = 180 - (d.jobs_posted / maxValue) * 140;
                  return `${x},${y}`;
                })
                .join(' ')}
            />
          )}
          {data.map((d, i) => {
            if (maxValue === 0) return null;
            const x = (i / (data.length - 1)) * 560 + 20;
            const y = 180 - (d.jobs_posted / maxValue) * 140;
            return (
              <circle key={d.date} cx={x} cy={y} r="3" fill="currentColor" className="text-brand-500" />
            );
          })}
        </svg>
        <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mt-2">
          <span>{data[0]?.date}</span>
          <span>Today</span>
        </div>
      </div>
    </div>
  );
};

const DistributionChart = ({ data, labelKey, valueKey, title, icon: Icon }) => {
  if (!data || data.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
        <p className="text-sm text-slate-400">No distribution data</p>
      </div>
    );
  }

  const total = data.reduce((sum, d) => sum + Number(d[valueKey] || d.count || 0), 0);
  const colors = ['bg-indigo-500', 'bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-purple-500', 'bg-pink-500'];

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
      <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
        <Icon className="w-4 h-4 text-brand-500" />
        {title}
      </h3>
      <div className="space-y-3">
        {data.map((item, index) => {
          const value = Number(item[valueKey] || item.count || 0);
          const percentage = total > 0 ? (value / total) * 100 : 0;
          return (
            <div key={item[labelKey] || index} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-slate-700 dark:text-slate-300">{item[labelKey] || item.experience_level || item.job_type}</span>
                <span className="font-bold text-slate-900 dark:text-white">{value} ({percentage.toFixed(0)}%)</span>
              </div>
              <div className="relative h-5 bg-slate-100 dark:bg-slate-800 rounded-lg overflow-hidden">
                <div
                  className={`h-full rounded-lg transition-all duration-500 ${colors[index % colors.length]}`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const TopJobsTable = ({ jobs }) => {
  if (!jobs || jobs.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
        <p className="text-sm text-slate-400">No job data available</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 overflow-x-auto">
      <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
        <Target className="w-4 h-4 text-brand-500" />
        Top Performing Jobs
      </h3>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
            <th className="pb-2">Job Title</th>
            <th className="pb-2">Applications</th>
            <th className="pb-2">Hires</th>
            <th className="pb-2">Conversion</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job, i) => (
            <tr key={job.id} className="border-b border-slate-100 dark:border-slate-800 last:border-0">
              <td className="py-2 font-medium text-slate-900 dark:text-white">{job.title}</td>
              <td className="py-2">{job.application_count}</td>
              <td className="py-2">{job.hire_count}</td>
              <td className="py-2">{job.conversion_rate}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default function AnalyticsDashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('recruiter');
  const [analyticsData, setAnalyticsData] = useState(null);
  const [systemData, setSystemData] = useState(null);
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [reportType, setReportType] = useState('overview');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const wsRef = useRef(null);

  useEffect(() => {
    fetchAnalytics();
  }, [refreshKey, activeTab]);

  useEffect(() => {
    const initWebSocket = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        const token = localStorage.getItem('careerzen_token');
        if (token) {
          ws.send(JSON.stringify({ type: 'auth', token }));
        }
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'analytics_update' || data.type === 'system_metrics') {
            setRefreshKey((prev) => prev + 1);
          }
        } catch (e) {
          console.error('WebSocket parse error:', e);
        }
      };

      ws.onerror = (err) => {
        console.warn('WebSocket error:', err);
      };
    };

    if (user) {
      initWebSocket();
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [user]);

  async function fetchAnalytics() {
    if (!user) return;

    setLoading(true);
    setError('');
    try {
      if (activeTab === 'recruiter') {
        const data = await api.getAnalyticsDashboard();
        setAnalyticsData(data);
      } else if (activeTab === 'system') {
        const data = await api.getAnalyticsSystem();
        setSystemData(data);
      } else if (activeTab === 'reports') {
        const data = await api.getAnalyticsReports({ reportType, startDate: dateRange.start, endDate: dateRange.end });
        setReportData(data);
      }
    } catch (err) {
      setError(err.message || 'Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  }

  const handleRefresh = () => setRefreshKey((k) => k + 1);

  const tabs = [
    { id: 'recruiter', label: 'Recruiter Analytics', icon: BarChart3 },
    { id: 'system', label: 'System Health', icon: Server },
    { id: 'reports', label: 'Reports', icon: FileText },
  ];

  if (!user) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="text-center py-16 text-slate-500">
          <ShieldCheck className="w-12 h-12 mx-auto mb-2 text-slate-300" />
          <p className="text-sm">Authentication required to view analytics.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
          <Activity className="w-6 h-6 text-brand-500" />
          Analytics Dashboard
        </h1>
        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => {
              setActiveTab(t.id);
              setRefreshKey((k) => k + 1);
            }}
            className={`shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === t.id
                ? 'bg-brand-600 text-white shadow-md shadow-brand-500/20'
                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300'
            }`}
          >
            <t.icon className="w-4 h-4" />
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading analytics data...
        </div>
      )}

      {!loading && !error && activeTab === 'recruiter' && !analyticsData && (
        <div className="text-center py-16 text-slate-400">
          <BarChart3 className="w-12 h-12 mx-auto mb-2 text-slate-300" />
          <p className="text-sm">No analytics data available yet.</p>
          <p className="text-xs text-slate-500 mt-1">Data will appear once you have job postings and applications.</p>
        </div>
      )}

      {!loading && !error && activeTab === 'system' && !systemData && (
        <div className="text-center py-16 text-slate-400">
          <Server className="w-12 h-12 mx-auto mb-2 text-slate-300" />
          <p className="text-sm">No system data available.</p>
        </div>
      )}

      {/* Recruiter Analytics Tab */}
      {activeTab === 'recruiter' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              title="Total Jobs"
              value={analyticsData?.analytics?.summary?.totalJobs}
              icon={Briefcase}
              color="indigo"
            />
            <StatCard
              title="Active Jobs"
              value={analyticsData?.analytics?.summary?.activeJobs}
              icon={Activity}
              color="blue"
            />
            <StatCard
              title="Total Applications"
              value={analyticsData?.analytics?.summary?.totalApplications}
              icon={Users}
              color="emerald"
            />
            <StatCard
              title="Total Hires"
              value={analyticsData?.analytics?.summary?.totalHires}
              icon={UserCheck}
              color="purple"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <TimeSeriesChart data={analyticsData?.analytics?.timeSeries} />
            <DistributionChart
              data={analyticsData?.analytics?.applicationSources}
              labelKey="job_type"
              valueKey="count"
              title="Application Sources"
              icon={PieChart}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <HiringFunnelChart funnel={analyticsData?.analytics?.hiringFunnel} />
            <DistributionChart
              data={analyticsData?.analytics?.experienceDistribution}
              labelKey="experience_level"
              valueKey="count"
              title="Experience Distribution"
              icon={Euro}
            />
          </div>

          <TopJobsTable jobs={analyticsData?.analytics?.topJobs} />
        </div>
      )}

      {/* System Health Tab */}
      {activeTab === 'system' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              title="Total Users"
              value={systemData?.system?.total_users}
              icon={Users}
              color="brand"
            />
            <StatCard
              title="Active Users"
              value={systemData?.system?.active_users}
              icon={UserCheck}
              color="emerald"
            />
            <StatCard
              title="Recruiters"
              value={systemData?.system?.total_recruiters}
              icon={Shield}
              color="indigo"
            />
            <StatCard
              title="Job Seekers"
              value={systemData?.system?.total_job_seekers}
              icon={Users}
              color="blue"
            />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              title="Open Jobs"
              value={systemData?.system?.open_jobs}
              icon={Briefcase}
              color="amber"
            />
            <StatCard
              title="Applications"
              value={systemData?.system?.total_applications}
              icon={FileText}
              color="purple"
            />
            <StatCard
              title="Posts"
              value={systemData?.system?.total_posts}
              icon={Globe}
              color="indigo"
            />
            <StatCard
              title="Unread Notifications"
              value={systemData?.system?.unread_notifications}
              icon={Bell}
              color="red"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <Clock3 className="w-4 h-4 text-brand-500" />
                Today's Activity (Last 24h)
              </h3>
              <div className="space-y-3">
                {systemData?.recentActivity?.map((activity) => (
                  <div key={activity.type} className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800 last:border-0">
                    <span className="text-xs text-slate-600 dark:text-slate-300 capitalize">{activity.type.replace('_', ' ')}</span>
                    <span className="font-bold text-slate-900 dark:text-white">{activity.count}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <Database className="w-4 h-4 text-brand-500" />
                Database Tables
              </h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {systemData.database?.map((table) => (
                  <div key={table.table_name} className="flex items-center justify-between py-1">
                    <span className="text-xs text-slate-600 dark:text-slate-300">{table.table_name}</span>
                    <span className="text-xs font-bold text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">{table.row_count} rows</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reports Tab */}
      {activeTab === 'reports' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
            <div className="flex flex-col sm:flex-row gap-4 items-end">
              <div className="flex-1">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Report Type</label>
                <select id="AnalyticsDashboard-reportType" name="reportType"
                  value={reportType}
                  onChange={(e) => setReportType(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white"
                >
                  <option value="overview">Overview Report</option>
                  <option value="monthly">Monthly Report</option>
                  <option value="growth">Growth Report</option>
                  <option value="engagement">Engagement Report</option>
                </select>
              </div>
              <div className="flex gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Start Date</label>
                  <input id="AnalyticsDashboard-start" name="start"
                    type="date"
                    value={dateRange.start}
                    onChange={(e) => setDateRange((r) => ({ ...r, start: e.target.value }))}
                    className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">End Date</label>
                  <input id="AnalyticsDashboard-end" name="end"
                    type="date"
                    value={dateRange.end}
                    onChange={(e) => setDateRange((r) => ({ ...r, end: e.target.value }))}
                    className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white"
                  />
                </div>
              </div>
              <button
                onClick={() => setRefreshKey((k) => k + 1)}
                className="px-4 py-2 bg-brand-600 text-white rounded-xl text-xs font-bold hover:bg-brand-700 transition flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Generate</span>
              </button>
            </div>
          </div>

          {reportData && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {reportData.reportType} Report
                </h3>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Generated: {new Date(reportData.generatedAt).toLocaleString()}
                </span>
              </div>

              {reportData.data?.overview && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  {reportData.data.overview.map((item) => (
                    <div key={item.metric} className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 text-center">
                      <div className="text-xs text-slate-500 dark:text-slate-400 uppercase">{item.metric.replace(/_/g, ' ')}</div>
                      <div className="text-lg font-black text-slate-900 dark:text-white">{item.value}</div>
                    </div>
                  ))}
                </div>
              )}

              {reportData.data?.monthlyData && (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                        <th className="pb-2">Month</th>
                        <th className="pb-2">New Users</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.data.monthlyData.map((row) => (
                        <tr key={row.month} className="border-b border-slate-100 dark:border-slate-800 last:border-0">
                          <td className="py-2 text-slate-900 dark:text-white">{row.month}</td>
                          <td className="py-2">{row.new_users}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {reportData.data?.growthData && (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                        <th className="pb-2">Date</th>
                        <th className="pb-2">New Users</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.data.growthData.map((row) => (
                        <tr key={row.date} className="border-b border-slate-100 dark:border-slate-800 last:border-0">
                          <td className="py-2 text-slate-900 dark:text-white">{row.date}</td>
                          <td className="py-2">{row.new_users}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {reportData.data?.engagementData && (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                        <th className="pb-2">Date</th>
                        <th className="pb-2">New Jobs</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.data.engagementData.map((row) => (
                        <tr key={row.date} className="border-b border-slate-100 dark:border-slate-800 last:border-0">
                          <td className="py-2 text-slate-900 dark:text-white">{row.date}</td>
                          <td className="py-2">{row.new_jobs}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Real-time WebSocket indicator */}
      <div className="fixed bottom-6 right-6 z-50">
        <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-slate-900 text-white text-xs font-medium shadow-lg">
          <div
            className={`w-2 h-2 rounded-full ${
              wsRef?.current?.readyState === WebSocket.OPEN ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'
            }`}
          />
          <span>{wsRef?.current?.readyState === WebSocket.OPEN ? 'Live' : 'Offline'}</span>
        </div>
      </div>
    </div>
  );
};