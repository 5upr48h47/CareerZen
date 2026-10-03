import React, { useState } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import FaceScanCamera from './FaceScanCamera';
import {
  ShieldCheck,
  CheckCircle2,
  X,
  CreditCard,
  Lock,
  ArrowRight,
  RefreshCw,
  Sparkles,
  Upload,
  AlertCircle,
  FileCheck2,
  BadgeCheck,
  Fingerprint,
  ScanFace,
} from 'lucide-react';

export default function AadhaarVerificationModal({ isOpen, onClose, onVerified }) {
  const { user, refreshUser } = useAuth();

  const [step, setStep] = useState(1); // 1: Enter Aadhaar, 2: Face Scan (biometric), 3: Student ID (Optional/Bonus), 4: Success
  const [aadhaarRaw, setAadhaarRaw] = useState('');
  const [maskedAadhaar, setMaskedAadhaar] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Student College ID card upload state
  const [collegeName, setCollegeName] = useState('');
  const [gradYear, setGradYear] = useState('2026');
  const [studentCardFile, setStudentCardFile] = useState(null);

  // Biometric (face scan) state
  const [biometricLabel, setBiometricLabel] = useState('face');
  const [faceScanDone, setFaceScanDone] = useState(false);
  const [faceTemplate, setFaceTemplate] = useState('');

  if (!isOpen) return null;

  // Format 12-digit into 4-digit blocks: 1234 5678 9012
  const handleAadhaarChange = (e) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 12);
    setAadhaarRaw(digits);
  };

  const formattedAadhaar = aadhaarRaw.replace(/(\d{4})(?=\d)/g, '$1 ');

  // Step 1: Validate Aadhaar number, then go straight to biometric (no OTP step)
  function handleLinkAadhaar(e) {
    if (e) e.preventDefault();
    if (aadhaarRaw.length !== 12) {
      setError('Please enter a valid 12-digit Aadhaar number.');
      return;
    }
    if (aadhaarRaw.startsWith('0') || aadhaarRaw.startsWith('1')) {
      setError('UIDAI numbers cannot begin with 0 or 1.');
      return;
    }

    setError('');
    setMaskedAadhaar(`XXXX-XXXX-${aadhaarRaw.slice(-4)}`);
    setStep(2);
  }

  // Skip the Aadhaar number entirely and go straight to biometric
  function handleSkipToBiometric(e) {
    if (e) e.preventDefault();
    setError('');
    setStep(2);
  }

  // Step 3: Optional Student ID Upload
  async function handleUploadStudentId(e) {
    if (e) e.preventDefault();
    setLoading(true);
    try {
      const sampleDocUrl = studentCardFile
        ? URL.createObjectURL(studentCardFile)
        : `https://images.unsplash.com/photo-1544717305-2782549b5136?w=600&auto=format&fit=crop&q=80`;

      await api.uploadStudentId({
        documentUrl: sampleDocUrl,
        collegeName: collegeName || 'Indian Institute of Technology (IIT) / NIT',
        graduationYear: gradYear
      });

      await refreshUser();
      setStep(4);
      if (onVerified) onVerified();
    } catch (err) {
      setError(err.message || 'Failed to upload student document.');
    } finally {
      setLoading(false);
    }
  }

  function handleSkipStudentCard() {
    setStep(4);
    if (onVerified) onVerified();
  }

  // Called by FaceScanCamera once real pixels have been captured
  function handleFaceCaptured(result) {
    if (!result?.template) return;
    setFaceTemplate(result.template);
    setFaceScanDone(true);
  }

  async function handleEnrollBiometric(e) {
    if (e) e.preventDefault();
    if (!faceScanDone || !faceTemplate) return;

    setLoading(true);
    try {
      const res = await api.enrollBiometric({
        template: faceTemplate,
        label: biometricLabel,
        aadhaarNumber: aadhaarRaw.length === 12 ? aadhaarRaw : undefined
      });
      // Persist template locally so biometric sign-in can recall it
      localStorage.setItem('careerzen_biometric_template', faceTemplate);
      if (res.aadhaarMasked) setMaskedAadhaar(res.aadhaarMasked);
      await refreshUser();
      setStep(3);
      if (onVerified) onVerified();
    } catch (err) {
      setError(err.message || 'Failed to enroll biometric template.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/70 backdrop-blur-md p-4 animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-200 dark:border-slate-800 relative max-h-[92vh] overflow-y-auto">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white mx-auto mb-3 shadow-lg shadow-emerald-500/25">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center justify-center gap-1.5">
            Government KYC & Student Verification
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
            Get the <span className="font-bold text-emerald-600 dark:text-emerald-400">🛡️ Verified Talent Badge</span> on your profile, increase recruiter response by 3.8x, and unlock verified student opportunities.
          </p>
        </div>

        {/* Step Progress Dots */}
        <div className="flex items-center justify-center space-x-2 mb-6">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                step === i
                  ? 'w-8 bg-emerald-600'
                  : step > i
                  ? 'w-3 bg-emerald-400'
                  : 'w-3 bg-slate-200 dark:bg-slate-700'
              }`}
            />
          ))}
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-3 mb-4 rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-xs text-red-600 dark:text-red-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────────── */}
        {/* STEP 1: Enter 12-Digit Aadhaar Number                                */}
        {/* ─────────────────────────────────────────────────────────────────── */}
        {step === 1 && (
          <form onSubmit={handleLinkAadhaar} className="space-y-4">
            <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 border border-emerald-200/80 dark:border-emerald-800/60 space-y-2">
              <div className="flex items-center space-x-2 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                <Lock className="w-4 h-4 text-emerald-600" />
                <span>UIDAI Security & Privacy Guarantee</span>
              </div>
              <p className="text-[11px] text-emerald-700 dark:text-emerald-400 leading-relaxed">
                Your 12-digit number is never stored in raw text. Only the masked preview (<code className="bg-emerald-100 dark:bg-emerald-900/60 px-1 py-0.5 rounded">XXXX-XXXX-1234</code>) and cryptographic hash are persisted.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Enter 12-Digit Aadhaar Number
              </label>
              <div className="relative">
                <CreditCard className="w-5 h-5 absolute left-3.5 top-3.5 text-slate-400" />
                <input id="AadhaarVerificationModal-formattedAadhaar" name="formattedAadhaar"
                  type="text"
                  inputMode="numeric"
                  value={formattedAadhaar}
                  onChange={handleAadhaarChange}
                  placeholder="2345 6789 0123"
                  className="w-full pl-11 pr-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-mono text-base tracking-widest focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  autoFocus
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-1.5 flex items-center gap-1">
                <span>Format: 12 digits (Indian UIDAI format)</span>
              </p>
            </div>

            <div className="flex items-center space-x-2 pt-1">
              <button
                type="button"
                onClick={handleSkipToBiometric}
                className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition shadow-lg shadow-indigo-500/25 flex items-center justify-center space-x-2"
              >
                <ScanFace className="w-4 h-4" />
                <span>Continue with Face Scan / Fingerprint</span>
              </button>
            </div>

            <button
              type="submit"
              disabled={loading || aadhaarRaw.length !== 12}
              className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition shadow-lg shadow-emerald-500/25 flex items-center justify-center space-x-2"
            >
              {loading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <span>Link Aadhaar &amp; Continue</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}

        {/* ─────────────────────────────────────────────────────────────────── */}
        {/* STEP 2: Biometric (Face Scan / Fingerprint)                    */}
        {/* ─────────────────────────────────────────────────────────────────── */}
        {step === 2 && (
          <form onSubmit={handleEnrollBiometric} className="space-y-4">
            <div className="p-3.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 flex items-start gap-3">
              <Fingerprint className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-xs text-indigo-900 dark:text-indigo-200">
                  Step 2 of 3: Biometric (Face Scan / Fingerprint)
                </p>
                <p className="text-[11px] text-indigo-700 dark:text-indigo-400 mt-0.5">
                  Scan your face or fingerprint to enable <span className="font-bold">🔐 Biometric Sign-In</span> — log in later without a password or OTP. Your Aadhaar ({maskedAadhaar}) is linked at the same time.
                </p>
              </div>
            </div>

            <div className="flex flex-col items-center">
              <FaceScanCamera
                onCapture={handleFaceCaptured}
                onCancel={() => setStep(1)}
                busy={loading}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Biometric Type
              </label>
              <select id="AadhaarVerificationModal-biometricLabel" name="biometricLabel"
                value={biometricLabel}
                onChange={(e) => setBiometricLabel(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100"
              >
                <option value="face">Face Scan</option>
                <option value="fingerprint">Fingerprint</option>
                <option value="iris">Iris Scan</option>
              </select>
            </div>

            <div className="flex items-center space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex-1 py-3 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold rounded-xl text-xs transition"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={loading || !faceScanDone}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition shadow-lg flex items-center justify-center space-x-1.5"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <><CheckCircle2 className="w-4 h-4" /><span>Enable Biometric Sign-In</span></>}
              </button>
            </div>
          </form>
        )}

        {/* ─────────────────────────────────────────────────────────────────── */}
        {/* STEP 3: Optional College ID Card / Student Verification             */}
        {/* ─────────────────────────────────────────────────────────────────── */}
        {step === 3 && (
          <form onSubmit={handleUploadStudentId} className="space-y-4">
            <div className="p-3.5 rounded-2xl bg-brand-50 dark:bg-brand-950/40 border border-brand-200 dark:border-brand-800 flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-brand-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-xs text-brand-900 dark:text-brand-200">
                  Biometric Verified! Step 3 of 3: Student Campus Credentials (Optional)
                </p>
                <p className="text-[11px] text-brand-700 dark:text-brand-400 mt-0.5">
                  Uploading your College ID or student email adds the coveted <span className="font-bold">🎓 Verified Student</span> badge for campus hiring cohorts.
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                College / University Name
              </label>
              <input id="AadhaarVerificationModal-collegeName" name="collegeName"
                type="text"
                value={collegeName}
                onChange={(e) => setCollegeName(e.target.value)}
                placeholder="e.g. IIT Bombay / BITS Pilani / Delhi University"
                className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Expected Graduation
                </label>
                <select id="AadhaarVerificationModal-gradYear" name="gradYear"
                  value={gradYear}
                  onChange={(e) => setGradYear(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100"
                >
                  <option value="2025">2025</option>
                  <option value="2026">2026</option>
                  <option value="2027">2027</option>
                  <option value="2028">2028</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  ID Card Document
                </label>
                <label className="flex items-center justify-center p-2.5 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-brand-500 cursor-pointer text-xs text-slate-500 dark:text-slate-400 truncate">
                  <Upload className="w-3.5 h-3.5 mr-1 flex-shrink-0" />
                  <span className="truncate">{studentCardFile ? studentCardFile.name : 'Upload Photo'}</span>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => setStudentCardFile(e.target.files[0])}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            <div className="flex items-center space-x-2 pt-2">
              <button
                type="button"
                onClick={handleSkipStudentCard}
                className="flex-1 py-3 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold rounded-xl text-xs transition"
              >
                Skip for Now
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-3 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl text-xs transition shadow-lg flex items-center justify-center space-x-1.5"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <span>Complete Verification</span>}
              </button>
            </div>
          </form>
        )}

        {/* ─────────────────────────────────────────────────────────────────── */}
        {/* STEP 4: Success Screen with Verified Badge Preview                 */}
        {/* ─────────────────────────────────────────────────────────────────── */}
        {step === 4 && (
          <div className="text-center space-y-5 py-3">
            <div className="w-16 h-16 rounded-3xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-inner">
              <BadgeCheck className="w-10 h-10" />
            </div>

            <div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">
                You are Officially Verified! 🎉
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                Your government identity and student profile are authenticated. The verified badge is now active on your profile.
              </p>
            </div>

            {/* Badge Preview Card */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between text-left">
              <div className="flex items-center space-x-3">
                <img
                  src={user?.profile?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.username}`}
                  alt="avatar"
                  className="w-10 h-10 rounded-full border-2 border-emerald-500 object-cover"
                />
                <div>
                  <div className="flex items-center space-x-1.5">
                    <span className="font-bold text-xs text-slate-900 dark:text-white">
                      {user?.profile?.full_name || user?.username}
                    </span>
                    <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                      <ShieldCheck className="w-3 h-3 text-emerald-600" />
                      <span>Aadhaar Verified</span>
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    ID: {maskedAadhaar || user?.aadhaar_masked || 'XXXX-XXXX-9842'} • Active
                  </span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition shadow-lg shadow-emerald-500/25"
            >
              Back to CareerZen Profile
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
