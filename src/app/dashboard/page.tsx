// @ts-nocheck
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { UserRole } from '@/lib/types';

export default function DashboardRouter() {
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<string[]>([]);
  const router = useRouter();

  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    // Read cookie
    const cookies = document.cookie.split('; ');
    const sessionCookie = cookies.find(c => c.startsWith('myeduride_session='));

    if (!sessionCookie) { router.push('/auth/login'); return; }

    try {
      let raw = sessionCookie.split('=').slice(1).join('=');
      let decoded = raw;
      for (let i = 0; i < 3; i++) { try { JSON.parse(decoded); break; } catch { decoded = decodeURIComponent(decoded); } }

      const sessionData = JSON.parse(decoded);
      let userRoles = sessionData.roles || [];

      // If roles empty, fetch fresh from API
      if (userRoles.length === 0 && sessionData.user_id) {
        try {
          const res = await fetch('/api/data', {
            method: 'POST', cache: 'no-store',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'query', params: { table: 'user_school_roles', select: 'role, school_id', filters: { user_id: sessionData.user_id, is_active: true } } }),
          });
          const freshData = await res.json();
          if (freshData.data && freshData.data.length > 0) {
            userRoles = freshData.data;
            // Update cookie
            sessionData.roles = userRoles;
            document.cookie = `myeduride_session=${encodeURIComponent(JSON.stringify(sessionData))}; path=/; max-age=${60*60*24*7}`;
          }
        } catch {}
      }

      // Still no roles — go to super admin as fallback
      if (userRoles.length === 0) {
        router.push('/dashboard/super-admin');
        return;
      }

      const uniqueRoles = [...new Set(userRoles.map((r: any) => r.role))] as string[];

      if (uniqueRoles.length === 1) {
        redirectToRole(uniqueRoles[0]);
        return;
      }

      setRoles(uniqueRoles);
      setLoading(false);
    } catch {
      document.cookie = 'myeduride_session=; path=/; max-age=0';
      router.push('/auth/login');
    }
  };

  const redirectToRole = (role: string) => {
    switch (role) {
      case 'super_admin': router.push('/dashboard/super-admin'); break;
      case 'school_admin': router.push('/dashboard/school-admin'); break;
      case 'teacher': router.push('/dashboard/teacher'); break;
      case 'gate_officer': router.push('/dashboard/gate'); break;
      case 'parent': router.push('/dashboard/parent'); break;
      default: router.push('/dashboard/super-admin');
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="animate-pulse text-primary-600">Loading...</div></div>;
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-xl border p-8 w-full max-w-md">
        <h2 className="text-xl font-bold text-center mb-6">Select Dashboard</h2>
        <div className="space-y-3">
          {roles.map((role) => (
            <button key={role} onClick={() => redirectToRole(role)}
              className="w-full p-4 text-left rounded-xl border border-gray-200 hover:border-primary-300 hover:bg-primary-50 transition-all">
              <span className="font-medium capitalize">{role.replace('_', ' ')}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
