import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import FaceScanCamera from './FaceScanCamera';
import {
  X,
  Sparkles,
  GraduationCap,
  Building,
  Mail,
  Lock,
  Phone,
  ArrowRight,
  Zap,
  CheckCircle2,
  RefreshCw,
  ChevronLeft,
  Fingerprint,
  AlertCircle,
} from 'lucide-react';

// Google OAuth Client ID — replace with your real Client ID from Google Cloud Console
// For demo/local dev this uses a placeholder — the button will open the Google auth popup
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com';

// Explicit origin for the GSI client — Google's origin_mismatch error is triggered
// when the page origin doesn't match a registered JavaScript origin. Setting this
// explicitly (instead of letting GSI infer it from window.location) keeps the value
// stable and lets you register the same origin in the Google Cloud Console.
const GOOGLE_ORIGIN = import.meta.env.VITE_GOOGLE_ORIGIN || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173');

// ── Google Sign-In Button (GSI) ──────────────────────────────────────────────
function GoogleSignInButton({ onSuccess, label = 'Continue with Google' }) {
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = () => {
    setLoading(true);

    // Check if GIS is loaded AND we have a real Client ID
    const isPlaceholder = GOOGLE_CLIENT_ID.includes('YOUR_GOOGLE_CLIENT_ID');
    
    if (!isPlaceholder && typeof window !== 'undefined' && window.google?.accounts?.id) {
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        origin: GOOGLE_ORIGIN,
        callback: async (response) => {
          // Decode JWT credential to extract user info
          const parts = response.credential.split('.');
          const payload = JSON.parse(atob(parts[1]));
          onSuccess({
            googleId: payload.sub,
            email: payload.email,
            name: payload.name,
            avatar: payload.picture
          });
          setLoading(false);
        }
      });
      window.google.accounts.id.prompt((notification) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          // Fallback: render button click
          setLoading(false);
        }
      });
    } else {
      // GIS not loaded OR placeholder client ID used — dev demo fallback with mock Google identity
      const mockGoogleUser = {
        googleId: `google_demo_${Date.now()}`,
        email: `googleuser${Date.now().toString().slice(-4)}@gmail.com`,
        name: 'Google Demo User',
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=google${Date.now()}`
      };
      console.log('ℹ️ GIS not loaded — using mock Google identity for local dev:', mockGoogleUser);
      setTimeout(() => {
        onSuccess(mockGoogleUser);
        setLoading(false);
      }, 600);
    }
  };

  return (
    <button
      type="button"
      onClick={handleGoogleLogin}
      disabled={loading}
      className="w-full flex items-center justify-center space-x-2.5 px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 transition shadow-sm disabled:opacity-60"
    >
      {loading ? (
        <RefreshCw className="w-4 h-4 animate-spin text-slate-400" />
      ) : (
        <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
        </svg>
      )}
      <span>{loading ? 'Connecting...' : label}</span>
    </button>
  );
}

// ── OTP Input Component ──────────────────────────────────────────────────────
function OTPInput({ value, onChange, onResend, resendCooldown }) {
  return (
    <div className="space-y-3">
      <div>
        <label className="font-bold text-xs text-slate-700 dark:text-slate-300 block mb-1.5">
          Enter 6-Digit Verification Code
        </label>
        <input id="AuthModal-value" name="value"
          type="text"
          inputMode="numeric"
          maxLength={6}
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="• • • • • •"
          className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-center text-xl font-black tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-brand-500"
          autoFocus
        />
      </div>
      <button
        type="button"
        onClick={onResend}
        disabled={resendCooldown > 0}
        className="text-xs font-bold text-brand-600 dark:text-brand-400 disabled:text-slate-400 disabled:cursor-not-allowed hover:underline"
      >
        {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend Code'}
      </button>
    </div>
  );
}

// ── Main AuthModal ───────────────────────────────────────────────────────────
export default function AuthModal() {
  const { authModalOpen, authModalMode, closeAuthModal, openAuthModal, login, register, googleAuth, sendOtp, verifyOtp, registerPhone } = useAuth();

  const [mode, setMode] = useState('select'); // 'select' | 'email-login' | 'email-register' | 'phone' | 'phone-otp' | 'phone-register'
  const [role, setRole] = useState('job_seeker');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Email form
  const [emailForm, setEmailForm] = useState({ username: '', email: '', password: '', fullName: '', headline: '' });

  // Phone form
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [phoneStep, setPhoneStep] = useState('enter-phone'); // 'enter-phone' | 'verify-otp'
  const [phoneFullName, setPhoneFullName] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  // Biometric sign-in
  const [biometricMode, setBiometricMode] = useState(false);
  const [biometricStep, setBiometricStep] = useState(false);
  const [biometricError, setBiometricError] = useState('');


  useEffect(() => {
    if (authModalMode === 'login') setMode('select');
    if (authModalMode === 'register') setMode('select');
  }, [authModalMode]);

  useEffect(() => {
    if (resendCooldown > 0) {
      const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [resendCooldown]);

  if (!authModalOpen) return null;

  function reset() {
    setMode('select');
    setError('');
    setEmailForm({ username: '', email: '', password: '', fullName: '', headline: '' });
    setPhone('');
    setOtp('');
    setPhoneStep('enter-phone');
    setPhoneFullName('');
  }

  // ── EMAIL LOGIN ────────────────────────────────────────────────────────────
  async function handleEmailLogin(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(emailForm.username, emailForm.password);
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setSubmitting(false);
    }
  }

  // ── EMAIL REGISTER ─────────────────────────────────────────────────────────
  async function handleEmailRegister(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await register({ ...emailForm, role });
    } catch (err) {
      setError(err.message || 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  }

  // ── SEND OTP ───────────────────────────────────────────────────────────────
  async function handleSendOtp(purpose = 'login') {
    if (!phone.trim()) return setError('Enter your mobile number');
    setError('');
    setSubmitting(true);
    try {
      await sendOtp(phone, purpose);
      setPhoneStep('verify-otp');
      setResendCooldown(30);
    } catch (err) {
      setError(err.message || 'Failed to send OTP');
    } finally {
      setSubmitting(false);
    }
  }

  // ── VERIFY OTP ─────────────────────────────────────────────────────────────
  async function handleVerifyOtp(purpose = 'login') {
    if (otp.length !== 6) return setError('Enter the complete 6-digit code');
    setError('');
    setSubmitting(true);
    try {
      if (purpose === 'register') {
        await registerPhone(phone, otp, phoneFullName, role);
      } else {
        await verifyOtp(phone, otp, 'login');
      }
    } catch (err) {
      setError(err.message || 'OTP verification failed');
    } finally {
      setSubmitting(false);
    }
  }

  // ── GOOGLE AUTH ────────────────────────────────────────────────────────────
  async function handleGoogleSuccess(googleUser) {
    setError('');
    setSubmitting(true);
    try {
      await googleAuth({ ...googleUser, role });
    } catch (err) {
      setError(err.message || 'Google sign-in failed');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleBiometricCapture(result) {
    setBiometricStep(true);
    try {
      const res = await api.biometricLogin({ template: result.template });
      localStorage.setItem('careerzen_token', res.token);
      localStorage.setItem('careerzen_user', JSON.stringify(res.user));
      closeAuthModal();
      window.location.reload();
    } catch (err) {
      setBiometricError(err.message || 'Biometric sign-in failed.');
      setBiometricStep(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/70 backdrop-blur-md p-4 animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-800 relative max-h-[92vh] overflow-y-auto">

        {/* Close + Back buttons */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 pt-5 pb-2 bg-white dark:bg-slate-900">
          {mode !== 'select' ? (
            <button
              onClick={reset}
              className="flex items-center space-x-1 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-bold transition"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
          ) : <div />}

          <button
            onClick={() => { closeAuthModal(); reset(); }}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 pb-7 space-y-5">
          {/* Brand Header */}
          <div className="text-center">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center text-white mx-auto mb-3 shadow-lg shadow-brand-500/25">
              <Zap className="w-7 h-7 fill-current" />
            </div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white">
              {mode === 'select' ? 'Join CareerZen'
                : mode === 'email-login' ? 'Sign In with Email'
                : mode === 'email-register' ? 'Create Account'
                : mode === 'phone' || mode === 'phone-otp' ? 'Mobile Verification'
                : 'CareerZen'}
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              The project-first career platform for students & early talent.
            </p>
          </div>

          {/* ── Error Banner ── */}
          {error && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-xs text-red-600 dark:text-red-300 font-medium">
              {error}
            </div>
          )}

        {/* ── Error Banner ── */}
{error && (
  <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-xs text-red-600 dark:text-red-300 font-medium">
    {error}
  </div>
)}

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* MODE: SELECT — real-world auth method picker                     */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          {mode === 'select' && !biometricMode && (
            <div className="space-y-3.5">
              {/* Google OAuth (Gmail) */}
              <GoogleSignInButton onSuccess={handleGoogleSuccess} label="Continue with Google" />

              {/* Mobile OTP */}
              <button
                type="button"
                onClick={() => setMode('phone')}
                className="w-full flex items-center justify-center space-x-2.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 rounded-xl text-xs font-bold text-white transition shadow-sm shadow-emerald-500/20"
              >
                <Phone className="w-4 h-4" />
                <span>Continue with Mobile Number (+91)</span>
              </button>

              <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold uppercase tracking-wider my-2">
                <div className="flex-1 h-px bg-slate-100 dark:bg-slate-800" />
                or
                <div className="flex-1 h-px bg-slate-100 dark:bg-slate-800" />
              </div>

              {/* Biometric (Face / Fingerprint) Sign-In */}
              <button
                type="button"
                onClick={() => {
                  setBiometricError('');
                  setBiometricMode(true);
                }}
                disabled={biometricStep}
                className="w-full flex items-center justify-center space-x-2.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl text-xs font-bold text-white transition shadow-sm shadow-indigo-500/20"
              >
                <Fingerprint className="w-4 h-4" />
                <span>Sign In with Face / Fingerprint</span>
              </button>
              {biometricError && (
                <p className="text-[10px] text-red-500 text-center -mt-2">{biometricError}</p>
              )}

              {/* Email login */}
              <button
                type="button"
                onClick={() => setMode('email-login')}
                className="w-full flex items-center justify-center space-x-2.5 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 transition"
              >
                <Mail className="w-4 h-4" />
                <span>Sign in with Email & Password</span>
              </button>

              <p className="text-center text-[11px] text-slate-400 pt-1">
                New to CareerZen?{' '}
                <button type="button" onClick={() => setMode('email-register')} className="font-bold text-brand-600 dark:text-brand-400 hover:underline">
                  Create an account
                </button>
              </p>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* MODE: BIOMETRIC FACE SCAN (live camera sign-in)                   */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          {mode === 'select' && biometricMode && (
            <div className="space-y-3">
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300 text-center">
                Look at the camera to sign in
              </p>

              {biometricError && (
                <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-xs text-red-600 dark:text-red-300 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{biometricError}</span>
                </div>
              )}

              <FaceScanCamera
                onCapture={handleBiometricCapture}
                onCancel={() => {
                  setBiometricMode(false);
                  setBiometricError('');
                }}
                busy={biometricStep}
              />
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* MODE: EMAIL LOGIN                                                */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          {mode === 'email-login' && (
            <form onSubmit={handleEmailLogin} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Email or Username</label>
                <input id="AuthModal-username" name="username"
                  type="text"
                  value={emailForm.username}
                  onChange={(e) => setEmailForm({ ...emailForm, username: e.target.value })}
                  placeholder="alexchen or alex@example.com"
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                  required
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Password</label>
                <input id="AuthModal-password" name="password"
                  type="password"
                  value={emailForm.password}
                  onChange={(e) => setEmailForm({ ...emailForm, password: e.target.value })}
                  placeholder="••••••••"
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition shadow-lg shadow-brand-500/25 flex items-center justify-center space-x-1.5"
              >
                <span>{submitting ? 'Signing in...' : 'Sign In'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              <div className="pt-1 border-t border-slate-100 dark:border-slate-800">
                <GoogleSignInButton onSuccess={handleGoogleSuccess} label="Or continue with Google" />
              </div>
            </form>
          )}

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* MODE: EMAIL REGISTER                                             */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          {mode === 'email-register' && (
            <form onSubmit={handleEmailRegister} className="space-y-3 text-xs">
              {/* Role Selector */}
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1.5">I am joining as:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRole('job_seeker')}
                    className={`p-3 rounded-2xl border text-left transition flex flex-col gap-1 ${role === 'job_seeker' ? 'border-brand-500 bg-brand-50/60 dark:bg-brand-950/60 ring-1 ring-brand-500' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40'}`}
                  >
                    <GraduationCap className="w-4 h-4 text-brand-600" />
                    <span className="font-bold text-slate-900 dark:text-white">Student / Fresher</span>
                    <span className="text-[10px] text-slate-400">Find jobs & network</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole('recruiter')}
                    className={`p-3 rounded-2xl border text-left transition flex flex-col gap-1 ${role === 'recruiter' ? 'border-purple-500 bg-purple-50/60 dark:bg-purple-950/60 ring-1 ring-purple-500' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40'}`}
                  >
                    <Building className="w-4 h-4 text-purple-600" />
                    <span className="font-bold text-slate-900 dark:text-white">Recruiter</span>
                    <span className="text-[10px] text-slate-400">Hire early talent</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Full Name</label>
                <input id="AuthModal-fullName" name="fullName" type="text" value={emailForm.fullName} onChange={(e) => setEmailForm({ ...emailForm, fullName: e.target.value })} placeholder="e.g. Suprabhat Das" className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700" required />
              </div>
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Username</label>
                <input id="AuthModal-username" name="username" type="text" value={emailForm.username} onChange={(e) => setEmailForm({ ...emailForm, username: e.target.value })} placeholder="suprabhat123" className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700" required />
              </div>
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Email Address</label>
                <input id="AuthModal-email" name="email" type="email" value={emailForm.email} onChange={(e) => setEmailForm({ ...emailForm, email: e.target.value })} placeholder="alex@example.com" className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700" required />
              </div>
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Password</label>
                <input id="AuthModal-password" name="password" type="password" value={emailForm.password} onChange={(e) => setEmailForm({ ...emailForm, password: e.target.value })} placeholder="••••••••" className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700" required />
              </div>
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Headline / Target Role</label>
                <input id="AuthModal-headline" name="headline" type="text" value={emailForm.headline} onChange={(e) => setEmailForm({ ...emailForm, headline: e.target.value })} placeholder={role === 'recruiter' ? 'Technical Recruiter @ TechCorp' : 'CS Student | Aspiring Full-Stack Engineer'} className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700" />
              </div>

              <button type="submit" disabled={submitting} className="w-full py-3 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition shadow-lg flex items-center justify-center space-x-1.5">
                <span>{submitting ? 'Creating account...' : 'Create Account'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </form>
          )}

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* MODE: PHONE — enter number                                       */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          {mode === 'phone' && phoneStep === 'enter-phone' && (
            <div className="space-y-4 text-xs">
              <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80">
                <p className="text-emerald-700 dark:text-emerald-300 font-bold text-[11px]">
                  📱 A 6-digit verification code will be sent to your mobile number.
                </p>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Mobile Number</label>
                <div className="flex items-center space-x-2">
                  <span className="px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-bold text-xs flex-shrink-0">
                    +91
                  </span>
                  <input id="AuthModal-phone" name="phone"
                    type="tel"
                    inputMode="numeric"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="9876543210"
                    className="flex-1 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 tracking-widest font-mono"
                    maxLength={10}
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">Enter your 10-digit number. India (+91) format.</p>
              </div>

              {/* Role selector for new users */}
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1.5">I am joining as:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRole('job_seeker')}
                    className={`p-2.5 rounded-xl border text-left text-[11px] font-bold transition ${role === 'job_seeker' ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'}`}
                  >
                    🎓 Student / Fresher
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole('recruiter')}
                    className={`p-2.5 rounded-xl border text-left text-[11px] font-bold transition ${role === 'recruiter' ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/60 text-purple-800 dark:text-purple-200' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'}`}
                  >
                    🏢 Recruiter
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleSendOtp('login')}
                  disabled={submitting || phone.length < 10}
                  className="py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition flex items-center justify-center space-x-1.5"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>{submitting ? 'Sending...' : 'Send OTP (Login)'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!phoneFullName.trim()) {
                      setMode('phone-register');
                    } else {
                      handleSendOtp('register');
                    }
                  }}
                  disabled={submitting || phone.length < 10}
                  className="py-2.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition flex items-center justify-center space-x-1.5"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                  <span>New Account</span>
                </button>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* MODE: PHONE — OTP entry                                          */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          {mode === 'phone' && phoneStep === 'verify-otp' && (
            <div className="space-y-4 text-xs">
              <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 text-center">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 mx-auto mb-1" />
                <p className="font-bold text-emerald-700 dark:text-emerald-300 text-[11px]">
                  Code sent to +91 {phone.slice(0, 4)}****{phone.slice(-3)}
                </p>
              </div>

              <OTPInput
                value={otp}
                onChange={setOtp}
                onResend={() => handleSendOtp('login')}
                resendCooldown={resendCooldown}
              />

              <button
                type="button"
                onClick={() => handleVerifyOtp('login')}
                disabled={submitting || otp.length !== 6}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition shadow-lg flex items-center justify-center space-x-1.5"
              >
                <span>{submitting ? 'Verifying...' : 'Verify & Sign In'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* MODE: PHONE-REGISTER — name + OTP for new user                  */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          {mode === 'phone-register' && (
            <div className="space-y-4 text-xs">
              {phoneStep === 'enter-phone' ? (
                <>
                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Full Name</label>
                    <input id="AuthModal-phoneFullName" name="phoneFullName"
                      type="text"
                      value={phoneFullName}
                      onChange={(e) => setPhoneFullName(e.target.value)}
                      placeholder="e.g. Suprabhat Das"
                      className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                      required
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => handleSendOtp('register')}
                    disabled={submitting || phone.length < 10 || !phoneFullName.trim()}
                    className="w-full py-3 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition flex items-center justify-center space-x-1.5"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>{submitting ? 'Sending OTP...' : 'Send Verification Code'}</span>
                  </button>
                </>
              ) : (
                <>
                  <div className="p-3.5 rounded-2xl bg-brand-50 dark:bg-brand-950/40 border border-brand-200 dark:border-brand-800/80 text-center">
                    <CheckCircle2 className="w-5 h-5 text-brand-600 mx-auto mb-1" />
                    <p className="font-bold text-brand-700 dark:text-brand-300 text-[11px]">
                      Code sent to +91 {phone.slice(0, 4)}****{phone.slice(-3)}
                    </p>
                  </div>

                  <OTPInput
                    value={otp}
                    onChange={setOtp}
                    onResend={() => handleSendOtp('register')}
                    resendCooldown={resendCooldown}
                  />

                  <button
                    type="button"
                    onClick={() => handleVerifyOtp('register')}
                    disabled={submitting || otp.length !== 6}
                    className="w-full py-3 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition flex items-center justify-center space-x-1.5"
                  >
                    <span>{submitting ? 'Creating Account...' : 'Verify & Create Account'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
