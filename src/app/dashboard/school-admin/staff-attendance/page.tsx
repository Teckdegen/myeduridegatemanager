// @ts-nocheck
'use client';

import { useEffect, useState } from 'react';
import { fetchData } from '@/lib/api';
import { ScanLine } from 'lucide-react';
import StudentIdScanPanel from '@/components/gate/StudentIdScanPanel';
import StaffIdScanPanel from '@/components/gate/StaffIdScanPanel';
import AttendanceSignLog from '@/components/attendance/AttendanceSignLog';

export default function StudentStaffScanPage() {
  const [schoolId, setSchoolId] = useState('');
  const [scanKind, setScanKind] = useState('student');
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
        <ScanLine className="text-primary-600" size={26} />
        <h1 className="text-2xl font-bold">Student &amp; staff scan</h1>
      </div>
      <p className="text-sm text-slate-500 mb-4">
        School admin can scan here on behalf of the gate manager. Same ID-card rules as the gate app — records appear in daily, weekly, and monthly reports.
      </p>

      <div className="pill-tabs mb-3">
        <button
          type="button"
          onClick={() => setScanKind('student')}
          className={scanKind === 'student' ? 'pill-tab-active' : 'pill-tab-inactive'}
        >
          Student scan
        </button>
        <button
          type="button"
          onClick={() => setScanKind('staff')}
          className={scanKind === 'staff' ? 'pill-tab-active' : 'pill-tab-inactive'}
        >
          Staff scan
        </button>
      </div>

      <div className="pill-tabs mb-4">
        <button
          type="button"
          onClick={() => setMode('arrival')}
          className={mode === 'arrival' ? 'pill-tab-active' : 'pill-tab-inactive'}
        >
          {scanKind === 'student' ? 'Check in' : 'Sign in'}
        </button>
        <button
          type="button"
          onClick={() => setMode('departure')}
          className={mode === 'departure' ? 'pill-tab-active' : 'pill-tab-inactive'}
        >
          {scanKind === 'student' ? 'Check out' : 'Sign out'}
        </button>
      </div>

      {scanKind === 'student' ? (
        <StudentIdScanPanel
          schoolId={schoolId}
          mode={mode}
          onModeChange={setMode}
          onSuccess={() => setLogKey((k) => k + 1)}
        />
      ) : (
        <StaffIdScanPanel
          schoolId={schoolId}
          mode={mode}
          onModeChange={setMode}
          onSuccess={() => setLogKey((k) => k + 1)}
        />
      )}

      <div className="mt-8" key={logKey}>
        <AttendanceSignLog schoolId={schoolId} title="Today&apos;s scan log" />
      </div>
    </div>
  );
}
