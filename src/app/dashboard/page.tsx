// @ts-nocheck
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSession } from '@/lib/api';
import { Shield, GraduationCap, Users, DoorOpen, User } from 'lucide-react';

const ROLE_CONFIG = {
  super_admin: { label: 'Super Admin', href: '/dashboard/super-admin', icon: <Shield size={20} />, color: 'bg-purple-50 text-purple-700' },
  school_admin: { label: 'School Admin', href: '/dashboard/school-admin', icon: <GraduationCap size={20} />, color: 'bg-blue-50 text-blue-700' },
  teacher: { label: 'Teacher', href: '/dashboard/teacher', icon: <Users size={20} />, color: 'bg-green-50 text-green-700' },
  gate_officer: { label: 'Gate Officer', href: '/dashboard/gate', icon: <DoorOpen size={20} />, color: 'bg-orange-50 text-orange-700' },
  parent: { label: 'Parent', href: '/dashboard/parent', icon: <User size={20} />, color: 'bg-pink-50 text-pink-700' },
};

export default function DashboardRouter() {
  const [roles, setRoles] = useState<string[]>([]);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
    const session = getSession();
    if (!session?.user_id) { router.push('/auth/login'); return; }

    // Get roles from cookie (set during login)
    const userRoles = [...new Set((session.roles || []).map((r: any) => r.role))] as string[];
    
    if (userRoles.length === 0) {
      // No roles in cookie — just go to super admin as fallback
      router.push('/dashboard/super-admin');
      return;
    }

    // ALWAYS show role picker — let user choose
    setRoles(userRoles);
  }, []);

  if (!mounted) return <div className="min-h-screen flex items-center justify-center"><div className="animate-pulse text-primary-600">Loading...</div></div>;

  if (roles.length === 0) return <div className="min-h-screen flex items-center justify-center"><div className="animate-pulse text-primary-600">Redirecting...</div></div>;

  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-4">
      <div className="w-full max-w-sm">
        <h2 className="text-xl font-bold text-center mb-2">Choose Dashboard</h2>
        <p className="text-sm text-gray-500 text-center mb-6">Select which role to continue as</p>
        <div className="space-y-2">
          {roles.map((role) => {
            const config = ROLE_CONFIG[role];
            if (!config) return null;
            return (
              <button key={role} onClick={() => router.push(config.href)}
                className="w-full flex items-center gap-3 p-4 rounded-xl border border-gray-200 hover:border-primary-300 hover:bg-primary-50 transition-all text-left">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${config.color}`}>
                  {config.icon}
                </div>
                <span className="font-medium text-gray-800">{config.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
