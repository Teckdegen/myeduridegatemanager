// @ts-nocheck
'use client';

import { useEffect, useState } from 'react';
import { fetchData } from '@/lib/api';
import { Download, Filter, Clock, CheckCircle, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

export default function AttendanceReportsPage() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [schoolId, setSchoolId] = useState('');

  useEffect(() => { loadRecords(); }, []);

  const loadRecords = async () => {
    try {
      const schoolData = await fetchData('get_school_admin_data', { role: 'school_admin' });
      if (!schoolData.school_id) { setLoading(false); return; }
      setSchoolId(schoolData.school_id);

      const result = await fetchData('query', {
        table: 'attendance_records',
        select: '*, student:students(first_name, last_name, student_id_number)',
        filters: { school_id: schoolData.school_id },
        order: { column: 'timestamp', ascending: false },
        limit: 50,
      });
      setRecords(result.data || []);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const handleExport = () => {
    const headers = ['Date', 'Time', 'Student', 'Type', 'Status'];
    const rows = records.map((r: any) => [
      new Date(r.timestamp).toLocaleDateString(),
      new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      `${r.student?.first_name} ${r.student?.last_name}`,
      r.type, r.status || '',
    ]);
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `attendance_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    toast.success('Exported');
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-pulse text-primary-600">Loading...</div></div>;

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Attendance</h1>
          <p className="text-sm text-gray-500">{records.length} records</p>
        </div>
        <button onClick={handleExport} className="btn-primary flex items-center gap-1 text-sm">
          <Download size={16} /> Export CSV
        </button>
      </div>

      <div className="card p-0 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Time</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Student</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Type</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {records.map((r: any) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm">
                  {new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  <span className="text-xs text-gray-400 ml-2">{new Date(r.timestamp).toLocaleDateString()}</span>
                </td>
                <td className="px-4 py-3 text-sm font-medium">{r.student?.first_name} {r.student?.last_name}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${r.type === 'arrival' ? 'bg-blue-50 text-blue-700' : 'bg-orange-50 text-orange-700'}`}>
                    {r.type}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    r.status === 'on_time' ? 'bg-green-50 text-green-700' : r.status === 'late' ? 'bg-red-50 text-red-700' : 'bg-gray-50 text-gray-500'
                  }`}>{r.status || '-'}</span>
                </td>
              </tr>
            ))}
            {records.length === 0 && <tr><td colSpan={4} className="py-8 text-center text-gray-400">No attendance records yet</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
