import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import QRCode from 'qrcode';
import {
  X,
  Zap,
  Sparkles,
  Check,
  Crown,
  Loader2,
  CreditCard,
  ShieldCheck,
  TrendingUp,
  RefreshCw,
  QrCode,
  Upload,
  ChevronLeft,
} from 'lucide-react';

const PLAN_STYLES = {
  premium: {
    label: 'Premium',
    gradient: 'from-amber-400 to-orange-500',
    ring: 'border-amber-300 dark:border-amber-700',
    badge: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
  },
  pro: {
    label: 'Pro',
    gradient: 'from-purple-500 to-indigo-600',
    ring: 'border-purple-300 dark:border-purple-700',
    badge: 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300',
  },
};

// Shown when the admin hasn't configured premium_features yet, so the plan
// cards never render an empty bullet list.
const DEFAULT_PREMIUM_FEATURES = [
  { name: 'Unlimited Job Applications', description: 'Apply without limits' },
  { name: 'AI Resume Review', description: 'ATS scoring and feedback' },
  { name: 'Priority Support', description: 'Faster help when you need it' }
];
const DEFAULT_PRO_FEATURES = [
  { name: 'Profile Highlight Badge', description: 'Stand out with a Pro badge' },
  { name: 'Top of Candidate Search', description: 'Appear first in recruiter searches' },
  { name: 'Direct Recruiter Messaging', description: 'Message hiring managers first' },
  { name: 'Application Insights', description: 'See how your applications perform' },
  { name: 'Early Access to New Jobs', description: 'View new roles before others' }
];

