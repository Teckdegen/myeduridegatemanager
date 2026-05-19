'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  ClipboardList,
  Settings,
  DoorOpen,
  BarChart3,
  School,
} from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard/school-admin', icon: <LayoutDashboard size={20} /> },
  { label: 'Students', href: '/dashboard/school-admin/students', icon: <Users size={20} /> },
  { label: 'Teachers', href: '/dashboard/school-admin/staff', icon: <GraduationCap size={20} /> },
  { label: 'Classes', href: '/dashboard/school-admin/classes', icon: <School size={20} /> },
  { label: 'Attendance', href: '/dashboard/school-admin/attendance', icon: <ClipboardList size={20} /> },
  { label: 'Gate Activity', href: '/dashboard/school-admin/gate-log', icon: <DoorOpen size={20} /> },
  { label: 'Reports', href: '/dashboard/school-admin/reports', icon: <BarChart3 size={20} /> },
  { label: 'Settings', href: '/dashboard/school-admin/settings', icon: <Settings size={20} /> },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-64 bg-white border-r flex flex-col z-20">
      {/* Logo */}
      <div className="p-5 border-b">
        <Link href="/dashboard/school-admin" className="flex items-center gap-3">
          <img src="https://www.image2url.com/r2/default/images/1779230378321-292c7b74-6217-41ff-832a-180a535ea4cb.png" alt="MyEduRide" className="h-8" />
          <div>
            <p className="font-bold text-primary-600 text-sm leading-tight">MyEduRide</p>
            <p className="text-[10px] text-gray-400">Gate Manager</p>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navItems.map(item => {
          const isActive = pathname === item.href ||
            (item.href !== '/dashboard/school-admin' && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-primary-50 text-primary-700 border-l-3 border-primary-600'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <span className={isActive ? 'text-primary-600' : 'text-gray-400'}>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t">
        <p className="text-xs text-gray-400 text-center">MyEduRide v1.0</p>
      </div>
    </aside>
  );
}

