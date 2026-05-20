'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSession } from '@/lib/api';

interface Props {
  requiredRole: string;
  children: React.ReactNode;
}

export function RouteGuard({ requiredRole, children }: Props) {
  const [authorized, setAuthorized] = useState(false);
  const [checking, setChecking] = useState(true);
  const router = useRouter();

  useEffect(() => {
    checkAccess();
  }, []);

  const checkAccess = async () => {
    const session = getSession();
    if (!session?.user_id) {
      router.replace('/auth/login');
      return;
    }

    try {
      const res = await fetch('/api/data', {
        method: 'POST', cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'query', params: { table: 'user_school_roles', select: 'role', filters: { user_id: session.user_id, is_active: true } } }),
      });
      const data = await res.json();
      const roles = data.data?.map((r: any) => r.role) || [];

      if (roles.includes(requiredRole)) {
        setAuthorized(true);
      } else if (roles.length > 0) {
        // Redirect to first available role
        const roleToPath: Record<string, string> = {
          super_admin: '/dashboard/super-admin',
          school_admin: '/dashboard/school-admin',
          teacher: '/dashboard/teacher',
          gate_officer: '/dashboard/gate',
          parent: '/dashboard/parent',
        };
        router.replace(roleToPath[roles[0]] || '/dashboard');
      } else {
        router.replace('/auth/login');
      }
    } catch {
      // If API fails, allow access (don't lock users out)
      setAuthorized(true);
    }
    setChecking(false);
  };

  if (checking) {
    return <div className="min-h-screen flex items-center justify-center"><div className="animate-pulse text-primary-600">Checking access...</div></div>;
  }

  if (!authorized) return null;

  return <>{children}</>;
}
