import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  CreditCard,
  Sparkles,
  ShieldCheck,
  TrendingUp,
  Users,
  Briefcase,
  Zap,
  Check,
  X,
  ChevronLeft,
  Loader2
} from 'lucide-react';

export default function RecruiterPackages({ onNavigateBack }) {
  const { user } = useAuth();
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [view, setView] = useState('list'); // 'list' | 'payment'
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadPackages();
  }, []);

  async function loadPackages() {
    setLoading(true);
    setError('');
    try {
      const data = await api.getPackages();
      setPackages(data || []);
    } catch (err) {
      setError('Failed to load packages: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSelectPackage(pkg) {
    setSelectedPackage(pkg);
    setView('payment');
  }

  async function handleGoBack() {
    setSelectedPackage(null);
    setView('list');
    if (onNavigateBack) onNavigateBack();
  }

  async function handlePurchase(pkg) {
    if (!user) return;

    setProcessing(true);
    setError('');
    try {
      const res = await api.createPaymentOrder({
        packageId: pkg.id,
        currency: 'INR'
      });

      if (res.order && res.order.id) {
        // Redirect to Razorpay checkout or show order details
        // For now, show the order info
        alert(`Payment order created: ${res.order.id}\nAmount: ₹${res.order.amount / 100}\n\nIn a real app, this would open Razorpay checkout.`);
      }
    } catch (err) {
      setError(err.message || 'Failed to create payment order');
    } finally {
      setProcessing(false);
    }
  }

  const PLAN_STYLES = {
    1: { label: 'Basic', gradient: 'from-slate-400 to-slate-600', ring: 'border-slate-300', badge: 'bg-slate-100 text-slate-800' },
    2: { label: 'Standard', gradient: 'from-blue-400 to-blue-600', ring: 'border-blue-300', badge: 'bg-blue-100 text-blue-800' },
    3: { label: 'Premium', gradient: 'from-amber-400 to-orange-500', ring: 'border-amber-300', badge: 'bg-amber-100 text-amber-800' },
    4: { label: 'Enterprise', gradient: 'from-purple-500 to-indigo-600', ring: 'border-purple-300', badge: 'bg-purple-100 text-purple-800' },
  };

  function parseFeatures(features) {
    if (!features) return [];
    if (Array.isArray(features)) return features.map(String);
    try {
      const parsed = JSON.parse(features);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch { }
    return String(features).split('\n').map((s) => s.trim()).filter(Boolean);
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center">
        <Loader2 className="inline-block animate-spin w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full" />
        <p className="text-xs text-slate-400 mt-2">Loading packages...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={handleGoBack}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-black text-slate-900 dark:text-white">Recruiter Packages</h1>
            <p className="text-xs text-slate-500">Choose a package to unlock job posting limits and premium features</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm">
          {error}
        </div>
      )}

      {view === 'list' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {packages.map((pkg) => {
            const style = PLAN_STYLES[pkg.id] || PLAN_STYLES[1];
            const features = parseFeatures(pkg.features);
            const isUnlimited = pkg.jobLimit === -1;

            return (
              <div
                key={pkg.id}
                className={`p-5 rounded-3xl border-2 transition-all hover:shadow-lg ${
                  pkg.id === 1
                    ? 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900'
                    : `border-${style.gradient.split(' ')[0].split('-')[0]}-200 bg-gradient-to-br from-white via-${style.gradient.split(' ')[0]}-50/30 to-${style.gradient.split(' ')[2].split('-')[0]}-50/30 dark:from-slate-900 dark:via-${style.gradient.split(' ')[0]}-950/20 dark:to-${style.gradient.split(' ')[2].split('-')[0]}-950/20`
                }`}
              >
                <div className="text-center mb-4">
                  <div className={`inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br ${style.gradient} text-white mx-auto mb-3 shadow-lg`}>
                    <Briefcase className="w-7 h-7" />
                  </div>
                  <h3 className="font-extrabold text-lg text-slate-900 dark:text-white">{pkg.name}</h3>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${style.badge}`}>
                    {isUnlimited ? 'Unlimited Jobs' : `${pkg.jobLimit} Jobs`}
                  </span>
                </div>

                <div className="text-center mb-4">
                  <span className="text-3xl font-black text-slate-900 dark:text-white">₹{pkg.price}</span>
                  <span className="text-sm text-slate-500 font-medium"> / {pkg.durationDays} days</span>
                </div>

                <ul className="space-y-2 mb-5">
                  {features.map((feature, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                      <Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleSelectPackage(pkg)}
                  disabled={processing}
                  className={`w-full py-2.5 rounded-xl font-bold text-xs transition shadow-md flex items-center justify-center gap-2 ${
                    pkg.id === 1
                      ? 'bg-slate-600 hover:bg-slate-700 text-white'
                      : `bg-gradient-to-r ${style.gradient} hover:from-amber-500 hover:to-orange-600 text-white`
                  }`}
                >
                  {processing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-4 h-4" />
                      <span>{pkg.id === 1 ? 'Get Started Free' : 'Purchase Package'}</span>
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {view === 'payment' && selectedPackage && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 max-w-xl mx-auto space-y-4 animate-fadeIn">
          <div className="flex items-center gap-3 mb-2">
            <button
              onClick={handleGoBack}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div>
              <h2 className="font-extrabold text-lg text-slate-900 dark:text-white">Confirm Purchase</h2>
              <p className="text-xs text-slate-500">{selectedPackage.name} Package</p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/40 border border-amber-200 dark:border-amber-800 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">Total Amount</p>
              <p className="text-2xl font-black text-slate-900 dark:text-white">₹{selectedPackage.price}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-slate-500">Valid for</p>
              <p className="font-bold text-slate-800 dark:text-slate-200">{selectedPackage.durationDays} days</p>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-xs text-slate-600 dark:text-slate-400 text-center">
              You will be redirected to Razorpay for secure payment.
            </p>

            <button
              onClick={() => handlePurchase(selectedPackage)}
              disabled={processing}
              className="w-full px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 disabled:opacity-50 text-white font-bold text-sm shadow-lg shadow-amber-500/25 flex items-center justify-center gap-2 transition"
            >
              {processing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Creating Payment Order...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  <span>Pay with Razorpay</span>
                </>
              )}
            </button>
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
            <p className="text-[10px] text-slate-500 text-center">
              After payment, your package will be activated automatically. You can then post up to
              {selectedPackage.jobLimit === -1 ? 'unlimited' : selectedPackage.jobLimit} jobs for {selectedPackage.durationDays} days.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}