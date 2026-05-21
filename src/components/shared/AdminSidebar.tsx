'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Users, GraduationCap, ClipboardList, Settings,
  DoorOpen, BarChart3, School, Menu, X, LogOut,
} from 'lucide-react';
import { logout } from '@/lib/api';

const LOGO_URL = 'https://www.image2url.com/r2/default/images/1779230378321-292c7b74-6217-41ff-832a-180a535ea4cb.png';

interface NavItem { label: string; href: string; icon: React.ReactNode; }

const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard/school-admin', icon: <LayoutDashboard size={18} /> },
  { label: 'Students', href: '/dashboard/school-admin/students', icon: <Users size={18} /> },
  { label: 'Staff', href: '/dashboard/school-admin/staff', icon: <GraduationCap size={18} /> },
  { label: 'Classes', href: '/dashboard/school-admin/classes', icon: <School size={18} /> },
  { label: 'Attendance', href: '/dashboard/school-admin/attendance', icon: <ClipboardList size={18} /> },
  { label: 'Gate Activity', href: '/dashboard/school-admin/gate-log', icon: <DoorOpen size={18} /> },
  { label: 'Reports', href: '/dashboard/school-admin/reports', icon: <BarChart3 size={18} /> },
  { label: 'Settings', href: '/dashboard/school-admin/settings', icon: <Settings size={18} /> },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navContent = (
    <>
      <div className="p-5">
        <Link href="/dashboard/school-admin" className="flex items-center gap-2.5">
          <img src={LOGO_URL} alt="MyEduRide" className="h-8" />
          <span className="font-bold text-primary-700 text-sm">MyEduRide</span>
        </Link>
      </div>

      <nav className="flex-1 px-3 space-y-1">
        {navItems.map(item => {
          const isActive = pathname === item.href ||
            (item.href !== '/dashboard/school-admin' && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all ${
                isActive
                  ? 'bg-primary-50 text-primary-700 shadow-sm'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
              }`}
            >
              <span className={isActive ? 'text-primary-600' : 'text-gray-400'}>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t">
        <button onClick={logout} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium text-gray-500 hover:bg-red-50 hover:text-red-600 w-full transition-all">
          <LogOut size={18} className="text-gray-400" />
          Sign Out
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile hamburger */}
      <button onClick={() => setMobileOpen(true)} className="fixed top-4 left-4 z-30 p-2 rounded-xl bg-white shadow-md border md:hidden">
        <Menu size={20} className="text-gray-700" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-60 bg-white flex flex-col shadow-2xl rounded-r-2xl">
            <button onClick={() => setMobileOpen(false)} className="absolute top-4 right-4 p-1 text-gray-400 hover:text-gray-600">
              <X size={18} />
            </button>
            {navContent}
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden md:flex fixed left-0 top-0 bottom-0 w-56 bg-white border-r border-gray-100 flex-col z-20">
        {navContent}
      </aside>
    </>
  );
}
