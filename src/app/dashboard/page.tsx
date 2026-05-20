// @ts-nocheck
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { UserRole } from '@/lib/types';

export default function DashboardRouter() {
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Read session from cookie
    const cookies = document.cookie.split('; ');
    const sessionCookie = cookies.find(c => c.startsWith('myeduride_session='));

    if (!sessionCookie) {
      router.push('/auth/login');
      return;
    }

    try {
      let rawValue = sessionCookie.split('=').slice(1).join('=');
      
      // Decode until we get valid JSON (handles single or double encoding)
      let decoded = rawValue;
      for (let i = 0; i < 3; i++) {
        try {
          JSON.parse(decoded);
          break; // It's valid JSON, stop decoding
        } catch {
          decoded = decodeURIComponent(decoded);
        }
      }

      const sessionData = JSON.parse(decoded);
      const roles = sessionData.roles || [];

      if (roles.length === 0) {
        // No roles in cookie — try fetching fresh from API
        try {
          const res = await fetch('/api/data', {
            method: 'POST', cache: 'no-store',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'query', params: { table: 'user_school_roles', select: 'role, school_id', filters: { user_id: sessionData.user_id, is_active: true } } }),
          });
          const freshData = await res.json();
          if (freshData.data && freshData.data.length > 0) {
            // Update cookie with fresh roles
            sessionData.roles = freshData.data;
            document.cookie = `myeduride_session=${encodeURIComponent(JSON.stringify(sessionData))}; path=/; max-age=${60*60*24*7}`;
            const freshRoles = [...new Set(freshData.data.map((r: any) => r.role))] as UserRole[];
            if (freshRoles.length === 1) { redirectToRoleDashboard(freshRoles[0]); return; }
            setLoading(false);
            return;
          }
        } catch {}
        
        // Still no roles — redirect to super admin if user exists
        if (sessionData.user_id) {
          router.push('/dashboard/super-admin');
          return;
        }
        router.push('/auth/login');
        return;
      }

      const uniqueRoles = [...new Set(roles.map((r: any) => r.role))] as UserRole[];

      if (uniqueRoles.length === 1) {
        redirectToRoleDashboard(uniqueRoles[0]);
        return;
      }

      setLoading(false);
    } catch (err) {
      console.error('[DASHBOARD] Parse error:', err);
      // Clear bad cookie and redirect to login
      document.cookie = 'myeduride_session=; path=/; max-age=0';
      router.push('/auth/login');
    }
  }, [router]);

  const redirectToRoleDashboard = (role: UserRole) => {
    switch (role) {
      case 'super_admin': router.push('/dashboard/super-admin'); break;
      case 'school_admin': router.push('/dashboard/school-admin'); break;
      case 'teacher': router.push('/dashboard/teacher'); break;
      case 'gate_officer': router.push('/dashboard/gate'); break;
      case 'parent': router.push('/dashboard/parent'); break;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-primary-600 text-lg">Loading dashboard...</div>
      </div>
    );
  }

  // Multiple roles — show role picker
  const cookieStr2 = document.cookie.split('; ').find(c => c.startsWith('myeduride_session='));
  let sessionForRender = { roles: [] as any[] };
  if (cookieStr2) {
    let raw = cookieStr2.split('=').slice(1).join('=');
    let dec = raw;
    for (let i = 0; i < 3; i++) { try { JSON.parse(dec); break; } catch { dec = decodeURIComponent(dec); } }
    try { sessionForRender = JSON.parse(dec); } catch {}
  }
  const uniqueRoles = [...new Set(sessionForRender.roles.map((r: any) => r.role))] as UserRole[];

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="bg-white rounded-2xl shadow-xl border p-8 w-full max-w-md">
        <h2 className="text-xl font-bold text-center mb-6">Select Your Dashboard</h2>
        <div className="space-y-3">
          {uniqueRoles.map((role) => (
            <button
              key={role}
              onClick={() => redirectToRoleDashboard(role)}
              className="w-full p-4 text-left rounded-xl border border-gray-200 hover:border-primary-300 hover:bg-primary-50 transition-colors"
            >
              <span className="font-medium capitalize">{role.replace('_', ' ')}</span>
              <span className="block text-sm text-gray-500 mt-1">
                {getRoleDescription(role)}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function getRoleDescription(role: UserRole): string {
  switch (role) {
    case 'super_admin': return 'Manage all schools and system settings';
    case 'school_admin': return 'Manage students, staff, and school operations';
    case 'teacher': return 'View class attendance and authorize dismissals';
    case 'gate_officer': return 'Verify students at the gate';
    case 'parent': return 'View your children attendance and notifications';
  }
}
