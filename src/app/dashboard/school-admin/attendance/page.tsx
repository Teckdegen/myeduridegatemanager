// @ts-nocheck
'use client';

import { useEffect, useState } from 'react';
import { fetchData } from '@/lib/api';
import AttendanceReportPanel from '@/components/attendance/AttendanceReportPanel';
import { isWithinUiPresentWindow } from '@/lib/attendance/window';

export default function AttendanceReportsPage() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [schoolId, setSchoolId] = useState('');

  useEffect(() => {
    loadRecords();
  }, []);

  const loadRecords = async () => {
    try {
      const schoolData = await fetchData('get_school_admin_data', { role: 'school_admin' });
      if (!schoolData.school_id) {
        setLoading(false);
        return;
      }
      setSchoolId(schoolData.school_id);

      const result = await fetchData('query', {
        table: 'attendance_records',
        select: '*, student:students(first_name, last_name, student_id_number, class:school_classes(name))',
        filters: { school_id: schoolData.school_id },
        order: { column: 'timestamp', ascending: false },
        limit: 100,
      });
      setRecords(result.data || []);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center md:ml-56">
        <div className="animate-pulse text-primary-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="p-6 min-h-screen md:ml-56 pt-14 md:pt-6 max-w-4xl">
      <h1 className="text-2xl font-bold text-slate-900 mb-1">Attendance reports</h1>
      <p className="text-sm text-slate-500 mb-6">All gate scans are stored permanently.</p>

      <div className="card-elevated p-5 mb-6">
        <AttendanceReportPanel schoolId={schoolId} />
      </div>

      <h2 className="text-sm font-semibold text-slate-700 mb-3">Recent scans (stored)</h2>
      <div className="card-elevated p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">When</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Student</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Type</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Live UI</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {records.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50/80">
                <td className="px-4 py-3 whitespace-nowrap">
                  {new Date(r.timestamp).toLocaleString()}
                </td>
                <td className="px-4 py-3 font-medium">
                  {r.student?.first_name} {r.student?.last_name}
                </td>
                <td className="px-4 py-3 capitalize">{r.type}</td>
                <td className="px-4 py-3">
                  {r.type === 'arrival' && isWithinUiPresentWindow(r.timestamp) ? (
                    <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                      Present on dashboard
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400">Archived</span>
                  )}
                </td>
              </tr>
            ))}
            {records.length === 0 && (
              <tr>
                <td colSpan={4} className="py-10 text-center text-slate-400">
                  No attendance records yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
