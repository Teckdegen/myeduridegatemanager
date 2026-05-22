// @ts-nocheck
'use client';

import { useEffect, useState } from 'react';
import { fetchData } from '@/lib/api';
import DetailedAttendanceReports from '@/components/attendance/DetailedAttendanceReports';
import { formatDateTimeLagos } from '@/lib/timezone';
import { isWithinUiPresentWindow } from '@/lib/attendance/window';

export default function AttendanceReportsPage() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [schoolId, setSchoolId] = useState('');
  const [classes, setClasses] = useState([]);

  useEffect(() => { loadRecords(); }, []);

  const loadRecords = async () => {
    try {
      const schoolData = await fetchData('get_school_admin_data', { role: 'school_admin' });
      if (!schoolData.school_id) { setLoading(false); return; }
      setSchoolId(schoolData.school_id);

      const [result, classesRes] = await Promise.all([
        fetchData('query', {
          table: 'attendance_records',
          select: '*, student:students(first_name, last_name, student_id_number, class:school_classes(name))',
          filters: { school_id: schoolData.school_id },
          order: { column: 'timestamp', ascending: false },
          limit: 50,
        }),
        fetch(`/api/classes?school_id=${schoolData.school_id}`, { credentials: 'include' }),
      ]);
      setRecords(result.data || []);
      const cj = await classesRes.json();
      setClasses(cj.classes || []);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center md:ml-56"><div className="animate-pulse text-primary-600">Loading...</div></div>;
  }

  return (
    <div className="p-6 min-h-screen md:ml-56 pt-14 md:pt-6 max-w-5xl">
      <h1 className="text-2xl font-bold text-slate-900 mb-1">Attendance</h1>
      <p className="text-sm text-slate-500 mb-6">Detailed reports and recent gate scans (WAT timezone).</p>

      <div className="card-elevated p-5 mb-6">
        <DetailedAttendanceReports schoolId={schoolId} classes={classes} />
      </div>

      <h2 className="text-sm font-semibold text-slate-700 mb-3">Recent scans</h2>
      <div className="card-elevated p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">When (WAT)</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Student</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Type</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {records.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50/80">
                <td className="px-4 py-3 whitespace-nowrap">{formatDateTimeLagos(r.timestamp)}</td>
                <td className="px-4 py-3 font-medium">{r.student?.first_name} {r.student?.last_name}</td>
                <td className="px-4 py-3 capitalize">{r.type}</td>
                <td className="px-4 py-3">
                  {r.type === 'departure' ? (
                    <span className="text-xs font-semibold text-orange-700">Released</span>
                  ) : r.status === 'late' ? (
                    <span className="text-xs font-semibold text-amber-700">Late{r.minutes_late ? ` (${r.minutes_late}m)` : ''}</span>
                  ) : r.type === 'arrival' && isWithinUiPresentWindow(r.timestamp) ? (
                    <span className="text-xs font-semibold text-emerald-700">Present</span>
                  ) : (
                    <span className="text-xs text-slate-500 capitalize">{r.status || '—'}</span>
                  )}
                </td>
              </tr>
            ))}
            {records.length === 0 && (
              <tr><td colSpan={4} className="py-10 text-center text-slate-400">No attendance records yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
