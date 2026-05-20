'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
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
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });

      if (!res.ok) {
        const text = await res.text();
        try {
          const data = JSON.parse(text);
          setError(data.error || 'Failed to send code.');
        } catch {
          setError('Server error. Please try again.');
        }
        return;
      }

      setStep('otp');
    } catch (err: any) {
      setError(err?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), code: otp }),
      });

      if (!res.ok) {
        const text = await res.text();
        try {
          const data = JSON.parse(text);
          setError(data.error || 'Invalid code.');
        } catch {
          setError('Verification failed. Try again.');
        }
        return;
      }

      const data = await res.json();

      // Use the magic link token to create a Supabase session
      if (data.redirect_url) {
        const url = new URL(data.redirect_url);
        const tokenHash = url.searchParams.get('token_hash') || data.token_hash;
        const type = url.searchParams.get('type') || 'magiclink';

        if (tokenHash) {
          const supabase = createClient();
          await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: type as any,
          });
        }
      }

      router.push('/dashboard');
    } catch (err: any) {
      setError(err?.message || 'Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      {/* Background video */}
      <video
        autoPlay
        muted
        loop
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
      >
        <source src={BG_VIDEO_URL} type="video/mp4" />
      </video>

      {/* Dark overlay - subtle */}
      <div className="absolute inset-0 bg-black/40" />

      {/* Content */}
      <div className="relative z-10 w-full max-w-md px-4">
        {/* Card - glassmorphism transparent */}
        <div className="bg-white/10 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 p-8">
          {/* Logo and branding */}
          <div className="text-center mb-8">
            <img
              src={LOGO_URL}
              alt="MyEduRide"
              className="h-16 mx-auto mb-4 object-contain"
            />
            <h1 className="text-2xl font-bold text-white">Welcome Back</h1>
            <p className="text-white/60 mt-1 text-sm">Sign in to your MyEduRide account</p>
          </div>

          {step === 'email' ? (
            <div className="space-y-5">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-white/80 mb-1.5">
                  Email Address
                </label>
                <input
                  id="email"
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
                disabled={loading || !email}
                className="w-full py-3 px-4 rounded-xl bg-white text-primary-700 font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white/90 shadow-lg"
              >
                {loading ? 'Sending code...' : 'Send Login Code'}
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="text-center p-4 rounded-xl bg-green-500/20 border border-green-400/30 mb-2">
                <p className="text-sm text-green-200">
                  We sent a 6-digit code to <strong className="text-white">{email}</strong>
                </p>
              </div>

              <div>
                <label htmlFor="otp" className="block text-sm font-medium text-white/80 mb-1.5">
                  Enter Code
                </label>
                <input
                  id="otp"
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

        {/* Footer */}
        <p className="text-center text-xs text-white/60 mt-6">
          MyEduRide — The Student Safety Platform
        </p>
      </div>
    </div>
  );
}
