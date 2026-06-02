'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getSession } from '@/lib/api';
import { ChangePasswordCard } from '@/components/shared/ChangePasswordCard';

export default function ChangePasswordPage() {
  const router = useRouter();

  useEffect(() => {
    if (!getSession()?.user_id) {
      router.replace('/auth/login');
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        <h1 className="text-xl font-bold text-gray-900 mb-4">Account security</h1>
        <ChangePasswordCard />
      </div>
    </div>
  );
}
