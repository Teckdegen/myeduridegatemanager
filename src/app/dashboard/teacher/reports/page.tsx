// @ts-nocheck
'use client';

import { useEffect, useState } from 'react';
import { fetchData } from '@/lib/api';
import AttendanceReportPanel from '@/components/attendance/AttendanceReportPanel';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function TeacherReportsPage() {
  const [schoolId, setSchoolId] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const data = await fetchData('get_teacher_dashboard');
      setSchoolId(data.school_id || '');
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <div className="page-shell flex items-center justify-center min-h-[50vh]">
        <div className="animate-pulse text-primary-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="page-shell max-w-lg mx-auto">
      <Link href="/dashboard/teacher" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 mb-4">
        <ArrowLeft size={16} /> Back to class
      </Link>
      <h1 className="text-2xl font-bold text-slate-900 mb-1">Attendance reports</h1>
      <p className="text-sm text-slate-500 mb-6">Download CSV for your class — every day, all years.</p>
      <div className="card-elevated p-5">
        <AttendanceReportPanel schoolId={schoolId} />
      </div>
    </div>
  );
}
