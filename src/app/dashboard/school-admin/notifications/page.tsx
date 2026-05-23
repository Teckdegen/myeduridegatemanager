// @ts-nocheck
'use client';

import { useEffect, useState } from 'react';
import { fetchData } from '@/lib/api';
import NotificationsInbox from '@/components/notifications/NotificationsInbox';

export default function AdminNotificationsPage() {
  const [schoolId, setSchoolId] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData('get_school_admin_data', { role: 'school_admin' })
      .then((d) => setSchoolId(d.school_id || ''))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="p-6 flex justify-center"><div className="animate-pulse text-primary-600">Loading…</div></div>;
  }

  return (
    <div className="p-6 pt-14 md:pt-6 max-w-2xl">
      <div className="card-elevated p-5">
        <NotificationsInbox schoolId={schoolId} />
      </div>
    </div>
  );
}
