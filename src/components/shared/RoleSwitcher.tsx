'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter, usePathname } from 'next/navigation';
import type { UserRole, UserProfile, School } from '@/lib/types';
import { ChevronDown, User, GraduationCap, Shield, DoorOpen, Users, Plus, LogOut, Check } from 'lucide-react';

interface RoleAccount {
  role: UserRole;
  school: School | null;
  label: string;
}

export function RoleSwitcher() {
  const [roles, setRoles] = useState<RoleAccount[]>([]);
  const [currentRole, setCurrentRole] = useState<UserRole | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const fetchRoles = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get profile
      const { data: profileData } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      if (profileData) setProfile(profileData);

      // Get roles with school info
      const { data: userRoles } = await supabase
        .from('user_school_roles')
        .select('role, school:schools(id, name, logo_url, primary_color)')
        .eq('user_id', user.id)
        .eq('is_active', true);

      if (userRoles) {
        const accounts: RoleAccount[] = userRoles.map((r: any) => ({
          role: r.role,
          school: r.school,
          label: getRoleLabel(r.role, r.school?.name),
        }));
        setRoles(accounts);
      }

      // Detect current role from path
      if (pathname.includes('super-admin')) setCurrentRole('super_admin');
      else if (pathname.includes('school-admin')) setCurrentRole('school_admin');
      else if (pathname.includes('teacher')) setCurrentRole('teacher');
      else if (pathname.includes('gate')) setCurrentRole('gate_officer');
      else if (pathname.includes('parent')) setCurrentRole('parent');
    };

    fetchRoles();
  }, [pathname]);

  const switchRole = (role: UserRole) => {
    setOpen(false);
    switch (role) {
      case 'super_admin': router.push('/dashboard/super-admin'); break;
      case 'school_admin': router.push('/dashboard/school-admin'); break;
      case 'teacher': router.push('/dashboard/teacher'); break;
      case 'gate_officer': router.push('/dashboard/gate'); break;
      case 'parent': router.push('/dashboard/parent'); break;
    }
  };

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/auth/login');
  };

  const getRoleIcon = (role: UserRole) => {
    switch (role) {
      case 'super_admin': return <Shield size={16} />;
      case 'school_admin': return <GraduationCap size={16} />;
      case 'teacher': return <Users size={16} />;
      case 'gate_officer': return <DoorOpen size={16} />;
      case 'parent': return <User size={16} />;
    }
  };

  return (
    <div className="relative">
      {/* Trigger button - looks like Facebook account switcher */}
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 p-1.5 rounded-full hover:bg-gray-100 transition-colors"
      >
        <div className="w-9 h-9 rounded-full bg-primary-600 flex items-center justify-center text-white text-sm font-bold">
          {profile?.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2) || '?'}
        </div>
        <ChevronDown size={14} className="text-gray-500" />
      </button>

      {/* Dropdown panel */}
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-xl border z-50 overflow-hidden">
            {/* Current user */}
            <div className="p-4 border-b">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary-600 flex items-center justify-center text-white font-bold">
                  {profile?.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2) || '?'}
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{profile?.full_name || 'User'}</p>
                  <p className="text-sm text-gray-500">{profile?.email}</p>
                </div>
              </div>
            </div>

            {/* Role accounts */}
            <div className="p-2">
              <p className="px-3 py-1.5 text-xs font-medium text-gray-400 uppercase tracking-wide">Switch Account</p>
              {roles.map((account, idx) => (
                <button
                  key={`${account.role}-${idx}`}
                  onClick={() => switchRole(account.role)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                    account.role === currentRole
                      ? 'bg-primary-50 text-primary-700'
                      : 'hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center ${
                    account.role === currentRole ? 'bg-primary-100 text-primary-600' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {getRoleIcon(account.role)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{account.label}</p>
                    <p className="text-xs text-gray-400 capitalize">{account.role.replace('_', ' ')}</p>
                  </div>
                  {account.role === currentRole && (
                    <Check size={16} className="text-primary-600 shrink-0" />
                  )}
                </button>
              ))}
            </div>

            {/* Logout */}
            <div className="border-t p-2">
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left hover:bg-red-50 text-gray-700 hover:text-red-600 transition-colors"
              >
                <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center">
                  <LogOut size={16} />
                </div>
                <span className="text-sm font-medium">Sign Out</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function getRoleLabel(role: UserRole, schoolName?: string): string {
  switch (role) {
    case 'super_admin': return 'Super Admin';
    case 'school_admin': return schoolName || 'School Admin';
    case 'teacher': return schoolName ? `Teacher at ${schoolName}` : 'Teacher';
    case 'gate_officer': return schoolName ? `Gate Officer at ${schoolName}` : 'Gate Officer';
    case 'parent': return 'Parent Dashboard';
  }
}
