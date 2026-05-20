'use client';

import { AdminSidebar } from '@/components/shared/AdminSidebar';

export default function SchoolAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <AdminSidebar />
      <main className="flex-1 md:ml-56">
        {children}
      </main>
    </div>
  );
}
