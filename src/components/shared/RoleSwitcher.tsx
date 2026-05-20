'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { getSession, logout } from '@/lib/api';
import { ChevronDown, Shield, GraduationCap, DoorOpen, Users, User, LogOut, Check } from 'lucide-react';
import Link from 'next/link';

const ALL_ROLES = [
  { role: 'super_admin', label: 'Super Admin', href: '/dashboard/super-admin', icon: <Shield size={14} /> },
  { role: 'school_admin', label: 'School Admin', href: '/dashboard/school-admin', icon: <GraduationCap size={14} /> },
  { role: 'teacher', label: 'Teacher', href: '/dashboard/teacher', icon: <Users size={14} /> },
  { role: 'gate_officer', label: 'Gate Officer', href: '/dashboard/gate', icon: <DoorOpen size={14} /> },
  { role: 'parent', label: 'Parent', href: '/dashboard/parent', icon: <User size={14} /> },
];

export function RoleSwitcher() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const session = getSession();

  const currentRole = ALL_ROLES.find(r => pathname.startsWith(r.href))?.role || '';

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
          <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-xl border z-50 overflow-hidden">
            <div className="p-3 border-b">
              <p className="font-medium text-sm">{session?.full_name || 'User'}</p>
              <p className="text-xs text-gray-500">{session?.email}</p>
            </div>

            <div className="p-2">
              <p className="px-2 py-1 text-[10px] font-medium text-gray-400 uppercase">Dashboards</p>
              {ALL_ROLES.map((r) => (
                <Link key={r.role} href={r.href} onClick={() => setOpen(false)}
                  className={`w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm transition-colors ${
                    r.role === currentRole ? 'bg-primary-50 text-primary-700' : 'hover:bg-gray-50 text-gray-700'
                  }`}>
                  {r.icon}
                  <span className="flex-1">{r.label}</span>
                  {r.role === currentRole && <Check size={14} className="text-primary-600" />}
                </Link>
              ))}
            </div>

            <div className="border-t p-2">
              <button onClick={logout} className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm text-gray-700 hover:bg-red-50 hover:text-red-600">
                <LogOut size={14} /> Sign Out
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
