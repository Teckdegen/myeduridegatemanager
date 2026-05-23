// @ts-nocheck
'use client';

import { useEffect, useState } from 'react';
import { fetchData } from '@/lib/api';
import { UserCheck } from 'lucide-react';
import StaffIdScanPanel from '@/components/gate/StaffIdScanPanel';
import AttendanceSignLog from '@/components/attendance/AttendanceSignLog';

export default function StaffAttendancePage() {
  const [schoolId, setSchoolId] = useState('');
  const [mode, setMode] = useState('arrival');
  const [loading, setLoading] = useState(true);
  const [logKey, setLogKey] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const data = await fetchData('get_school_admin_data', { role: 'school_admin' });
        setSchoolId(data.school_id || '');
      } catch {
        /* ignore */
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
    <div className="p-6 min-h-screen md:ml-56 pt-14 md:pt-6 max-w-lg">
      <div className="flex items-center gap-3 mb-2">
        <UserCheck className="text-primary-600" size={26} />
        <h1 className="text-2xl font-bold">Staff attendance</h1>
      </div>
      <p className="text-sm text-slate-500 mb-4">
        ID card scan only — same as gate. Monthly reports use these scan records (gate manager or admin scanning here).
      </p>

      <div className="pill-tabs mb-4">
        <button
          type="button"
          onClick={() => setMode('arrival')}
          className={mode === 'arrival' ? 'pill-tab-active' : 'pill-tab-inactive'}
        >
          Sign in
        </button>
        <button
          type="button"
          onClick={() => setMode('departure')}
          className={mode === 'departure' ? 'pill-tab-active' : 'pill-tab-inactive'}
        >
          Sign out
        </button>
      </div>

      <StaffIdScanPanel
        schoolId={schoolId}
        mode={mode}
        onSuccess={() => setLogKey((k) => k + 1)}
      />

      <div className="mt-8" key={logKey}>
        <AttendanceSignLog
          schoolId={schoolId}
          title="Staff sign-in / out log"
          defaultEntity="staff"
        />
      </div>
    </div>
  );
}
