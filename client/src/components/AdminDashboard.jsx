import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { Activity, BarChart3, Briefcase, CheckCircle2, DollarSign, FileText, LayoutDashboard, LockKeyhole, MessageSquare, ShieldCheck, Sparkles, Trash2, TrendingUp, Upload, UserCheck, Users, XCircle, Zap, QrCode, CreditCard, Tag } from 'lucide-react';
import AnalyticsDashboard from './AnalyticsDashboard';

const Card = ({ icon: Icon, label, value }) => (
  <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
    <div className="flex items-center justify-between"><span className="text-xs font-semibold text-slate-500">{label}</span><Icon className="w-4 h-4 text-brand-500" /></div>
    <div className="mt-2 text-2xl font-black text-slate-900 dark:text-white">{value ?? '—'}</div>
  </div>
);

// job_packages.features is stored as a JSON array (older rows used a
// newline-joined string). Normalise to a string array for display.
function parseFeatures(features) {
  if (!features) return [];
  if (Array.isArray(features)) return features.map(String);
  try {
    const parsed = JSON.parse(features);
    if (Array.isArray(parsed)) return parsed.map(String);
  } catch { /* not JSON — fall through */ }
  return String(features).split('\n').map((s) => s.trim()).filter(Boolean);
}

function featuresToText(features) {
  if (Array.isArray(features)) return features.join('\n');
  return String(features || '');
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const [tab, setTab] = useState('overview');
  const [data, setData] = useState({});
  const [users, setUsers] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [applications, setApplications] = useState([]);
  const [posts, setPosts] = useState([]);
  const [logs, setLogs] = useState([]);
  const [system, setSystem] = useState(null);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Package management state
  const [packages, setPackages] = useState([]);
  const [newPackage, setNewPackage] = useState({name: '', price: 0, jobLimit: 0, durationDays: 30, features: ''});
  const [packageCreating, setPackageCreating] = useState(false);
  const [editingPackageId, setEditingPackageId] = useState(null);
  const [editPackageForm, setEditPackageForm] = useState({name: '', price: 0, jobLimit: 0, durationDays: 30, features: ''});
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Feed topics state
  const [feedTopics, setFeedTopics] = useState([]);
  const [newFeedTopic, setNewFeedTopic] = useState({tag: '', label: '', description: '', color: 'brand', enabled: true, sort_order: 0});
  const [feedTopicCreating, setFeedTopicCreating] = useState(false);
  const [editingFeedTopicId, setEditingFeedTopicId] = useState(null);
  const [editFeedTopicForm, setEditFeedTopicForm] = useState({tag: '', label: '', description: '', color: 'brand', enabled: true, sort_order: 0});
  const [showFeedTopicCreateForm, setShowFeedTopicCreateForm] = useState(false);

  const load = async (section = tab) => {
    setError('');
    try {
      if (section === 'overview') setData(await api.getAdminOverview());
      if (section === 'users') setUsers((await api.getAdminUsers({ search, limit: 100 })).users);
      if (section === 'jobs') setJobs((await api.getAdminJobs()).jobs);
      if (section === 'applications') setApplications((await api.getAdminApplications()).applications);
      if (section === 'posts') setPosts((await api.getAdminPosts()).posts);
      if (section === 'audit') setLogs((await api.getAdminAuditLogs()).logs);
      if (section === 'system') setSystem(await api.getAdminSystem());
      if (section === 'packages') { await loadPackages(); await loadFeedTopics(); await loadPremiumPlans(); await loadPremiumSubscriptions(); await loadPremiumFeatures(); await loadPaySettings(); await loadPayRequests(); await loadPaymentOptions(); }
    } catch (e) { setError(e.message); }
  };

  useEffect(() => { load('overview'); }, []);
  useEffect(() => { if (tab !== 'overview') load(tab); }, [tab]);

  if (!user || user.role !== 'admin') return null;
  const counts = data.counts || {};

  async function updateUser(id, body) { setBusy(true); try { await api.updateAdminUser(id, body); await load('users'); } catch (e) { setError(e.message); } finally { setBusy(false); } }
  async function updateJob(id, status) { setBusy(true); try { await api.updateAdminJob(id, { status }); await load('jobs'); } catch (e) { setError(e.message); } finally { setBusy(false); } }
  async function updateApplicationStatus(id, status) { setBusy(true); try { await api.updateAdminApplication(id, { status }); await load('applications'); } catch (e) { setError(e.message); } finally { setBusy(false); } }
  async function deletePost(id) { if (!confirm('Delete this post?')) return; setBusy(true); try { await api.deleteAdminPost(id); await load('posts'); } catch (e) { setError(e.message); } finally { setBusy(false); } }

  // Package management functions
  async function loadPackages() {
    try {
      const packagesData = await api.getPackages();
      setPackages(packagesData || []);
    } catch (e) {
      setError('Failed to load packages: ' + e.message);
    }
  }

  async function handleCreatePackage(e) {
    e.preventDefault();
    if (!newPackage.name.trim()) {
      setError('Package name is required');
      return;
    }
    setPackageCreating(true);
    try {
      // Admin package creation is a direct DB write — no payment order is
      // involved, so don't route it through createPaymentOrder.
      await api.createAdminPackage({
        name: newPackage.name,
        price: newPackage.price,
        jobLimit: newPackage.jobLimit,
        durationDays: newPackage.durationDays,
        features: newPackage.features
      });
      await loadPackages();
      setNewPackage({name: '', price: 0, jobLimit: 0, durationDays: 30, features: ''});
    } catch (e) {
      setError('Failed to create package: ' + e.message);
    } finally {
      setPackageCreating(false);
    }
  }

  async function handleEditPackage(packageId) {
    const pkg = packages.find(p => p.id === packageId);
    if (pkg) {
      setEditingPackageId(packageId);
      setEditPackageForm({
        ...pkg,
        features: featuresToText(pkg.features)
      });
    }
  }

  async function handleUpdatePackage(e) {
    e.preventDefault();
    try {
      await api.updateAdminPackage(editingPackageId, editPackageForm);
      await loadPackages();
      setEditingPackageId(null);
      setEditPackageForm({name: '', price: 0, jobLimit: 0, durationDays: 30, features: ''});
    } catch (e) {
      setError('Failed to update package: ' + e.message);
    }
  }

  async function handleCancelEditPackage() {
    setEditingPackageId(null);
    setEditPackageForm({name: '', price: 0, jobLimit: 0, durationDays: 30, features: ''});
  }

  async function handleDeletePackage(packageId) {
    if (!confirm(`Delete package "${packages.find(p => p.id === packageId)?.name}"?`)) return;
    try {
      await api.deleteAdminPackage(packageId);
      await loadPackages();
    } catch (e) {
      setError('Failed to delete package: ' + e.message);
    }
  }

  // Feed topic management functions
  async function loadFeedTopics() {
    try {
      const topicsData = await api.getAdminFeedTopics();
      setFeedTopics(topicsData || []);
    } catch (e) {
      setError('Failed to load feed topics: ' + e.message);
    }
  }

  async function handleCreateFeedTopic(e) {
    e.preventDefault();
    if (!newFeedTopic.tag.trim() || !newFeedTopic.label.trim()) {
      setError('Tag and label are required');
      return;
    }
    setFeedTopicCreating(true);
    try {
      await api.createAdminFeedTopic(newFeedTopic);
      await loadFeedTopics();
      setNewFeedTopic({tag: '', label: '', description: '', color: 'brand', enabled: true, sort_order: 0});
    } catch (e) {
      setError('Failed to create feed topic: ' + e.message);
    } finally {
      setFeedTopicCreating(false);
    }
  }

  async function handleEditFeedTopic(topicId) {
    const topic = feedTopics.find(t => t.id === topicId);
    if (topic) {
      setEditingFeedTopicId(topicId);
      setEditFeedTopicForm({...topic});
    }
  }

  async function handleUpdateFeedTopic(e) {
    e.preventDefault();
    try {
      await api.updateAdminFeedTopic(editingFeedTopicId, editFeedTopicForm);
      await loadFeedTopics();
      setEditingFeedTopicId(null);
      setEditFeedTopicForm({tag: '', label: '', description: '', color: 'brand', enabled: true, sort_order: 0});
    } catch (e) {
      setError('Failed to update feed topic: ' + e.message);
    }
  }

  async function handleCancelEditFeedTopic() {
    setEditingFeedTopicId(null);
    setEditFeedTopicForm({tag: '', label: '', description: '', color: 'brand', enabled: true, sort_order: 0});
  }

  async function handleDeleteFeedTopic(topicId) {
    if (!confirm(`Delete feed topic "${feedTopics.find(t => t.id === topicId)?.tag}"?`)) return;
    try {
      await api.deleteAdminFeedTopic(topicId);
      await loadFeedTopics();
    } catch (e) {
      setError('Failed to delete feed topic: ' + e.message);
    }
  }

  // Premium plan pricing management
  const [premiumPlans, setPremiumPlans] = useState(null);
  const [premiumSubs, setPremiumSubs] = useState({ premium: [], recruiter: [] });
  const [pricingForm, setPricingForm] = useState({ premium_price: 299, pro_price: 799, currency: 'INR', premium_duration_days: 30, pro_duration_days: 30 });
  const [pricingSaving, setPricingSaving] = useState(false);

  // Payment QR + verification
  const [paySettings, setPaySettings] = useState({ qr_image_url: '', upi_id: '', payee_name: '', instructions: '' });
  const [payForm, setPayForm] = useState({ upi_id: '', payee_name: '', instructions: '' });
  const [qrPreview, setQrPreview] = useState('');
  const [qrSaving, setQrSaving] = useState(false);
  const [payRequests, setPayRequests] = useState([]);
  const [verifyingId, setVerifyingId] = useState(null);

  // Premium feature management
  const [premiumFeatures, setPremiumFeatures] = useState([]);
  const [featureSaving, setFeatureSaving] = useState(false);
  const [editingFeatureId, setEditingFeatureId] = useState(null);
  const [editFeatureForm, setEditFeatureForm] = useState({ id: null, key: '', name: '', description: '', plan: 'premium', enabled: true });
  const [newFeature, setNewFeature] = useState({ key: '', name: '', description: '', plan: 'premium', enabled: true });

  // Configurable payment options (UPI, PhonePe, GPay, Paytm, Razorpay)
  const [paymentOptions, setPaymentOptions] = useState([]);
  const [newOption, setNewOption] = useState({ label: '', type: 'upi', upi_id: '', phonepe_number: '', gpay_number: '', paytm_number: '', razorpay_enabled: false, instructions: '', is_default: false, sort_order: 0 });
  const [optionSaving, setOptionSaving] = useState(false);
  const [editingOptionId, setEditingOptionId] = useState(null);
  const [editOptionForm, setEditOptionForm] = useState({ label: '', type: 'upi', upi_id: '', phonepe_number: '', gpay_number: '', paytm_number: '', razorpay_enabled: false, instructions: '', is_default: false, sort_order: 0, enabled: true });
  const [newOptionQr, setNewOptionQr] = useState(null);
  const [newOptionQrPreview, setNewOptionQrPreview] = useState('');
  const [editOptionQr, setEditOptionQr] = useState(null);
  const [editOptionQrPreview, setEditOptionQrPreview] = useState('');

  async function loadPremiumPlans() {
    try {
      const data = await api.getAdminPremiumPlans();
      setPremiumPlans(data);
      setPricingForm({
        premium_price: data.premium_price,
        pro_price: data.pro_price,
        currency: data.currency,
        premium_duration_days: data.premium_duration_days,
        pro_duration_days: data.pro_duration_days
      });
    } catch (e) {
      setError('Failed to load premium pricing: ' + e.message);
    }
  }

  async function loadPremiumSubscriptions() {
    try {
      const data = await api.getAdminPremiumSubscriptions();
      setPremiumSubs(data);
    } catch (e) {
      setError('Failed to load subscriptions: ' + e.message);
    }
  }

  async function handleSavePricing(e) {
    e.preventDefault();
    setPricingSaving(true);
    try {
      await api.updateAdminPremiumPlans(pricingForm);
      await loadPremiumPlans();
    } catch (e) {
      setError('Failed to save pricing: ' + e.message);
    } finally {
      setPricingSaving(false);
    }
  }

  async function handlePremiumAction(userId, plan, action) {
    if (action === 'revoke' && !confirm('Revoke this premium plan from the user?')) return;
    try {
      await api.adminPremiumAction(userId, { plan, action });
      await loadPremiumSubscriptions();
      await load('overview');
    } catch (e) {
      setError('Failed to update subscription: ' + e.message);
    }
  }

  // Payment settings + verification
  async function loadPaySettings() {
    try {
      const data = await api.getPaymentSettings();
      setPaySettings(data || {});
      setPayForm({
        upi_id: data?.upi_id || '',
        payee_name: data?.payee_name || '',
        instructions: data?.instructions || ''
      });
      setQrPreview(data?.qr_image_url || '');
    } catch (e) {
      setError('Failed to load payment settings: ' + e.message);
    }
  }

  async function loadPayRequests() {
    try {
      const data = await api.getPaymentRequests();
      setPayRequests(data || []);
    } catch (e) {
      setError('Failed to load payment requests: ' + e.message);
    }
  }

  // ── Premium features ──
  async function loadPremiumFeatures() {
    try {
      const data = await api.getPremiumFeatures();
      setPremiumFeatures(data || []);
    } catch (e) {
      setError('Failed to load premium features: ' + e.message);
    }
  }

  // ── Payment options (UPI / PhonePe / GPay / Paytm / Razorpay) ──
  async function loadPaymentOptions() {
    try {
      const data = await api.getAdminPaymentOptions();
      setPaymentOptions(data || []);
    } catch (e) {
      setError('Failed to load payment options: ' + e.message);
    }
  }

  async function handleCreateOption(e) {
    e.preventDefault();
    if (!newOption.label.trim()) {
      setError('Payment option label is required');
      return;
    }
    setOptionSaving(true);
    try {
      const fd = new FormData();
      fd.append('label', newOption.label);
      fd.append('type', newOption.type);
      fd.append('upi_id', newOption.upi_id || '');
      fd.append('phonepe_number', newOption.phonepe_number || '');
      fd.append('gpay_number', newOption.gpay_number || '');
      fd.append('paytm_number', newOption.paytm_number || '');
      fd.append('razorpay_enabled', String(newOption.razorpay_enabled));
      fd.append('instructions', newOption.instructions || '');
      fd.append('is_default', String(newOption.is_default));
      fd.append('sort_order', String(newOption.sort_order || 0));
      if (newOptionQr) fd.append('qr', newOptionQr);
      const res = await api.createAdminPaymentOption(fd);
      if (!res.success) setError(res.error || 'Failed to create payment option');
      await loadPaymentOptions();
      setNewOption({ label: '', type: 'upi', upi_id: '', phonepe_number: '', gpay_number: '', paytm_number: '', razorpay_enabled: false, instructions: '', is_default: false, sort_order: 0 });
      setNewOptionQr(null);
      setNewOptionQrPreview('');
    } catch (e) {
      setError('Failed to create payment option: ' + e.message);
    } finally {
      setOptionSaving(false);
    }
  }

  function handleEditOption(o) {
    setEditingOptionId(o.id);
    setEditOptionForm({
      label: o.label || '',
      type: o.type || 'upi',
      upi_id: o.upi_id || '',
      phonepe_number: o.phonepe_number || '',
      gpay_number: o.gpay_number || '',
      paytm_number: o.paytm_number || '',
      razorpay_enabled: !!o.razorpay_enabled,
      instructions: o.instructions || '',
      is_default: !!o.is_default,
      sort_order: o.sort_order || 0,
      enabled: !!o.enabled
    });
    setEditOptionQr(o.qr_image_url || '');
    setEditOptionQrPreview(o.qr_image_url || '');
  }

  async function handleUpdateOption(e) {
    e.preventDefault();
    setOptionSaving(true);
    try {
      const fd = new FormData();
      fd.append('label', editOptionForm.label);
      fd.append('type', editOptionForm.type);
      fd.append('upi_id', editOptionForm.upi_id || '');
      fd.append('phonepe_number', editOptionForm.phonepe_number || '');
      fd.append('gpay_number', editOptionForm.gpay_number || '');
      fd.append('paytm_number', editOptionForm.paytm_number || '');
      fd.append('razorpay_enabled', String(editOptionForm.razorpay_enabled));
      fd.append('instructions', editOptionForm.instructions || '');
      fd.append('is_default', String(editOptionForm.is_default));
      fd.append('sort_order', String(editOptionForm.sort_order || 0));
      fd.append('enabled', String(editOptionForm.enabled));
      if (editOptionQr) fd.append('qr', editOptionQr);
      const res = await api.updateAdminPaymentOption(editingOptionId, fd);
      if (!res.success) setError(res.error || 'Failed to update payment option');
      await loadPaymentOptions();
      setEditingOptionId(null);
      setEditOptionQr(null);
      setEditOptionQrPreview('');
    } catch (e) {
      setError('Failed to update payment option: ' + e.message);
    } finally {
      setOptionSaving(false);
    }
  }

  async function handleDeleteOption(id) {
    if (!confirm('Delete this payment option?')) return;
    try {
      const res = await api.deleteAdminPaymentOption(id);
      if (!res.success) setError(res.error || 'Failed to delete payment option');
      await loadPaymentOptions();
    } catch (e) {
      setError('Failed to delete payment option: ' + e.message);
    }
  }

  async function handleSaveQr(e) {
    e.preventDefault();
    setQrSaving(true);
    try {
      const formData = new FormData();
      formData.append('upi_id', payForm.upi_id || '');
      formData.append('payee_name', payForm.payee_name || '');
      formData.append('instructions', payForm.instructions || '');
      const res = await api.updatePaymentSettings(formData);
      if (res.success) {
        setPaySettings(res.settings || {});
        setQrPreview(res.settings?.qr_image_url || '');
        await loadPaySettings();
      } else {
        setError(res.error || 'Failed to save payment settings');
      }
    } catch (err) {
      setError(err.message || 'Failed to save payment settings');
    } finally {
      setQrSaving(false);
    }
  }

  async function handleQrUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => setQrPreview(reader.result);
    reader.readAsDataURL(file);

    setQrSaving(true);
    try {
      const formData = new FormData();
      formData.append('qr', file);
      formData.append('upi_id', payForm.upi_id || '');
      formData.append('payee_name', payForm.payee_name || '');
      formData.append('instructions', payForm.instructions || '');
      const res = await api.updatePaymentSettings(formData);
      if (res.success) {
        setPaySettings(res.settings || {});
        setQrPreview(res.settings?.qr_image_url || '');
        // Also update the default payment option to sync QR.
        // payment_options has no payee_name column — only send fields it supports.
        try {
          const syncForm = new FormData();
          syncForm.append('qr_image_url', res.settings?.qr_image_url || '');
          syncForm.append('upi_id', payForm.upi_id || '');
          syncForm.append('instructions', payForm.instructions || '');
          await api.updateAdminPaymentOption(1, syncForm);
          await loadPaymentOptions();
        } catch (syncErr) {
          console.warn('Failed to sync QR to payment option:', syncErr);
        }
      } else {
        setError(res.error || 'Failed to upload QR');
      }
    } catch (err) {
      setError(err.message || 'Failed to upload QR');
    } finally {
      setQrSaving(false);
    }
  }

  async function handleVerifyRequest(id, action) {
    if (action === 'reject' && !confirm('Reject this payment request?')) return;
    setVerifyingId(id);
    try {
      await api.verifyPaymentRequest(id, { action });
      await loadPayRequests();
      await loadPremiumSubscriptions();
    } catch (err) {
      setError('Failed to verify payment: ' + err.message);
    } finally {
      setVerifyingId(null);
    }
  }

  // ── Premium feature CRUD ──
  async function handleSaveFeature(e) {
    e.preventDefault();
    if (!newFeature.key || !newFeature.name) {
      setError('Feature key and name are required');
      return;
    }
    setFeatureSaving(true);
    try {
      await api.createPremiumFeature(newFeature);
      await loadPremiumFeatures();
      setNewFeature({ key: '', name: '', description: '', plan: 'premium', enabled: true });
    } catch (err) {
      setError('Failed to create feature: ' + err.message);
    } finally {
      setFeatureSaving(false);
    }
  }

  async function handleUpdateFeature(e) {
    e.preventDefault();
    setFeatureSaving(true);
    try {
      await api.updatePremiumFeature(editingFeatureId, editFeatureForm);
      await loadPremiumFeatures();
      setEditingFeatureId(null);
      setEditFeatureForm({ id: null, key: '', name: '', description: '', plan: 'premium', enabled: true });
    } catch (err) {
      setError('Failed to update feature: ' + err.message);
    } finally {
      setFeatureSaving(false);
    }
  }

  async function handleToggleFeature(f) {
    try {
      await api.updatePremiumFeature(f.id, { ...f, enabled: !f.enabled });
      await loadPremiumFeatures();
    } catch (err) {
      setError('Failed to toggle feature: ' + err.message);
    }
  }

  const tabs = [
    ['overview','Overview',LayoutDashboard], ['users','Users',Users], ['jobs','Jobs',Briefcase], ['applications','Applications',FileText], ['posts','Moderation',MessageSquare], ['audit','Audit logs',ShieldCheck], ['system','System',Activity], ['analytics','Analytics',TrendingUp], ['packages','Packages',DollarSign]
  ];

  return <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
    <div className="rounded-3xl bg-slate-950 text-white p-6 mb-6 shadow-xl">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div><div className="flex items-center gap-2 text-brand-300 text-xs font-bold uppercase tracking-wider"><LockKeyhole className="w-4 h-4"/> Admin control center</div><h1 className="text-3xl font-black mt-1">CareerZen Administration</h1><p className="text-slate-400 text-sm mt-1">Signed in as {user.email} via {user.auth_provider || 'account authentication'}.</p></div>
        <a href={api.adminSsoUrl()} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-sm font-bold">Re-authenticate SSO</a>
      </div>
    </div>
    <div className="flex gap-2 overflow-x-auto pb-2 mb-5">{tabs.map(([id,label,Icon]) => <button key={id} onClick={() => setTab(id)} className={`shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold ${tab===id?'bg-brand-600 text-white':'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300'}`}><Icon className="w-4 h-4"/>{label}</button>)}</div>
    {error && <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 text-sm">{error}</div>}
    {tab==='overview' && (
      <>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3"><Card icon={Users} label="Users" value={counts.users}/><Card icon={UserCheck} label="Active users" value={counts.activeUsers}/><Card icon={Briefcase} label="Jobs" value={counts.jobs}/><Card icon={FileText} label="Applications" value={counts.applications}/><Card icon={MessageSquare} label="Posts" value={counts.posts}/><Card icon={Activity} label="Messages" value={counts.messages}/><Card icon={ShieldCheck} label="Verified KYC" value={counts.verifiedKyc}/><Card icon={Users} label="Recruiters" value={counts.recruiters}/></div>
        <section className="mt-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden"><div className="p-4 font-bold">Recent users</div><Table headers={['User','Email','Role','Provider','Status','Created']} rows={(data.recentUsers||[]).map(u=>[u.username,u.email,u.role,u.auth_provider,u.is_active?'Active':'Disabled',u.created_at])}/></section>
      </>
    )}
    {tab==='analytics' && (<AnalyticsDashboard />)}
    {tab==='users' && <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden"><div className="p-4 flex gap-2"><input id="AdminDashboard-search" name="search" value={search} onChange={e=>setSearch(e.target.value)} onKeyDown={e=>e.key==='Enter'&&load('users')} placeholder="Search users..." className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent px-3 py-2 text-sm"/><button onClick={()=>load('users')} className="px-4 rounded-xl bg-brand-600 text-white text-sm font-bold">Search</button></div><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-xs text-slate-500 border-t border-b border-slate-200 dark:border-slate-800">{['User','Email','Role','Provider','Status','Actions'].map(h=><th className="p-3" key={h}>{h}</th>)}</tr></thead><tbody>{users.map(u=><tr key={u.id} className="border-b border-slate-100 dark:border-slate-800"><td className="p-3 font-semibold">{u.full_name||u.username}<div className="text-xs text-slate-400">#{u.id}</div></td><td className="p-3">{u.email}</td><td className="p-3"><select id="AdminDashboard-role" name="role" value={u.role} disabled={busy} onChange={e=>updateUser(u.id,{role:e.target.value})} className="bg-transparent border rounded-lg px-2 py-1"><option>job_seeker</option><option>recruiter</option><option>admin</option></select></td><td className="p-3">{u.auth_provider}</td><td className="p-3">{u.is_active?<span className="text-emerald-600">Active</span>:<span className="text-red-600">Disabled</span>}</td><td className="p-3"><button disabled={busy || u.id===user.id} onClick={()=>updateUser(u.id,{isActive:!u.is_active})} className="px-2 py-1 rounded-lg border text-xs">{u.is_active?'Disable':'Enable'}</button></td></tr>)}</tbody></table></div></section>}
    {tab==='jobs' && <Table headers={['Job','Company','Recruiter','Status','Created','Action']} rows={jobs.map(j=>[j.title,j.company,j.recruiter,j.status,j.created_at,<button onClick={()=>updateJob(j.id,j.status==='open'?'closed':'open')} className="px-2 py-1 rounded-lg border text-xs">{j.status==='open'?'Close':'Reopen'}</button>])}/>} 
    {tab==='applications' && <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-xs text-slate-500 border-b border-slate-200 dark:border-slate-800">{['Candidate','Job','Company','Status','Created','Action'].map(h=><th className="p-3 whitespace-nowrap" key={h}>{h}</th>)}</tr></thead><tbody>{applications.map(a=><tr key={a.id} className="border-b border-slate-100 dark:border-slate-800"><td className="p-3"><div className="font-semibold">{a.candidate}</div><div className="text-xs text-slate-400">{a.candidate_email}</div></td><td className="p-3">{a.job_title}</td><td className="p-3">{a.company}</td><td className="p-3"><span className={`px-2 py-1 rounded-full text-xs font-bold ${a.status==='hired'?'bg-emerald-100 text-emerald-700':a.status==='rejected'?'bg-red-100 text-red-700':a.status==='shortlisted'?'bg-indigo-100 text-indigo-700':a.status==='interview'?'bg-purple-100 text-purple-700':a.status==='under_review'?'bg-amber-100 text-amber-700':'bg-slate-100 text-slate-600'}`}>{a.status}</span></td><td className="p-3 whitespace-nowrap">{a.created_at}</td><td className="p-3"><select id="AdminDashboard-status" name="status" value={a.status} disabled={busy} onChange={e=>updateApplicationStatus(a.id,e.target.value)} className="bg-transparent border rounded-lg px-2 py-1 text-xs"><option value="applied">applied</option><option value="under_review">under_review</option><option value="shortlisted">shortlisted</option><option value="interview">interview</option><option value="rejected">rejected</option><option value="hired">hired</option></select></td></tr>)}</tbody></table></div></section>}
    {tab==='posts' && <Table headers={['Author','Category','Content','Created','Action']} rows={posts.map(p=>[p.username,p.category,<span className="line-clamp-2 max-w-xl">{p.content}</span>,p.created_at,<button onClick={()=>deletePost(p.id)} className="p-2 rounded-lg text-red-600 hover:bg-red-50"><Trash2 className="w-4 h-4"/></button>])}/>} 
    {tab==='audit' && <Table headers={['Actor','Action','Resource','Metadata','Time']} rows={logs.map(l=>[l.actor||'System',l.action,`${l.resource_type||''} ${l.resource_id||''}`,l.metadata,l.created_at])}/>} 
    {tab==='system' && system && <div className="grid md:grid-cols-2 gap-4"><div className="rounded-2xl bg-white dark:bg-slate-900 border p-5"><h2 className="font-bold mb-3">Runtime</h2><p>Node: {system.node}</p><p>Environment: {system.environment}</p><p>Uptime: {system.uptimeSeconds}s</p></div><div className="rounded-2xl bg-white dark:bg-slate-900 border p-5"><h2 className="font-bold mb-3">Database tables</h2>{Object.entries(system.database||{}).map(([k,v])=><div key={k} className="flex justify-between py-1 text-sm"><span>{k}</span><span className="font-bold">{v}</span></div>)}</div></div>}
{tab==='packages' && <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="p-4"><h2 className="font-bold mb-4">Premium Plan Pricing</h2><p className="text-sm text-slate-500 mb-4">Set the price and duration recruiters and job seekers pay for Premium access.</p>
          <form onSubmit={handleSavePricing} className="space-y-3">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                <h3 className="font-bold text-sm mb-3 flex items-center gap-1.5"><Zap className="w-4 h-4 text-amber-500"/> Premium Plan</h3>
                <div className="grid grid-cols-2 gap-2">
                  <div><label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Price</label><input id="AdminDashboard-premium_price" name="premium_price" type="number" step="0.01" value={pricingForm.premium_price} onChange={e=>setPricingForm({...pricingForm, premium_price: parseFloat(e.target.value)||0})} className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"/></div>
                  <div><label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Duration (days)</label><input id="AdminDashboard-premium_duration_days" name="premium_duration_days" type="number" value={pricingForm.premium_duration_days} onChange={e=>setPricingForm({...pricingForm, premium_duration_days: parseInt(e.target.value)||30})} className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"/></div>
                </div>
              </div>
              <div className="p-4 rounded-xl bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800">
                <h3 className="font-bold text-sm mb-3 flex items-center gap-1.5"><Sparkles className="w-4 h-4 text-purple-500"/> Pro Plan</h3>
                <div className="grid grid-cols-2 gap-2">
                  <div><label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Price</label><input id="AdminDashboard-pro_price" name="pro_price" type="number" step="0.01" value={pricingForm.pro_price} onChange={e=>setPricingForm({...pricingForm, pro_price: parseFloat(e.target.value)||0})} className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"/></div>
                  <div><label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Duration (days)</label><input id="AdminDashboard-pro_duration_days" name="pro_duration_days" type="number" value={pricingForm.pro_duration_days} onChange={e=>setPricingForm({...pricingForm, pro_duration_days: parseInt(e.target.value)||30})} className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"/></div>
                </div>
              </div>
            </div>
            <div className="flex items-end gap-3">
              <div className="w-32"><label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Currency</label><select id="AdminDashboard-currency" name="currency" value={pricingForm.currency} onChange={e=>setPricingForm({...pricingForm, currency: e.target.value})} className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"><option value="INR">INR (₹)</option><option value="USD">USD ($)</option><option value="EUR">EUR (€)</option><option value="GBP">GBP (£)</option></select></div>
              <button type="submit" disabled={pricingSaving} className="px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-bold text-xs">{pricingSaving ? 'Saving...' : 'Save Pricing'}</button>
            </div>
          </form>
        </div>

        {/* Premium feature management */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800">
          <h2 className="font-bold mb-1 flex items-center gap-2"><Sparkles className="w-5 h-5 text-amber-500"/> Premium Features</h2>
          <p className="text-sm text-slate-500 mb-4">Manage which features are available for each plan. Features can be enabled/disabled per plan.</p>

          {editingFeatureId !== null && (
            <div className="mb-4 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/20 border-2 border-amber-200">
              <h3 className="font-bold text-sm mb-3">Editing: {editFeatureForm.name}</h3>
              <form onSubmit={handleUpdateFeature} className="space-y-3">
                <div className="grid md:grid-cols-2 gap-3">
                  <div><label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Feature Key</label><input id="AdminDashboard-key" name="key" type="text" value={editFeatureForm.key} onChange={e=>setEditFeatureForm({...editFeatureForm, key: e.target.value})} className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-mono"/></div>
                  <div><label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Plan</label><select id="AdminDashboard-plan" name="plan" value={editFeatureForm.plan} onChange={e=>setEditFeatureForm({...editFeatureForm, plan: e.target.value})} className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"><option value="premium">Premium</option><option value="pro">Pro</option></select></div>
                </div>
                <div><label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Feature Name</label><input id="AdminDashboard-name" name="name" type="text" value={editFeatureForm.name} onChange={e=>setEditFeatureForm({...editFeatureForm, name: e.target.value})} className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"/></div>
                <div><label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Description</label><textarea id="AdminDashboard-description" name="description" rows={3} value={editFeatureForm.description} onChange={e=>setEditFeatureForm({...editFeatureForm, description: e.target.value})} className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 resize-none"/></div>
                <div className="flex items-end gap-2">
                  <button type="button" onClick={()=>setEditingFeatureId(null)} className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">Cancel</button>
                  <button type="submit" disabled={featureSaving} className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold text-xs">{featureSaving ? 'Saving...' : 'Save Feature'}</button>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" checked={editFeatureForm.enabled} onChange={e=>setEditFeatureForm({...editFeatureForm, enabled: e.target.checked})} className="w-4 h-4 accent-emerald-500"/> Enabled</label>
                </div>
              </form>
            </div>
          )}

          <form onSubmit={handleSaveFeature} className="space-y-3 mb-5 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
            <div className="grid md:grid-cols-2 gap-3">
              <div><label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Feature Key</label><input id="AdminDashboard-key" name="key" type="text" value={newFeature.key} onChange={e=>setNewFeature({...newFeature, key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_')})} placeholder="e.g. ai_resume_review" className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-mono"/></div>
              <div><label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Plan</label><select id="AdminDashboard-plan" name="plan" value={newFeature.plan} onChange={e=>setNewFeature({...newFeature, plan: e.target.value})} className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"><option value="premium">Premium</option><option value="pro">Pro</option></select></div>
            </div>
            <div><label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Feature Name</label><input id="AdminDashboard-name" name="name" type="text" value={newFeature.name} onChange={e=>setNewFeature({...newFeature, name: e.target.value})} placeholder="e.g. AI Resume Review" className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"/></div>
            <div><label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Description</label><textarea id="AdminDashboard-description" name="description" rows={3} value={newFeature.description} onChange={e=>setNewFeature({...newFeature, description: e.target.value})} placeholder="e.g. ATS scoring and feedback" className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 resize-none"/></div>
            <div className="flex items-end gap-2">
              <button type="submit" disabled={featureSaving || !newFeature.key || !newFeature.name} className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs">{featureSaving ? 'Saving...' : 'Add Feature'}</button>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" checked={newFeature.enabled} onChange={e=>setNewFeature({...newFeature, enabled: e.target.checked})} className="w-4 h-4 accent-emerald-500"/> Enabled</label>
            </div>
          </form>

          {premiumFeatures.length === 0 ? <p className="text-xs text-slate-400 py-2">No premium features configured yet.</p> :
            <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-xs text-slate-500 border-b border-slate-200 dark:border-slate-800">{['Key','Name','Plan','Description','Status'].map(h=><th key={h} className="p-2 whitespace-nowrap">{h}</th>)}</tr></thead><tbody>{premiumFeatures.map(f=><tr key={f.id} className="border-b border-slate-100 dark:border-slate-800"><td className="p-2 font-mono font-bold">{f.key}</td><td className="p-2">{f.name}</td><td className="p-2"><span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">{f.plan}</span></td><td className="p-2">{f.description}</td><td className="p-2"><span className={`px-2 py-0.5 rounded-full text-xs font-bold ${f.enabled?'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300':'bg-slate-100 text-slate-500'}`}>{f.enabled?'Enabled':'Disabled'}</span></td><td className="p-2"><div className="flex gap-1"><button onClick={()=>handleToggleFeature(f)} className="px-2 py-1 rounded-lg border text-xs">{f.enabled?'Disable':'Enable'}</button><button onClick={()=>{setEditingFeatureId(f.id); setEditFeatureForm(f);}} className="px-2 py-1 rounded-lg border text-xs">Edit</button></div></td></tr>)}</tbody></table></div>}
        </div>

        {/* Premium subscriptions */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800">
          <h3 className="font-bold mb-3">Active Premium Subscriptions</h3>
          <h4 className="text-xs font-semibold text-slate-500 mb-2">Job Seekers & Recruiters (Premium/Pro)</h4>
          {premiumSubs.premium.length === 0 ? <p className="text-xs text-slate-400 py-2">No premium subscriptions yet.</p> :
            <div className="overflow-x-auto mb-4"><table className="w-full text-sm"><thead><tr className="text-left text-xs text-slate-500 border-b border-slate-200 dark:border-slate-800">{['User','Email','Role','Plan','Status','Ends','Actions'].map(h=><th key={h} className="p-2 whitespace-nowrap">{h}</th>)}</tr></thead><tbody>{premiumSubs.premium.map(s=><tr key={s.id} className="border-b border-slate-100 dark:border-slate-800"><td className="p-2 font-semibold">{s.full_name||s.username}<div className="text-xs text-slate-400">#{s.user_id}</div></td><td className="p-2">{s.email}</td><td className="p-2">{s.role}</td><td className="p-2"><span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">{s.plan}</span></td><td className="p-2">{s.status}</td><td className="p-2 whitespace-nowrap">{s.end_date?new Date(s.end_date).toLocaleDateString():'—'}</td><td className="p-2"><button onClick={()=>handlePremiumAction(s.user_id, s.plan, 'revoke')} className="px-2 py-1 rounded-lg border border-red-200 text-red-600 text-xs hover:bg-red-50 dark:hover:bg-red-950/40">Revoke</button></td></tr>)}</tbody></table></div>}

          <h4 className="text-xs font-semibold text-slate-500 mb-2">Recruiter Job Packages</h4>
          {premiumSubs.recruiter.length === 0 ? <p className="text-xs text-slate-400 py-2">No recruiter packages purchased.</p> :
            <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-xs text-slate-500 border-b border-slate-200 dark:border-slate-800">{['User','Email','Package','Price','Status','Ends'].map(h=><th key={h} className="p-2 whitespace-nowrap">{h}</th>)}</tr></thead><tbody>{premiumSubs.recruiter.map(s=><tr key={s.id} className="border-b border-slate-100 dark:border-slate-800"><td className="p-2 font-semibold">{s.username}<div className="text-xs text-slate-400">#{s.user_id}</div></td><td className="p-2">{s.email}</td><td className="p-2">{s.package_name}</td><td className="p-2">{s.package_price}</td><td className="p-2">{s.status}</td><td className="p-2 whitespace-nowrap">{s.end_date?new Date(s.end_date).toLocaleDateString():'—'}</td></tr>)}</tbody></table></div>}
        </div>

        <div className="p-4 border-t border-slate-100 dark:border-slate-800"><h2 className="font-bold mb-4">Recruiter Job Posting Packages</h2><p className="text-sm text-slate-500 mb-2">These packages determine what recruiters can post and for how long. Admins can create, edit, and delete packages here.</p></div>

        {/* Payment QR + verification */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800">
          <h2 className="font-bold mb-1 flex items-center gap-2"><QrCode className="w-5 h-5 text-emerald-500"/> Payment QR &amp; Verification</h2>
          <p className="text-sm text-slate-500 mb-4">Upload the UPI QR that candidates and recruiters will pay. Verify their payments here to activate their plan.</p>

          <div className="grid md:grid-cols-2 gap-4 mb-5">
            {/* QR upload */}
            <form onSubmit={handleSaveQr} className="space-y-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
              <div className="flex flex-col items-center">
                {qrPreview ? (
                  <img src={qrPreview} alt="Payment QR" className="w-40 h-40 object-contain rounded-xl bg-white p-2 border border-slate-200 dark:border-slate-700" />
                ) : (
                  <div className="w-40 h-40 flex flex-col items-center justify-center gap-2 text-slate-400 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700">
                    <QrCode className="w-10 h-10" />
                    <span className="text-[10px] font-bold">No QR uploaded</span>
                  </div>
                )}
                <label className="mt-2 flex items-center justify-center gap-2 w-full p-2 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-emerald-500 cursor-pointer transition">
                  <Upload className="w-4 h-4 text-slate-400" />
                  <span className="text-[11px] text-slate-500">{qrSaving ? 'Uploading...' : 'Upload UPI QR image'}</span>
                  <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleQrUpload} disabled={qrSaving} className="hidden" />
                </label>
              </div>
              <div><label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">UPI ID</label><input id="AdminDashboard-upi_id" name="upi_id" type="text" value={payForm.upi_id} onChange={e=>setPayForm({...payForm, upi_id: e.target.value})} placeholder="yourname@upi" className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-mono"/></div>
              <div><label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Payee Name</label><input id="AdminDashboard-payee_name" name="payee_name" type="text" value={payForm.payee_name} onChange={e=>setPayForm({...payForm, payee_name: e.target.value})} placeholder="CareerZen Premium" className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"/></div>
              <div><label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Instructions</label><textarea id="AdminDashboard-instructions" name="instructions" rows={2} value={payForm.instructions} onChange={e=>setPayForm({...payForm, instructions: e.target.value})} placeholder="Scan and pay via any UPI app, then submit your reference." className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm resize-none"/></div>
              <button type="submit" disabled={qrSaving} className="w-full px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs">{qrSaving ? 'Saving...' : 'Save Payment Settings'}</button>
            </form>

            {/* Verification queue */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
              <h3 className="font-bold text-sm mb-3">Payment Requests ({payRequests.length})</h3>
              {payRequests.length === 0 ? <p className="text-xs text-slate-400 py-4 text-center">No payments awaiting verification.</p> :
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {payRequests.map(r=><div key={r.id} className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="min-w-0">
                        <p className="font-bold text-xs truncate">{r.full_name||r.username} <span className="text-slate-400 font-normal">#{r.user_id}</span></p>
                        <p className="text-[10px] text-slate-500 truncate">{r.email} • {r.role}</p>
                      </div>
                      <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">{r.plan}</span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] mb-2">
                      <span className={`px-1.5 py-0.5 rounded font-bold ${r.payment_status==='submitted'?'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300':'bg-slate-100 text-slate-500'}`}>{r.payment_status}</span>
                      {r.payment_reference && <span className="font-mono text-slate-600 dark:text-slate-300 truncate ml-2">{r.payment_reference}</span>}
                      {r.payment_proof_url && <a href={r.payment_proof_url} target="_blank" rel="noreferrer" className="text-brand-600 dark:text-brand-400 underline ml-auto shrink-0">proof</a>}
                    </div>
                    <div className="flex gap-1.5">
                      <button onClick={()=>handleVerifyRequest(r.id,'approve')} disabled={verifyingId===r.id} className="flex-1 px-2 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-[11px] font-bold">Approve &amp; Activate</button>
                      <button onClick={()=>handleVerifyRequest(r.id,'reject')} disabled={verifyingId===r.id} className="px-2 py-1.5 rounded-lg border border-red-200 text-red-600 text-[11px] font-bold hover:bg-red-50 dark:hover:bg-red-950/40">Reject</button>
                    </div>
                  </div>)}
                </div>}
            </div>
          </div>

          {/* Configurable payment options */}
          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
            <h2 className="font-bold mb-1 flex items-center gap-2"><CreditCard className="w-5 h-5 text-brand-500"/> Payment Options</h2>
            <p className="text-sm text-slate-500 mb-4">Configure which payment methods users can choose when they buy a plan. Users pick from this list on the payment screen.</p>

            {editingOptionId !== null && (
              <div className="mb-4 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/20 border-2 border-amber-200 dark:border-amber-800">
                <h3 className="font-bold text-sm mb-3">Editing: {editOptionForm.label}</h3>
                <form onSubmit={handleUpdateOption} className="grid md:grid-cols-3 gap-3">
                  <div><label className="block text-xs font-medium mb-1">Label</label><input id="AdminDashboard-label" name="label" type="text" value={editOptionForm.label} onChange={e=>setEditOptionForm({...editOptionForm, label: e.target.value})} className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"/></div>
                  <div><label className="block text-xs font-medium mb-1">Type</label><select id="AdminDashboard-type" name="type" value={editOptionForm.type} onChange={e=>setEditOptionForm({...editOptionForm, type: e.target.value})} className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"><option value="upi">UPI</option><option value="phonepe">PhonePe</option><option value="gpay">Google Pay</option><option value="paytm">Paytm</option><option value="razorpay">Razorpay</option></select></div>
                  <div><label className="block text-xs font-medium mb-1">UPI ID</label><input id="AdminDashboard-upi_id" name="upi_id" type="text" value={editOptionForm.upi_id} onChange={e=>setEditOptionForm({...editOptionForm, upi_id: e.target.value})} className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-mono"/></div>
                  <div><label className="block text-xs font-medium mb-1">Sort Order</label><input id="AdminDashboard-sort_order" name="sort_order" type="number" value={editOptionForm.sort_order} onChange={e=>setEditOptionForm({...editOptionForm, sort_order: e.target.value})} className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"/></div>
                  <div className="flex items-end gap-3 pb-2">
                    <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" checked={editOptionForm.is_default} onChange={e=>setEditOptionForm({...editOptionForm, is_default: e.target.checked})} className="w-4 h-4 accent-emerald-500"/> Default</label>
                    <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" checked={editOptionForm.enabled} onChange={e=>setEditOptionForm({...editOptionForm, enabled: e.target.checked})} className="w-4 h-4 accent-emerald-500"/> Enabled</label>
                  </div>
                  <div className="flex items-end gap-2 pb-1">
                    <button type="button" onClick={()=>setEditingOptionId(null)} className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">Cancel</button>
                    <button type="submit" disabled={optionSaving} className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold text-xs">{optionSaving ? 'Saving...' : 'Save'}</button>
                  </div>
                  <div className="md:col-span-3"><label className="block text-xs font-medium mb-1">Instructions</label><textarea id="AdminDashboard-instructions" name="instructions" rows={2} value={editOptionForm.instructions} onChange={e=>setEditOptionForm({...editOptionForm, instructions: e.target.value})} className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"/></div>
                  <div className="md:col-span-3">
                    <label className="block text-xs font-medium mb-1">QR Image (replace)</label>
                    <input type="file" accept="image/*" onChange={(e)=>{
                      const reader = new FileReader();
                      reader.onload = () => setEditOptionQrPreview(reader.result);
                      reader.readAsDataURL(e.target.files[0]);
                      setEditOptionQr(e.target.files[0]);
                    }} className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm cursor-pointer"/>
                    {editOptionQrPreview && <img src={editOptionQrPreview} alt="QR preview" className="w-16 h-16 rounded-lg object-contain mt-2 border border-slate-200"/>}
                  </div>
                </form>
              </div>
            )}

            <form onSubmit={handleCreateOption} className="grid md:grid-cols-3 gap-3 mb-5 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
              <div><label className="block text-xs font-medium mb-1">Label</label><input id="AdminDashboard-label" name="label" type="text" value={newOption.label} onChange={e=>setNewOption({...newOption, label: e.target.value})} placeholder="e.g. UPI, PhonePe" className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"/></div>
              <div><label className="block text-xs font-medium mb-1">Type</label><select id="AdminDashboard-type" name="type" value={newOption.type} onChange={e=>setNewOption({...newOption, type: e.target.value})} className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"><option value="upi">UPI</option><option value="phonepe">PhonePe</option><option value="gpay">Google Pay</option><option value="paytm">Paytm</option><option value="razorpay">Razorpay</option></select></div>
              <div><label className="block text-xs font-medium mb-1">UPI ID</label><input id="AdminDashboard-upi_id" name="upi_id" type="text" value={newOption.upi_id} onChange={e=>setNewOption({...newOption, upi_id: e.target.value})} placeholder="name@bank" className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-mono"/></div>
              <div><label className="block text-xs font-medium mb-1">PhonePe No.</label><input id="AdminDashboard-phonepe_number" name="phonepe_number" type="text" value={newOption.phonepe_number} onChange={e=>setNewOption({...newOption, phonepe_number: e.target.value})} className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-mono"/></div>
              <div><label className="block text-xs font-medium mb-1">GPay No.</label><input id="AdminDashboard-gpay_number" name="gpay_number" type="text" value={newOption.gpay_number} onChange={e=>setNewOption({...newOption, gpay_number: e.target.value})} className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-mono"/></div>
              <div><label className="block text-xs font-medium mb-1">Paytm No.</label><input id="AdminDashboard-paytm_number" name="paytm_number" type="text" value={newOption.paytm_number} onChange={e=>setNewOption({...newOption, paytm_number: e.target.value})} className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-mono"/></div>
              <div><label className="block text-xs font-medium mb-1">Sort Order</label><input id="AdminDashboard-sort_order" name="sort_order" type="number" value={newOption.sort_order} onChange={e=>setNewOption({...newOption, sort_order: e.target.value})} className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"/></div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" checked={newOption.is_default} onChange={e=>setNewOption({...newOption, is_default: e.target.checked})} className="w-4 h-4 accent-emerald-500"/> Default</label>
                <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" checked={newOption.razorpay_enabled} onChange={e=>setNewOption({...newOption, razorpay_enabled: e.target.checked})} className="w-4 h-4 accent-emerald-500"/> Razorpay</label>
              </div>
              <div><label className="block text-xs font-medium mb-1">Instructions</label><input id="AdminDashboard-instructions" name="instructions" type="text" value={newOption.instructions} onChange={e=>setNewOption({...newOption, instructions: e.target.value})} className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"/></div>
              <div>
                <label className="block text-xs font-medium mb-1">QR Image</label>
                <input type="file" accept="image/*" onChange={(e)=> {
                  const reader = new FileReader();
                  reader.onload = () => setNewOptionQrPreview(reader.result);
                  reader.readAsDataURL(e.target.files[0]);
                  setNewOptionQr(e.target.files[0]);
                }} className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm cursor-pointer"/>
                {newOptionQrPreview && <div className="mt-2 text-xs text-slate-500">{newOptionQrPreview}</div>}
              </div>
              <div className="md:col-span-3"><button type="submit" disabled={optionSaving} className="w-full px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs">{optionSaving ? 'Saving...' : 'Add Payment Option'}</button></div>
            </form>

            <div className="space-y-2">
              {paymentOptions.length === 0 ? <p className="text-xs text-slate-400 py-4 text-center">No payment options configured. Add one above.</p> :
                paymentOptions.map(o => (
                  <div key={o.id} className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold text-sm flex items-center gap-2">{o.label}
                        {o.is_default ? <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-800">DEFAULT</span> : null}
                        {!o.enabled ? <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-slate-100 text-slate-500">DISABLED</span> : null}
                      </p>
                      <p className="text-[11px] text-slate-500 truncate">{o.type.toUpperCase()}{o.upi_id ? ` • ${o.upi_id}` : ''}{o.phonepe_number ? ` • Ph:${o.phonepe_number}` : ''}{o.gpay_number ? ` • GPay:${o.gpay_number}` : ''}{o.paytm_number ? ` • Paytm:${o.paytm_number}` : ''}{o.razorpay_enabled ? ' • Razorpay' : ''}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {o.qr_image_url && <img src={o.qr_image_url} alt="QR" className="w-10 h-10 rounded-lg object-contain bg-white border border-slate-200"/>}
                      <button onClick={()=>handleEditOption(o)} className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px]">Edit</button>
                      <button onClick={()=>handleDeleteOption(o.id)} className="px-2 py-1 rounded-lg border border-red-200 text-red-600 text-[11px]">Delete</button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>

        {/* Package edit form — shown inline when an admin clicks Edit */}
        {editingPackageId !== null && (
          <div className="mb-4 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/20 border-2 border-amber-200 dark:border-amber-800">
            <h3 className="font-bold text-sm mb-3 text-amber-900 dark:text-amber-200">
              Editing: {editPackageForm.name}
            </h3>
            <form onSubmit={handleUpdatePackage} className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Package Name</label>
                  <input id="AdminDashboard-name" name="name"
                    type="text"
                    value={editPackageForm.name}
                    onChange={(e) => setEditPackageForm({...editPackageForm, name: e.target.value})}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Price (Monthly)</label>
                  <input id="AdminDashboard-price" name="price"
                    type="number"
                    step="0.01"
                    value={editPackageForm.price}
                    onChange={(e) => setEditPackageForm({...editPackageForm, price: parseFloat(e.target.value) || 0})}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Job Limit</label>
                  <input id="AdminDashboard-jobLimit" name="jobLimit"
                    type="number"
                    value={editPackageForm.jobLimit}
                    onChange={(e) => setEditPackageForm({...editPackageForm, jobLimit: parseInt(e.target.value) || 0})}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Duration (Days)</label>
                  <input id="AdminDashboard-durationDays" name="durationDays"
                    type="number"
                    value={editPackageForm.durationDays}
                    onChange={(e) => setEditPackageForm({...editPackageForm, durationDays: parseInt(e.target.value) || 30})}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Features (one per line)</label>
                <textarea id="AdminDashboard-features" name="features"
                  value={editPackageForm.features}
                  onChange={(e) => setEditPackageForm({...editPackageForm, features: e.target.value})}
                  rows="4"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                />
              </div>
              <div className="flex justify-end space-x-2">
                <button type="button" onClick={handleCancelEditPackage} className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-600">Cancel</button>
                <button type="submit" className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold">Save Changes</button>
              </div>
            </form>
          </div>
        )}

        {/* Package creation form */}
        <div className="mb-4">
          <button
            type="button"
            onClick={() => {
              setShowCreateForm(!showCreateForm);
              if (!showCreateForm) setNewPackage({name: '', price: 0, jobLimit: 0, durationDays: 30, features: ''});
            }}
            className="w-full flex items-center justify-between p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-brand-500 transition"
          >
            <span className="font-bold text-slate-900 dark:text-white">
              {showCreateForm ? 'Hide creation form' : 'Create a new package'}
            </span>
            <span className="text-slate-400">{showCreateForm ? '−' : '+'}</span>
          </button>
          {showCreateForm && (
          <div className="mt-2 p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <form onSubmit={handleCreatePackage} className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Package Name</label>
                <input id="AdminDashboard-name" name="name"
                  type="text"
                  value={newPackage.name}
                  onChange={(e) => setNewPackage({...newPackage, name: e.target.value})}
                  placeholder="e.g. Starter, Growth, Enterprise"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Price (Monthly)</label>
                <input id="AdminDashboard-price" name="price"
                  type="number"
                  value={newPackage.price}
                  onChange={(e) => setNewPackage({...newPackage, price: parseFloat(e.target.value) || 0})}
                  placeholder="e.g. 29.99"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Job Limit</label>
                <input id="AdminDashboard-jobLimit" name="jobLimit"
                  type="number"
                  value={newPackage.jobLimit}
                  onChange={(e) => setNewPackage({...newPackage, jobLimit: parseInt(e.target.value) || 0})}
                  placeholder="-1 for unlimited"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Duration (Days)</label>
                <input id="AdminDashboard-durationDays" name="durationDays"
                  type="number"
                  value={newPackage.durationDays}
                  onChange={(e) => setNewPackage({...newPackage, durationDays: parseInt(e.target.value) || 30})}
                  placeholder="e.g. 30, 90, 180"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Features (one per line)</label>
              <textarea id="AdminDashboard-features" name="features"
                value={newPackage.features}
                onChange={(e) => setNewPackage({...newPackage, features: e.target.value})}
                rows="4"
                placeholder="- Unlimited job applications\n- Priority support\n- Advanced analytics"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50"
              />
            </div>

            <div className="flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setNewPackage({name: '', price: 0, jobLimit: 0, durationDays: 30, features: ''})}
                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-600"
              >
                Clear
              </button>
              <button
                type="submit"
                disabled={packageCreating}
                className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold"
              >
                {packageCreating ? 'Creating...' : 'Create Package'}
              </button>
            </div>
          </form>
          </div>
          )}
        </div>

        {/* Packages list */}
        <div className="mt-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-bold text-xl text-slate-900 dark:text-white">Current Packages</h3>
          </div>
          {packages.length > 0 ? (
            <div className="space-y-2">
              {packages.map((pkg, index) => (
                <div key={pkg.id} className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <h4 className="font-bold text-lg">{pkg.name}</h4>
                      <p className="text-sm text-slate-500">${pkg.price}/month • {pkg.jobLimit === -1 ? 'Unlimited' : pkg.jobLimit} jobs • {pkg.durationDays} days</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleEditPackage(pkg.id)}
                        className="px-2 py-1 rounded-xl border border-slate-200 dark:border-slate-700 text-sm hover:text-slate-600"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeletePackage(pkg.id)}
                        className="px-2 py-1 rounded-xl border border-slate-200 dark:border-slate-700 text-red-500 hover:text-red-700"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                    <p className="font-medium text-slate-700 dark:slice-300 mb-1">Features:</p>
                    <ul className="list-disc pl-5 space-y-1 text-sm">
                      {parseFeatures(pkg.features).map((feature, idx) => (
                        <li key={idx} className="flex items-start space-x-2">
                          <span className="flex-shrink-0">•</span>
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-slate-500 py-4">No packages found. Create your first package above.</p>
          )}

          {/* Feed Topics (Student & Fresher Topics) Management */}
          <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800">
            <h2 className="font-bold text-xl text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <Tag className="w-5 h-5 text-brand-500" /> Feed Topics (Student & Fresher Topics)
            </h2>
            <p className="text-sm text-slate-500 mb-4">
              Manage the topic badges displayed in the Feed sidebar. These tags help users filter posts
              and discover content related to early-career topics like React, AI, Internships, etc.
            </p>

            {/* Create new topic form */}
            <div className="bg-slate-50 dark:bg-slate-800/40 rounded-2xl p-4 mb-4 border border-slate-200 dark:border-slate-700">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white mb-3">Add New Topic</h3>
              <form onSubmit={handleCreateFeedTopic} className="grid md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Tag (e.g. #React)</label>
                  <input id="AdminDashboard-tag" name="tag"
                    type="text"
                    value={newFeedTopic.tag}
                    onChange={(e) => setNewFeedTopic({...newFeedTopic, tag: e.target.value})}
                    placeholder="#React"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Label</label>
                  <input id="AdminDashboard-label" name="label"
                    type="text"
                    value={newFeedTopic.label}
                    onChange={(e) => setNewFeedTopic({...newFeedTopic, label: e.target.value})}
                    placeholder="React Development"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Color</label>
                  <select id="AdminDashboard-color" name="color"
                    value={newFeedTopic.color}
                    onChange={(e) => setNewFeedTopic({...newFeedTopic, color: e.target.value})}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                  >
                    <option value="brand">Brand (Blue)</option>
                    <option value="purple">Purple</option>
                    <option value="emerald">Emerald (Green)</option>
                    <option value="amber">Amber (Yellow)</option>
                    <option value="indigo">Indigo</option>
                    <option value="rose">Rose (Pink)</option>
                    <option value="cyan">Cyan</option>
                  </select>
                </div>
                <div className="md:col-span-3 flex items-end gap-2">
                  <label className="flex items-center gap-1.5 text-xs">
                    <input
                      type="checkbox"
                      checked={newFeedTopic.enabled}
                      onChange={(e) => setNewFeedTopic({...newFeedTopic, enabled: e.target.checked})}
                      className="w-4 h-4 accent-brand-500"
                    />
                    Enabled
                  </label>
                  <button type="submit" disabled={feedTopicCreating} className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-bold text-xs">
                    {feedTopicCreating ? 'Creating...' : 'Add Topic'}
                  </button>
                </div>
              </form>
            </div>

            {/* Topics list */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="p-4 font-bold text-sm text-slate-500 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                Current Feed Topics
              </div>
              {feedTopics.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-slate-500 border-b border-slate-200 dark:border-slate-800">
                        <th className="p-3">Tag</th>
                        <th className="p-3">Label</th>
                        <th className="p-3">Color</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {feedTopics.map((topic) => (
                        <tr key={topic.id} className="border-b border-slate-100 dark:border-slate-800">
                          <td className="p-3 font-mono font-bold text-brand-600 dark:text-brand-400">#{topic.tag}</td>
                          <td className="p-3">{topic.label}</td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                              topic.color === 'brand' ? 'bg-blue-100 text-blue-700' :
                              topic.color === 'purple' ? 'bg-purple-100 text-purple-700' :
                              topic.color === 'emerald' ? 'bg-emerald-100 text-emerald-700' :
                              topic.color === 'amber' ? 'bg-amber-100 text-amber-700' :
                              topic.color === 'indigo' ? 'bg-indigo-100 text-indigo-700' :
                              topic.color === 'rose' ? 'bg-rose-100 text-rose-700' :
                              'bg-cyan-100 text-cyan-700'
                            }`}>
                              {topic.color}
                            </span>
                          </td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                              topic.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                            }`}>
                              {topic.enabled ? 'Enabled' : 'Disabled'}
                            </span>
                          </td>
                          <td className="p-3">
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleEditFeedTopic(topic.id)}
                                className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteFeedTopic(topic.id)}
                                className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-red-500 hover:text-red-700 text-xs"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-center text-slate-500 py-4 text-xs">No feed topics configured yet.</p>
              )}
            </div>
          </div>
        </div>
      </section>}
  </div>;
}

function Table({headers, rows}) { return <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-xs text-slate-500 border-b border-slate-200 dark:border-slate-800">{headers.map(h=><th key={h} className="p-3 whitespace-nowrap">{h}</th>)}</tr></thead><tbody>{rows.map((row,i)=><tr key={i} className="border-b last:border-0 border-slate-100 dark:border-slate-800 align-top">{row.map((cell,j)=><td key={j} className="p-3 max-w-md">{cell}</td>)}</tr>)}</tbody></table></div> }
