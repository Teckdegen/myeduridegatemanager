'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { getSession, logout } from '@/lib/api';
import { ChevronDown, User, GraduationCap, Shield, DoorOpen, Users, LogOut, Check } from 'lucide-react';

export function RoleSwitcher() {
  const [roles, setRoles] = useState<any[]>([]);
  const [session, setSession] = useState<any>(null);
  const [open, setOpen] = useState(false);
  const [currentRole, setCurrentRole] = useState('');
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const s = getSession();
    if (s) {
      setSession(s);
      // Fetch fresh roles
      fetch('/api/data', {
        method: 'POST', cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'query', params: { table: 'user_school_roles', select: 'role, school_id', filters: { user_id: s.user_id, is_active: true } } }),
      }).then(r => r.json()).then(data => {
        if (data.data) setRoles(data.data);
      }).catch(() => {});
    }

    // Detect current role from path
    if (pathname.includes('super-admin')) setCurrentRole('super_admin');
    else if (pathname.includes('school-admin')) setCurrentRole('school_admin');
    else if (pathname.includes('teacher')) setCurrentRole('teacher');
    else if (pathname.includes('gate')) setCurrentRole('gate_officer');
    else if (pathname.includes('parent')) setCurrentRole('parent');
  }, [pathname]);

  const switchRole = (role: string) => {
    setOpen(false);
    switch (role) {
      case 'super_admin': router.push('/dashboard/super-admin'); break;
      case 'school_admin': router.push('/dashboard/school-admin'); break;
      case 'teacher': router.push('/dashboard/teacher'); break;
      case 'gate_officer': router.push('/dashboard/gate'); break;
      case 'parent': router.push('/dashboard/parent'); break;
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'super_admin': return <Shield size={14} />;
      case 'school_admin': return <GraduationCap size={14} />;
      case 'teacher': return <Users size={14} />;
      case 'gate_officer': return <DoorOpen size={14} />;
      case 'parent': return <User size={14} />;
      default: return <User size={14} />;
    }
  };

  const uniqueRoles = [...new Set(roles.map(r => r.role))];

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="flex items-center gap-2 p-1.5 rounded-full hover:bg-gray-100 transition-colors">
        <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center text-white text-xs font-bold">
          {session?.full_name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2) || '?'}
        </div>
        <ChevronDown size={14} className="text-gray-500" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-xl border z-50 overflow-hidden">
            {/* User info */}
            <div className="p-3 border-b">
              <p className="font-medium text-sm">{session?.full_name || 'User'}</p>
              <p className="text-xs text-gray-500">{session?.email}</p>
            </div>

            {/* Roles */}
            {uniqueRoles.length > 1 && (
              <div className="p-2">
                <p className="px-2 py-1 text-[10px] font-medium text-gray-400 uppercase">Switch Role</p>
                {uniqueRoles.map((role: string) => (
                  <button key={role} onClick={() => switchRole(role)}
                    className={`w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-left text-sm transition-colors ${
                      role === currentRole ? 'bg-primary-50 text-primary-700' : 'hover:bg-gray-50 text-gray-700'
                    }`}>
                    {getRoleIcon(role)}
                    <span className="capitalize flex-1">{role.replace('_', ' ')}</span>
                    {role === currentRole && <Check size={14} className="text-primary-600" />}
                  </button>
                ))}
              </div>
            )}

            {/* Logout */}
            <div className="border-t p-2">
              <button onClick={logout} className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-left text-sm text-gray-700 hover:bg-red-50 hover:text-red-600">
                <LogOut size={14} />
                Sign Out
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
