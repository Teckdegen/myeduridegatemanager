'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Users, GraduationCap, ClipboardList, Settings,
  DoorOpen, BarChart3, School, Menu, X,
} from 'lucide-react';

const LOGO_URL = 'https://www.image2url.com/r2/default/images/1779230378321-292c7b74-6217-41ff-832a-180a535ea4cb.png';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard/school-admin', icon: <LayoutDashboard size={18} /> },
  { label: 'Students', href: '/dashboard/school-admin/students', icon: <Users size={18} /> },
  { label: 'Teachers', href: '/dashboard/school-admin/staff', icon: <GraduationCap size={18} /> },
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
      {/* Logo */}
      <div className="p-4 border-b">
        <Link href="/dashboard/school-admin" className="flex items-center gap-2">
          <img src={LOGO_URL} alt="MyEduRide" className="h-7" />
          <div>
            <p className="font-bold text-primary-600 text-xs leading-tight">MyEduRide</p>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
        {navItems.map(item => {
          const isActive = pathname === item.href ||
            (item.href !== '/dashboard/school-admin' && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <span className={isActive ? 'text-primary-600' : 'text-gray-400'}>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
    </>
  );

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-3 left-3 z-30 p-2 rounded-lg bg-white shadow-md border md:hidden"
      >
        <Menu size={20} className="text-gray-700" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-60 bg-white flex flex-col shadow-xl">
            <button onClick={() => setMobileOpen(false)} className="absolute top-3 right-3 p-1 text-gray-400">
              <X size={18} />
            </button>
            {navContent}
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden md:flex fixed left-0 top-0 bottom-0 w-56 bg-white border-r flex-col z-20">
        {navContent}
      </aside>
    </>
  );
}
