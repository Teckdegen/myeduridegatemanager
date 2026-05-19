'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Building2, BarChart3, Settings, Users, CreditCard } from 'lucide-react';

const navItems = [
  { label: 'Dashboard', href: '/dashboard/super-admin', icon: <LayoutDashboard size={20} /> },
  { label: 'Schools', href: '/dashboard/super-admin/schools', icon: <Building2 size={20} /> },
  { label: 'Students', href: '/dashboard/super-admin/students', icon: <Users size={20} /> },
  { label: 'ID Cards', href: '/dashboard/super-admin/id-cards', icon: <CreditCard size={20} /> },
  { label: 'Analytics', href: '/dashboard/super-admin/analytics', icon: <BarChart3 size={20} /> },
  { label: 'Settings', href: '/dashboard/super-admin/settings', icon: <Settings size={20} /> },
];

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 bottom-0 w-64 bg-gray-900 flex flex-col z-20">
        <div className="p-5 border-b border-gray-800">
          <Link href="/dashboard/super-admin" className="flex items-center gap-3">
            <img src="/logo.png" alt="MyEduRide" className="h-8" />
            <div>
              <p className="font-bold text-white text-sm leading-tight">MyEduRide</p>
              <p className="text-[10px] text-gray-500">Super Admin</p>
            </div>
          </Link>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {navItems.map(item => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-primary-600 text-white'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }`}
              >
                {item.icon}
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <main className="flex-1 ml-64">
        {children}
      </main>
    </div>
  );
}
