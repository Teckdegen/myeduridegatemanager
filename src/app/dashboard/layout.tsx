'use client';

import { usePathname } from 'next/navigation';
import { RoleSwitcher } from '@/components/shared/RoleSwitcher';
import { logout } from '@/lib/api';
import { LogOut } from 'lucide-react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isSchoolAdmin = pathname?.startsWith('/dashboard/school-admin');
  const isParent = pathname?.startsWith('/dashboard/parent');

  return (
    <div className="min-h-screen bg-transparent">
      <div className="fixed top-3 right-3 z-30 flex items-center gap-1">
        <RoleSwitcher showLogout={false} />
        {!isSchoolAdmin && !isParent && (
          <button
            type="button"
            onClick={logout}
            className="p-2 rounded-full bg-white border shadow-sm text-gray-500 hover:text-red-600 hover:border-red-100"
            title="Sign out"
            aria-label="Sign out"
          >
            <LogOut size={18} />
          </button>
        )}
      </div>
      {children}
    </div>
  );
}
