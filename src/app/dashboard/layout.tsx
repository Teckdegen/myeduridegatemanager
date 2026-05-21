'use client';

import { usePathname } from 'next/navigation';
import { RoleSwitcher } from '@/components/shared/RoleSwitcher';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideTopSwitcher = pathname?.startsWith('/dashboard/parent');

  return (
    <div className="min-h-screen">
      {!hideTopSwitcher && (
        <div className="fixed top-3 right-3 z-30">
          <RoleSwitcher />
        </div>
      )}
      {children}
    </div>
  );
}
