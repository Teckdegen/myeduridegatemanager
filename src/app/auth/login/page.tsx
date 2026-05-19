'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: false, // Only existing users can log in
        },
      });

      if (error) {
        setError('No account found with this email. Contact your school admin.');
        return;
      }

      setStep('otp');
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: otp,
        type: 'email',
      });

      if (error) {
        setError('Invalid code. Please try again.');
        return;
      }

      router.push('/dashboard');
    } catch {
      setError('Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-green-50 px-4">
      <div className="card w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-3">
            <img src="/logo.png" alt="MyEduRide" className="h-16" />
          </div>
          <h1 className="text-2xl font-bold text-primary-600">MyEduRide</h1>
          <p className="text-gray-500 mt-1 text-sm">The Student Safety Platform</p>
        </div>

        {step === 'email' ? (
          <form onSubmit={handleSendOTP} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                className="input"
                required
                autoFocus
              />
            </div>

            {error && (
              <p className="text-sm text-danger">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading || !email}
              className="btn-primary w-full"
            >
              {loading ? 'Sending code...' : 'Send Login Code'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOTP} className="space-y-4">
            <p className="text-sm text-gray-600 text-center">
              We sent a 6-digit code to <strong>{email}</strong>
            </p>

            <div>
              <label htmlFor="otp" className="block text-sm font-medium text-gray-700 mb-1">
                Enter Code
              </label>
              <input
                id="otp"
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                className="input text-center text-2xl tracking-widest"
                maxLength={6}
                required
                autoFocus
              />
            </div>

            {error && (
              <p className="text-sm text-danger">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading || otp.length !== 6}
              className="btn-primary w-full"
            >
              {loading ? 'Verifying...' : 'Verify & Login'}
            </button>

            <button
              type="button"
              onClick={() => { setStep('email'); setOtp(''); setError(''); }}
              className="w-full text-sm text-primary-600 hover:underline"
            >
              Use a different email
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
