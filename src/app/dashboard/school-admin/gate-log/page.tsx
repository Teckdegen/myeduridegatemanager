// @ts-nocheck
'use client';

import { useEffect, useState } from 'react';
import { fetchData } from '@/lib/api';
import AttendanceSignLog from '@/components/attendance/AttendanceSignLog';

export default function GateLogPage() {
  const [schoolId, setSchoolId] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const schoolData = await fetchData('get_school_admin_data', { role: 'school_admin' });
        setSchoolId(schoolData.school_id || '');
      } catch (err) {
        console.error(err);
      }
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center md:ml-56">
        <div className="animate-pulse text-primary-600">Loading…</div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen md:ml-56 pt-14 md:pt-6 max-w-2xl">
      <AttendanceSignLog schoolId={schoolId} title="Gate activity" />
    </div>
  );
}
