'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const LOGO_URL = 'https://www.image2url.com/r2/default/images/1779230378321-292c7b74-6217-41ff-832a-180a535ea4cb.png';
const BG_VIDEO_URL = 'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260314_131748_f2ca2a28-fed7-44c8-b9a9-bd9acdd5ec31.mp4';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleSendOTP = async () => {
    if (!email.trim()) return;
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });

      const text = await response.text();
      console.log('[LOGIN] send-otp response status:', response.status);
      console.log('[LOGIN] send-otp response body:', text);

      let data: any = {};
      try { data = JSON.parse(text); } catch { data = { error: text }; }

      if (!response.ok) {
        setError(data.error || 'Failed to send code.');
        setLoading(false);
        return;
      }

      if (data.success) {
        setStep('otp');
      } else {
        setError(data.error || 'Unknown error');
      }
    } catch (err: any) {
      console.error('[LOGIN] fetch error:', err);
      setError('Network error. Check your connection.');
    }

    setLoading(false);
  };

  const handleVerifyOTP = async () => {
    if (otp.length !== 6) return;
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), code: otp }),
      });

      const text = await response.text();
      console.log('[LOGIN] verify-otp response status:', response.status);
      console.log('[LOGIN] verify-otp response body:', text);

      let data: any = {};
      try { data = JSON.parse(text); } catch { data = { error: text }; }

      if (!response.ok) {
        setError(data.error || 'Invalid code.');
        setLoading(false);
        return;
      }

      // Session cookie set by API — just redirect
      router.push('/dashboard');
    } catch (err: any) {
      console.error('[LOGIN] verify error:', err);
      setError('Verification failed. Try again.');
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      {/* Background video */}
      <video autoPlay muted loop playsInline className="absolute inset-0 w-full h-full object-cover">
        <source src={BG_VIDEO_URL} type="video/mp4" />
      </video>

      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/40" />

      {/* Content */}
      <div className="relative z-10 w-full max-w-md px-4">
        <div className="bg-white/10 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 p-8">
          {/* Logo */}
          <div className="text-center mb-8">
            <img src={LOGO_URL} alt="MyEduRide" className="h-16 mx-auto mb-4 object-contain" />
            <h1 className="text-2xl font-bold text-white">Welcome Back</h1>
            <p className="text-white/60 mt-1 text-sm">Sign in to your MyEduRide account</p>
          </div>

          {step === 'email' ? (
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-white/80 mb-1.5">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="w-full px-4 py-3 border border-white/20 rounded-xl focus:ring-2 focus:ring-white/40 focus:border-transparent outline-none text-white placeholder:text-white/40 transition-all bg-white/10 backdrop-blur-sm"
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSendOTP(); }}
                  autoFocus
                />
              </div>

              {error && (
                <div className="p-3 rounded-lg bg-red-500/20 border border-red-400/30">
                  <p className="text-sm text-red-200">{error}</p>
                </div>
              )}

              <button
                type="button"
                onClick={handleSendOTP}
                disabled={loading || !email.trim()}
                className="w-full py-3 px-4 rounded-xl bg-white text-primary-700 font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white/90 shadow-lg"
              >
                {loading ? 'Sending code...' : 'Send Login Code'}
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="text-center p-4 rounded-xl bg-green-500/20 border border-green-400/30">
                <p className="text-sm text-green-200">
                  Code sent to <strong className="text-white">{email}</strong>
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-white/80 mb-1.5">Enter Code</label>
                <input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  className="w-full px-4 py-3 border border-white/20 rounded-xl focus:ring-2 focus:ring-white/40 focus:border-transparent outline-none text-center text-2xl tracking-[0.3em] font-mono text-white placeholder:text-white/30 transition-all bg-white/10 backdrop-blur-sm"
                  maxLength={6}
                  onKeyDown={(e) => { if (e.key === 'Enter' && otp.length === 6) handleVerifyOTP(); }}
                  autoFocus
                />
              </div>

              {error && (
                <div className="p-3 rounded-lg bg-red-500/20 border border-red-400/30">
                  <p className="text-sm text-red-200">{error}</p>
                </div>
              )}

              <button
                type="button"
                onClick={handleVerifyOTP}
                disabled={loading || otp.length !== 6}
                className="w-full py-3 px-4 rounded-xl bg-white text-primary-700 font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white/90 shadow-lg"
              >
                {loading ? 'Verifying...' : 'Verify & Sign In'}
              </button>

              <button
                type="button"
                onClick={() => { setStep('email'); setOtp(''); setError(''); }}
                className="w-full text-sm text-white/50 hover:text-white transition-colors"
              >
                Use a different email
              </button>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-white/60 mt-6">MyEduRide — The Student Safety Platform</p>
      </div>
    </div>
  );
}
