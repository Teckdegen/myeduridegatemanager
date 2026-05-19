import { RoleSwitcher } from '@/components/shared/RoleSwitcher';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      {/* Top bar with role switcher */}
      <div className="fixed top-3 right-3 z-30">
        <RoleSwitcher />
      </div>
      {children}
    </div>
  );
}
