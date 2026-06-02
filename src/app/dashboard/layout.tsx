'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { RoleSwitcher } from '@/components/shared/RoleSwitcher';
import { ChangePasswordCard } from '@/components/shared/ChangePasswordCard';
import { SessionIdleGuard } from '@/components/shared/SessionIdleGuard';
import { logout } from '@/lib/api';
import { KeyRound, LogOut, X } from 'lucide-react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isSchoolAdmin = pathname?.startsWith('/dashboard/school-admin');
  const isParent = pathname?.startsWith('/dashboard/parent');
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="min-h-screen bg-transparent">
      <SessionIdleGuard />
      <div className="fixed top-3 right-3 z-30 flex items-center gap-1">
        <RoleSwitcher showLogout={false} />
        <button
          type="button"
          onClick={() => setShowPassword(true)}
          className="p-2 rounded-full bg-white border shadow-sm text-gray-500 hover:text-primary-700 hover:border-primary-100"
          title="Change password"
          aria-label="Change password"
        >
          <KeyRound size={18} />
        </button>
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

      {showPassword && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 relative">
            <button
              type="button"
              onClick={() => setShowPassword(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
              aria-label="Close"
            >
              <X size={18} />
            </button>
            <ChangePasswordCard />
          </div>
        </div>
      )}

      {children}
    </div>
  );
}
