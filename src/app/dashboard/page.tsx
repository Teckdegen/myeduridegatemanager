'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { UserRole, UserSchoolRole, School } from '@/lib/types';

interface RoleWithSchool extends UserSchoolRole {
  school: School;
}

export default function DashboardRouter() {
  const [roles, setRoles] = useState<RoleWithSchool[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const fetchRoles = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push('/auth/login');
        return;
      }

      const { data: userRoles } = await supabase
        .from('user_school_roles')
        .select('*, school:schools(*)')
        .eq('user_id', user.id)
        .eq('is_active', true);

      if (!userRoles || userRoles.length === 0) {
        router.push('/auth/login');
        return;
      }

      setRoles(userRoles as RoleWithSchool[]);

      // If user has only one role, redirect directly
      const uniqueRoles = [...new Set(userRoles.map(r => r.role))];
      if (uniqueRoles.length === 1) {
        const role = uniqueRoles[0] as UserRole;
        const school = (userRoles[0] as any).school;

        // Check if school admin needs setup
        if (role === 'school_admin' && school && !school.setup_completed) {
          router.push('/dashboard/school-admin/setup');
          return;
        }

        redirectToRoleDashboard(role);
        return;
      }

      setLoading(false);
    };

    fetchRoles();
  }, [router]);

  const redirectToRoleDashboard = (role: UserRole) => {
    switch (role) {
      case 'super_admin':
        router.push('/dashboard/super-admin');
        break;
      case 'school_admin':
        router.push('/dashboard/school-admin');
        break;
      case 'teacher':
        router.push('/dashboard/teacher');
        break;
      case 'gate_officer':
        router.push('/dashboard/gate');
        break;
      case 'parent':
        router.push('/dashboard/parent');
        break;
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
  const uniqueRoles = [...new Set(roles.map(r => r.role))];

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="card w-full max-w-md">
        <h2 className="text-xl font-bold text-center mb-6">Select Your Dashboard</h2>
        <div className="space-y-3">
          {uniqueRoles.map((role) => (
            <button
              key={role}
              onClick={() => redirectToRoleDashboard(role as UserRole)}
              className="w-full p-4 text-left rounded-lg border border-gray-200 hover:border-primary-300 hover:bg-primary-50 transition-colors"
            >
              <span className="font-medium capitalize">{role.replace('_', ' ')}</span>
              <span className="block text-sm text-gray-500 mt-1">
                {getRoleDescription(role as UserRole)}
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
    case 'parent': return 'View your children\'s attendance and notifications';
  }
}
