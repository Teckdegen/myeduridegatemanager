'use client';

import { useEffect, useState } from 'react';

const LOGO_URL = 'https://www.image2url.com/r2/default/images/1779230378321-292c7b74-6217-41ff-832a-180a535ea4cb.png';
const BG_VIDEO_URL = 'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260314_131748_f2ca2a28-fed7-44c8-b9a9-bd9acdd5ec31.mp4';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [schoolBranding, setSchoolBranding] = useState<any>(null);
  const [schoolId, setSchoolId] = useState<string | null>(null);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const sid = new URLSearchParams(window.location.search).get('school_id');
    setSchoolId(sid);
  }, []);

  useEffect(() => {
    if (!schoolId) return;
    fetch(`/api/public/school-branding?school_id=${schoolId}`)
      .then((r) => r.json())
      .then((d) => setSchoolBranding(d.school || null))
      .catch(() => {});
  }, [schoolId]);

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) return;
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });

      const text = await response.text();
      console.log('[LOGIN] login response status:', response.status);
      console.log('[LOGIN] login response body:', text);

      let data: any = {};
      try { data = JSON.parse(text); } catch { data = { error: text }; }

      if (!response.ok) {
        setError(data.error || 'Failed to sign in.');
        setLoading(false);
        return;
      }

      window.location.href = '/dashboard';
    } catch (err: any) {
      console.error('[LOGIN] login error:', err);
      setError('Network error. Check your connection.');
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
            <img
              src={schoolBranding?.logo_url ? `/api/photo?path=${encodeURIComponent(schoolBranding.logo_url)}` : LOGO_URL}
              alt="MyEduRide"
              className="h-16 mx-auto mb-4 object-contain"
            />
            <h1 className="text-2xl font-bold text-white">Welcome Back</h1>
            <p className="text-white/60 mt-1 text-sm">
              {schoolBranding?.welcome_message || (schoolBranding?.name ? `Welcome to ${schoolBranding.name}` : 'Sign in to your MyEduRide account')}
            </p>
          </div>

          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-white/80 mb-1.5">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                className="w-full px-4 py-3 border border-white/20 rounded-xl focus:ring-2 focus:ring-white/40 focus:border-transparent outline-none text-white placeholder:text-white/40 transition-all bg-white/10 backdrop-blur-sm"
                autoFocus
                autoComplete="username"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white/80 mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full px-4 py-3 border border-white/20 rounded-xl focus:ring-2 focus:ring-white/40 focus:border-transparent outline-none text-white placeholder:text-white/40 transition-all bg-white/10 backdrop-blur-sm"
                onKeyDown={(e) => { if (e.key === 'Enter') handleLogin(); }}
              />
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-red-500/20 border border-red-400/30">
                <p className="text-sm text-red-200">{error}</p>
              </div>
            )}

            <button
              type="button"
              onClick={handleLogin}
              disabled={loading || !username.trim() || !password.trim()}
              className="w-full py-3 px-4 rounded-xl bg-white text-primary-700 font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white/90 shadow-lg"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-white/60 mt-6">MyEduRide — The Student Safety Platform</p>
      </div>
    </div>
  );
}
