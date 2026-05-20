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

    console.log('[DASHBOARD] All cookies:', document.cookie);
    console.log('[DASHBOARD] Session cookie found:', !!sessionCookie);

    if (!sessionCookie) {
      router.push('/auth/login');
      return;
    }

    try {
      const rawValue = sessionCookie.split('=').slice(1).join('=');
      const decoded = decodeURIComponent(rawValue);
      console.log('[DASHBOARD] Decoded session:', decoded);
      const sessionData = JSON.parse(decoded);
      const roles = sessionData.roles || [];

      console.log('[DASHBOARD] Roles:', roles);

      if (roles.length === 0) {
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
  // Read roles from cookie again for rendering
  const cookieStr = document.cookie.split('; ').find(c => c.startsWith('myeduride_session='));
  const sessionData = cookieStr ? JSON.parse(decodeURIComponent(cookieStr.split('=').slice(1).join('='))) : { roles: [] };
  const uniqueRoles = [...new Set(sessionData.roles.map((r: any) => r.role))] as UserRole[];

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
