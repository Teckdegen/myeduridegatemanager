'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Building2, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { InitialPasswordFields } from '@/components/shared/InitialPasswordFields';

const LOGO_URL = 'https://www.image2url.com/r2/default/images/1779230378321-292c7b74-6217-41ff-832a-180a535ea4cb.png';

export default function RegisterSchoolPage() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: '',
    address: '',
    admin_username: '',
    admin_name: '',
    admin_phone: '',
    admin_email: '',
    admin_password: '',
    confirm_password: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.admin_password !== form.confirm_password) {
      toast.error('Password and confirmation do not match');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/schools/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Registration failed');
        return;
      }
      setSubmitted(true);
      toast.success(data.message || 'Registration submitted');
    } catch {
      toast.error('Registration failed');
    }
    setLoading(false);
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-primary-900 to-primary-700">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center shadow-xl">
          <CheckCircle size={48} className="text-green-600 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-slate-900 mb-2">Registration received</h1>
          <p className="text-sm text-slate-600 mb-6">
            We will review your school details. You can sign in after a platform administrator approves your account.
          </p>
          <Link href="/auth/login" className="btn-primary inline-block">
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-900 to-primary-700 py-10 px-4">
      <div className="max-w-lg mx-auto">
        <div className="text-center mb-8">
          <img src={LOGO_URL} alt="MyEduRide" className="h-10 mx-auto mb-3" />
          <h1 className="text-2xl font-bold text-white">Register your school</h1>
          <p className="text-sm text-white/70 mt-1">
            Create your account — we will approve and activate your school
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-2 text-primary-800 font-semibold">
            <Building2 size={18} />
            School details
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">School name *</label>
            <input
              className="input"
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Greenfield Academy"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Address</label>
            <input
              className="input"
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
            />
          </div>

          <div className="pt-2 border-t">
            <p className="text-xs font-semibold text-slate-700 mb-3">School administrator</p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Full name *</label>
                <input
                  className="input"
                  required
                  value={form.admin_name}
                  onChange={(e) => setForm((f) => ({ ...f, admin_name: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Username *</label>
                <input
                  className="input"
                  required
                  value={form.admin_username}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      admin_username: e.target.value.toLowerCase().replace(/\s/g, ''),
                    }))
                  }
                  placeholder="e.g. greenfield_admin"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                <input
                  type="email"
                  className="input"
                  value={form.admin_email}
                  onChange={(e) => setForm((f) => ({ ...f, admin_email: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Phone</label>
                <input
                  className="input"
                  value={form.admin_phone}
                  onChange={(e) => setForm((f) => ({ ...f, admin_phone: e.target.value }))}
                />
              </div>
              <InitialPasswordFields
                password={form.admin_password}
                confirmPassword={form.confirm_password}
                onPasswordChange={(v) => setForm((f) => ({ ...f, admin_password: v }))}
                onConfirmChange={(v) => setForm((f) => ({ ...f, confirm_password: v }))}
                label="Your login password"
              />
            </div>
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full py-3">
            {loading ? 'Submitting…' : 'Submit for approval'}
          </button>

          <p className="text-center text-xs text-slate-500">
            Already have an account?{' '}
            <Link href="/auth/login" className="text-primary-700 font-medium">
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