export default function PremiumModal({ isOpen, onClose }) {
  const { user, refreshUser } = useAuth();
  const [features, setFeatures] = useState([]);
  const [planFeatures, setPlanFeatures] = useState({ premium: [], pro: [] });
  const [pricing, setPricing] = useState({ premium_price: 299, pro_price: 799, currency: 'INR' });
  const [currentPlan, setCurrentPlan] = useState('free');
  const [subscription, setSubscription] = useState(null);
  const [selectedPlan, setSelectedPlan] = useState('premium');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Payment flow (admin-managed UPI QR)
  const [view, setView] = useState('plans'); // 'plans' | 'payment' | 'submitted'

  // Pending upgrade request
  const [pendingRequest, setPendingRequest] = useState(null);

  // Amount tracking for discount display
  const [originalAmount, setOriginalAmount] = useState(0);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [amountDue, setAmountDue] = useState(0);

  // QR code state
  const [qrBroken, setQrBroken] = useState(false);
  const [paymentInfo, setPaymentInfo] = useState({ qr_image_url: '', upi_id: '', payee_name: '', instructions: '' });
  const [paymentOptions, setPaymentOptions] = useState([]);
  const [selectedOptionId, setSelectedOptionId] = useState(null);
  // Dynamically generated QR that encodes the UPI payment string with the
  // selected plan's amount — scanning it pre-fills the recipient and amount
  // in any UPI app so the user only has to confirm.
  const [dynamicQr, setDynamicQr] = useState('');
  const [generatingQr, setGeneratingQr] = useState(false);

  // Payment proof upload
  const [proofPreview, setProofPreview] = useState('');
  const [proofUrl, setProofUrl] = useState('');
  const [paymentRef, setPaymentRef] = useState('');
  const [payError, setPayError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    loadPremiumStatus();
    loadPaymentInfo();
    loadPaymentOptions();
  }, [isOpen]);

  // The admin-managed UPI QR can be uploaded at any time, even while the
  // modal is already open. Refresh it every time the user lands on the
  // payment screen so a freshly-uploaded QR is shown instead of the
  // "no QR uploaded yet" placeholder.
  useEffect(() => {
    if (view === 'payment') {
      loadPaymentInfo();
      loadPaymentOptions();
    }
  }, [view]);

  // Regenerate the dynamic amount-encoded QR whenever the selected option,
  // plan, or amount changes.
  useEffect(() => {
    if (view === 'payment') generateDynamicQr();
  }, [view, selectedOptionId, amountDue, originalAmount, paymentOptions]);

  async function loadPaymentInfo() {
    try {
      const data = await api.getPaymentInfo();
      setQrBroken(false);
      setPaymentInfo({
        qr_image_url: data?.qr_image_url || '',
        upi_id: data?.upi_id || '',
        payee_name: data?.payee_name || '',
        instructions: data?.instructions || ''
      });
    } catch (err) {
      console.error('Load payment info error:', err);
    }
  }

  async function loadPaymentOptions() {
    try {
      const data = await api.getPaymentOptions();
      const opts = Array.isArray(data) ? data : [];
      setPaymentOptions(opts);
      // Default to the admin's marked default, otherwise the first one.
      if (opts.length && selectedOptionId === null) {
        const def = opts.find((o) => o.is_default) || opts[0];
        setSelectedOptionId(def.id);
      }
    } catch (err) {
      console.error('Load payment options error:', err);
    }
  }

  // Build a UPI deep-link QR that pre-fills the payee and the exact amount
  // for the selected plan. Scanning it opens the payer's UPI app with the
  // payment ready to confirm — no manual entry.
  async function generateDynamicQr() {
    const opt = paymentOptions.find((o) => o.id === selectedOptionId) || paymentOptions[0];
    if (!opt || !opt.upi_id) {
      setDynamicQr('');
      return;
    }
    setGeneratingQr(true);
    try {
      const upiParams = new URLSearchParams({
        pa: opt.upi_id,
        pn: paymentInfo.payee_name || opt.label,
        am: String(amountDue || originalAmount || 0),
        cu: pricing.currency || 'INR',
        tn: `CareerZen ${selectedPlan === 'pro' ? 'Pro' : 'Premium'} plan`,
      });
      const upiString = `upi://pay?${upiParams.toString()}`;
      const dataUrl = await QRCode.toDataURL(upiString, {
        width: 320,
        margin: 2,
        color: { dark: '#0f172a', light: '#ffffff' },
      });
      setDynamicQr(dataUrl);
    } catch (err) {
      console.error('QR generation failed:', err);
      setDynamicQr('');
    } finally {
      setGeneratingQr(false);
    }
  }

  async function loadPremiumStatus() {
    setLoading(true);
    setError('');
    try {
      const data = await api.getMyPremium();
      setCurrentPlan(data.plan || 'free');
      setSubscription(data.subscription || null);
      setPendingRequest(data.pending_request || null);
      setFeatures(data.features || []);
      if (data.pricing) setPricing(data.pricing);
    } catch (err) {
      console.error('Load premium status error:', err);
      setError('Failed to load your premium status.');
    } finally {
      setLoading(false);
      // The plan cards describe what each plan OFFERS, so they come from the
      // public per-plan endpoints — /premium/me deliberately returns [] for
      // free users and would otherwise blank the Pro card.
      loadPlanFeatures();
    }
  }

  // Fetch the marketing feature list for each plan independently of whether
  // the current user already owns a plan.
  async function loadPlanFeatures() {
    try {
      const [premiumList, proList] = await Promise.all([
        api.getPremiumFeaturesByPlan('premium').catch(() => []),
        api.getPremiumFeaturesByPlan('pro').catch(() => [])
      ]);
      setPlanFeatures({
        premium: Array.isArray(premiumList) ? premiumList : [],
        pro: Array.isArray(proList) ? proList : []
      });
    } catch (err) {
      console.error('Load plan features error:', err);
    }
  }

  async function handleUpgrade() {
    if (!user) return;
    setBusy(true);
    setError('');
    setPayError('');
    try {
      // Creates a PENDING subscription for the selected plan and returns the
      // amount due.
      const res = await api.upgradePremium({
        plan: selectedPlan,
        paymentId: `ref_${Date.now()}`,
        paymentOptionId: selectedOptionId,
      });

      setPendingRequest(res.subscription || null);
      setOriginalAmount(res.pricing?.original_price ?? 0);
      setDiscountAmount(res.pricing?.discount_amount ?? 0);
      setAmountDue(res.pricing?.amount_due ?? 0);
      setView('payment');
      await loadPremiumStatus();
    } catch (err) {
      setError(err.message || 'Upgrade failed. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmitProof(e) {
    e?.preventDefault();
    if (!paymentRef.trim()) {
      setPayError('Please enter your payment reference / UTR number.');
      return;
    }
    setBusy(true);
    setPayError('');
    try {
      await api.submitPaymentProof({
        paymentReference: paymentRef.trim(),
        proofUrl: proofUrl || null,
      });
      setView('submitted');
      await loadPremiumStatus();
    } catch (err) {
      setPayError(err.message || 'Failed to submit payment proof.');
    } finally {
      setBusy(false);
    }
  }

  async function handleProofUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => setProofPreview(reader.result);
    reader.readAsDataURL(file);
    setProofUrl('');

    setBusy(true);
    try {
      const formData = new FormData();
      formData.append('proof', file);
      const res = await api.uploadPaymentProof(formData);
      if (res.success) {
        setProofUrl(res.proof_url);
      } else {
        setPayError(res.error || 'Failed to upload payment screenshot.');
      }
    } catch (err) {
      setPayError(err.message || 'Failed to upload payment screenshot.');
    } finally {
      setBusy(false);
    }
  }

  async function handleCancel() {
    if (!user) return;
    if (!confirm('Cancel your premium subscription?')) return;
    setBusy(true);
    setError('');
    try {
      await api.cancelPremium();
      await refreshUser();
      await loadPremiumStatus();
    } catch (err) {
      setError(err.message || 'Cancellation failed.');
    } finally {
      setBusy(false);
    }
  }

  if (!isOpen) return null;

  // Prefer the dedicated per-plan list; fall back to what the active plan
  // carries, then to a static list so neither card is ever empty.
  const premiumFeatures =
    planFeatures.premium.length > 0
      ? planFeatures.premium
      : features.filter((f) => f.plan === 'premium').length > 0
        ? features.filter((f) => f.plan === 'premium')
        : DEFAULT_PREMIUM_FEATURES;

  const proOnlyFeatures =
    planFeatures.pro.length > 0
      ? planFeatures.pro
      : features.filter((f) => f.plan === 'pro');

  // A Pro purchase includes every Premium feature plus the Pro-only ones
  const proFeatures =
    planFeatures.pro.length > 0 || proOnlyFeatures.length > 0
      ? [...premiumFeatures, ...proOnlyFeatures]
      : [...DEFAULT_PREMIUM_FEATURES, ...DEFAULT_PRO_FEATURES];

  const isActive = currentPlan !== 'free';

  // The payment option the user chose in the selector above.
  const selectedOption =
    paymentOptions.find((o) => o.id === selectedOptionId) || paymentOptions[0] || null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-start justify-center overflow-y-auto bg-slate-950/70 backdrop-blur-md p-4 sm:p-6 animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-3xl w-full p-6 sm:p-8 my-auto shadow-2xl border border-slate-200 dark:border-slate-800 relative max-h-[92vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center text-white mx-auto mb-3 shadow-lg shadow-amber-500/25">
            <Crown className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center justify-center gap-1.5">
            CareerZen Premium
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
            Go Premium to get priority processing, AI tools, and standout visibility across the platform.
          </p>
          <button
            type="button"
            onClick={async () => {
              setError('');
              setPayError('');
              // If a pending request already exists (e.g. from a previous attempt),
              // jump straight to the payment screen. Otherwise create one first.
              if (pendingRequest) {
                setView('payment');
                return;
              }
              setBusy(true);
              try {
                const res = await api.upgradePremium({
                  plan: selectedPlan,
                  paymentId: `ref_${Date.now()}`,
                  paymentOptionId: selectedOptionId,
                });
                setPendingRequest(res.subscription || null);
                setOriginalAmount(res.pricing?.original_price ?? 0);
                setDiscountAmount(res.pricing?.discount_amount ?? 0);
                setAmountDue(res.pricing?.amount_due ?? 0);
                await loadPremiumStatus();
                setView('payment');
              } catch (err) {
                setError(err.message || 'Failed to start upgrade.');
                if (err.details) setError(`${err.message} (${err.details})`);
              } finally {
                setBusy(false);
              }
            }}
            disabled={busy}
            className="mt-3 mx-auto flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 disabled:opacity-50 text-white text-xs font-bold shadow-lg shadow-amber-500/25 transition"
          >
            {busy ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
            Pay Now
          </button>
        </div>

{view === 'plans' && (
        <React.Fragment>
        {isActive && subscription && (
          <div className="mb-5 p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              <div>
                <p className="font-bold text-xs text-emerald-900 dark:text-emerald-200">
                  You're on the {currentPlan.toUpperCase()} plan
                </p>
                {subscription.end_date && (
                  <p className="text-[10px] text-emerald-700 dark:text-emerald-400">
                    Renews {new Date(subscription.end_date).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={handleCancel}
              disabled={busy}
              className="px-3 py-1.5 rounded-xl border border-emerald-300 dark:border-emerald-700 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 disabled:opacity-50 transition"
            >
              Cancel Plan
            </button>
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs text-red-600 dark:text-red-300">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {/* Premium Plan */}
            <div
              onClick={() => setSelectedPlan('premium')}
              className={`p-5 rounded-2xl border-2 cursor-pointer transition ${
                selectedPlan === 'premium'
                  ? `${PLAN_STYLES.premium.ring} bg-amber-50/50 dark:bg-amber-950/20`
                  : 'border-slate-200 dark:border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-black text-lg text-slate-900 dark:text-white flex items-center gap-2">
                  <Zap className="w-5 h-5 text-amber-500" />
                  Premium
                </h3>
                {currentPlan === 'premium' && (
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${PLAN_STYLES.premium.badge}`}>
                    CURRENT
                  </span>
                )}
              </div>

              <div className="mb-4">
                <span className="text-3xl font-black text-slate-900 dark:text-white">
                  {pricing.currency === 'INR' ? '₹' : pricing.currency === 'USD' ? '$' : `${pricing.currency} `}
                  {pricing.premium_price}
                </span>
                <span className="text-sm text-slate-500 font-medium">
                  /{pricing.premium_duration_days ? `${pricing.premium_duration_days} days` : 'month'}
                </span>
              </div>

              <ul className="space-y-2">
                {(premiumFeatures.length > 0 ? premiumFeatures : DEFAULT_PREMIUM_FEATURES).map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs">
                    <Check className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-slate-800 dark:text-slate-200">{f.name}</span>
                      <span className="block text-[10px] text-slate-500">{f.description}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* Pro Plan */}
            <div
              onClick={() => setSelectedPlan('pro')}
              className={`p-5 rounded-2xl border-2 cursor-pointer transition ${
                selectedPlan === 'pro'
                  ? `${PLAN_STYLES.pro.ring} bg-purple-50/50 dark:bg-purple-950/20`
                  : 'border-slate-200 dark:border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-black text-lg text-slate-900 dark:text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-purple-500" />
                  Pro
                </h3>
                {currentPlan === 'pro' && (
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${PLAN_STYLES.pro.badge}`}>
                    CURRENT
                  </span>
                )}
              </div>

              <div className="mb-4">
                <span className="text-3xl font-black text-slate-900 dark:text-white">
                  {pricing.currency === 'INR' ? '₹' : pricing.currency === 'USD' ? '$' : `${pricing.currency} `}
                  {pricing.pro_price}
                </span>
                <span className="text-sm text-slate-500 font-medium">
                  /{pricing.pro_duration_days ? `${pricing.pro_duration_days} days` : 'month'}
                </span>
              </div>

              <ul className="space-y-2">
                {(proFeatures.length > 0 ? proFeatures : [...DEFAULT_PREMIUM_FEATURES, ...DEFAULT_PRO_FEATURES]).map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs">
                    <Check
                      className={`w-4 h-4 flex-shrink-0 mt-0.5 ${
                        f.plan === 'pro' ? 'text-purple-500' : 'text-amber-500'
                      }`}
                    />
                    <div>
                      <span className="font-bold text-slate-800 dark:text-slate-200">{f.name}</span>
                      <span className="block text-[10px] text-slate-500">{f.description}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
        </React.Fragment>
        )}

        {/* Payment view: admin-managed UPI QR */}
        {view === 'payment' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => { setView('plans'); setPayError(''); }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div>
                <h3 className="font-black text-base text-slate-900 dark:text-white">
                  Pay for {selectedPlan === 'pro' ? 'Pro' : 'Premium'}
                </h3>
                <p className="text-[11px] text-slate-500">
                  Scan the QR with any UPI app, then submit your reference below.
                </p>
              </div>
            </div>

            {payError && (
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs text-red-600 dark:text-red-300">
                {payError}
              </div>
            )}

            {amountDue > 0 && (
              <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/40 border border-amber-200 dark:border-amber-800 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">Amount Due</p>
                  <p className="text-2xl font-black text-slate-900 dark:text-white">
                    {pricing.currency === 'INR' ? '₹' : pricing.currency === 'USD' ? '$' : `${pricing.currency} `}
                    {amountDue.toFixed(2)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-slate-500 line-through">
                    {pricing.currency === 'INR' ? '₹' : pricing.currency === 'USD' ? '$' : `${pricing.currency} `}
                    {originalAmount.toFixed(2)}
                  </p>
                </div>
              </div>
            )}

            <div className="grid md:grid-cols-2 gap-4">
              <div className="flex flex-col items-center justify-center p-4 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40">
                {generatingQr ? (
                  <div className="w-48 h-48 flex flex-col items-center justify-center gap-2 text-slate-400">
                    <Loader2 className="w-10 h-10 animate-spin text-amber-500" />
                    <span className="text-[10px] font-bold">Generating QR…</span>
                  </div>
                ) : dynamicQr ? (
                  <img
                    src={dynamicQr}
                    alt="UPI payment QR pre-filled with amount"
                    className="w-48 h-48 object-contain rounded-xl bg-white p-2"
                  />
                ) : selectedOption?.qr_image_url && !qrBroken ? (
                  <img
                    src={selectedOption.qr_image_url}
                    alt="Payment QR code"
                    onError={() => setQrBroken(true)}
                    className="w-48 h-48 object-contain rounded-xl bg-white p-2"
                  />
                ) : selectedOption?.type === 'upi' && !selectedOption?.qr_image_url ? (
                  <div className="w-48 h-48 flex flex-col items-center justify-center gap-2 text-slate-400">
                    <QrCode className="w-12 h-12" />
                    <span className="text-[10px] font-bold text-center px-2">
                      No QR uploaded yet. Contact the platform administrator.
                    </span>
                  </div>
                ) : (
                  <div className="w-48 h-48 flex flex-col items-center justify-center gap-2 text-slate-400">
                    <CreditCard className="w-12 h-12" />
                    <span className="text-[10px] font-bold text-center px-2">
                      Pay using the details on the right.
                    </span>
                  </div>
                )}
                {selectedOption?.upi_id && (
                  <p className="mt-3 text-xs font-mono font-bold text-slate-700 dark:text-slate-200">
                    {selectedOption.upi_id}
                  </p>
                )}
                {paymentInfo.payee_name && (
                  <p className="text-[10px] text-slate-500">Pay to {paymentInfo.payee_name}</p>
                )}
                {dynamicQr && (
                  <p className="mt-1 text-[10px] font-bold text-emerald-600">
                    ✓ QR pre-filled with {pricing.currency === 'INR' ? '₹' : `${pricing.currency} `}{amountDue || originalAmount}
                  </p>
                )}
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Payment Method
                  </label>
                  <select id="PremiumModal-selectedOptionId" name="selectedOptionId"
                    value={selectedOptionId || ''}
                    onChange={(e) => {
                      setSelectedOptionId(Number(e.target.value) || null);
                      setQrBroken(false);
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-bold"
                  >
                    {paymentOptions.length === 0 ? (
                      <option value="">No payment options configured</option>
                    ) : (
                      paymentOptions.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.label}{o.is_default ? ' (default)' : ''}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-600 dark:text-slate-300">
                      {selectedPlan === 'pro' ? 'Pro' : 'Premium'} plan
                    </span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {pricing.currency === 'INR' ? '\u20b9' : pricing.currency === 'USD' ? '$' : `${pricing.currency} `}{originalAmount}
                    </span>
                  </div>
                  <div className="flex justify-between items-center mt-2 pt-2 border-t border-amber-200 dark:border-amber-800">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Amount to pay</span>
                    <span className="text-lg font-black text-amber-700 dark:text-amber-300">
                      {pricing.currency === 'INR' ? '\u20b9' : pricing.currency === 'USD' ? '$' : `${pricing.currency} `}{amountDue}
                    </span>
                  </div>
                </div>

                {(selectedOption?.instructions || paymentInfo.instructions) && (
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    {selectedOption?.instructions || paymentInfo.instructions}
                  </p>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Payment Reference / UTR <span className="text-red-500">*</span>
                  </label>
                  <input id="PremiumModal-paymentRef" name="paymentRef"
                    type="text"
                    value={paymentRef}
                    onChange={(e) => setPaymentRef(e.target.value)}
                    placeholder="e.g. 412345678901"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Payment Screenshot (optional)
                  </label>
                  {proofPreview && (
                    <div className="flex items-center gap-2 mb-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                      <img src={proofPreview} alt="Payment proof" className="w-10 h-10 rounded-lg object-cover" />
                      <span className="text-[10px] text-slate-500 truncate flex-1">
                        {proofUrl ? 'Uploaded' : 'Preview'}
                      </span>
                    </div>
                  )}
                  <label className="flex items-center justify-center gap-2 w-full p-2.5 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-brand-500 cursor-pointer transition">
                    <Upload className="w-4 h-4 text-slate-400" />
                    <span className="text-[11px] text-slate-500">
                      {busy ? 'Uploading...' : 'Upload screenshot'}
                    </span>
                    <input type="file" accept="image/*" onChange={handleProofUpload} disabled={busy} className="hidden" />
                  </label>
                </div>

                <button
                  type="button"
                  onClick={handleSubmitProof}
                  disabled={busy || !paymentRef.trim()}
                  className="w-full px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 disabled:opacity-50 text-white font-bold text-xs shadow-lg shadow-amber-500/25 flex items-center justify-center gap-2 transition"
                >
                  {busy ? <RefreshCw className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4" /><span>Submit for Verification</span></>}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Submitted view */}
        {view === 'submitted' && (
          <div className="text-center space-y-4 py-6">
            <div className="w-16 h-16 rounded-3xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
              <RefreshCw className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">
                Payment Submitted!
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                Your payment for the {pendingRequest?.plan === 'pro' ? 'Pro' : 'Premium'} plan is being
                verified by the platform administrator. Your features will be activated as soon as the
                payment is confirmed.
              </p>
            </div>
            {pendingRequest?.payment_reference && (
              <div className="inline-block px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <span className="text-[10px] text-slate-500 block">Reference submitted</span>
                <span className="font-mono font-bold text-xs text-slate-800 dark:text-slate-200">
                  {pendingRequest.payment_reference}
                </span>
              </div>
            )}
            <button
              type="button"
              onClick={onClose}
              className="w-full py-3 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl text-xs transition"
            >
              Close
            </button>
          </div>
        )}

        {/* Upgrade button — plans view only */}
        {view === 'plans' && (
        <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center gap-3">
          <div className="flex-1 text-[10px] text-slate-400">
            <div className="flex items-center gap-1.5">
              <CreditCard className="w-3 h-3" />
              Secure payment · Cancel anytime
            </div>
          </div>
          <button
            onClick={handleUpgrade}
            disabled={busy || loading}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 disabled:opacity-50 text-white font-bold text-xs shadow-lg shadow-amber-500/25 flex items-center gap-2 transition"
          >
            {busy ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Zap className="w-4 h-4" />
                <span>
                  {isActive && currentPlan !== selectedPlan
                    ? `Switch to ${selectedPlan === 'premium' ? 'Premium' : 'Pro'}`
                    : isActive
                    ? 'Renew Subscription'
                    : `Upgrade to ${selectedPlan === 'premium' ? 'Premium' : 'Pro'}`}
                </span>
              </>
            )}
          </button>
        </div>
        )}
      </div>
    </div>,
    document.body
  );
}