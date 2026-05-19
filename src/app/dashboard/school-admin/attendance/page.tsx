// @ts-nocheck
'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { AttendanceRecordWithStudent } from '@/lib/types';
import { ArrowLeft, Download, Calendar, Filter } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

export default function AttendanceReportsPage() {
  const [records, setRecords] = useState<AttendanceRecordWithStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0]);
  const [filterType, setFilterType] = useState<'all' | 'arrival' | 'departure'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'on_time' | 'late'>('all');
  const [selectedClass, setSelectedClass] = useState('all');
  const [classes, setClasses] = useState<string[]>([]);
  const [schoolId, setSchoolId] = useState('');

  // Summary stats
  const [stats, setStats] = useState({ total: 0, onTime: 0, late: 0, avgArrival: '' });

  useEffect(() => {
    fetchRecords();
  }, [dateFrom, dateTo]);

  const fetchRecords = async () => {
    setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: role } = await supabase
      .from('user_school_roles')
      .select('school_id')
      .eq('user_id', user.id)
      .eq('role', 'school_admin')
      .single();

    if (!role) return;
    setSchoolId(role.school_id);

    const { data } = await supabase
      .from('attendance_records')
      .select('*, student:students(*)')
      .eq('school_id', role.school_id)
      .gte('timestamp', `${dateFrom}T00:00:00`)
      .lte('timestamp', `${dateTo}T23:59:59`)
      .order('timestamp', { ascending: false });

    if (data) {
      setRecords(data as AttendanceRecordWithStudent[]);

      // Get unique classes
      const uniqueClasses = [...new Set(data.map((r: any) => r.student?.class_name).filter(Boolean))].sort();
      setClasses(uniqueClasses as string[]);

      // Calculate stats
      const arrivals = data.filter((r: any) => r.type === 'arrival');
      const onTime = arrivals.filter((r: any) => r.status === 'on_time').length;
      const late = arrivals.filter((r: any) => r.status === 'late').length;

      setStats({
        total: arrivals.length,
        onTime,
        late,
        avgArrival: calculateAverageTime(arrivals.map((r: any) => r.timestamp)),
      });
    }
    setLoading(false);
  };

  const filteredRecords = records.filter(r => {
    if (filterType !== 'all' && r.type !== filterType) return false;
    if (filterStatus !== 'all' && r.status !== filterStatus) return false;
    if (selectedClass !== 'all' && r.student?.class_name !== selectedClass) return false;
    return true;
  });

  const handleExport = () => {
    const headers = ['Date', 'Time', 'Student Name', 'Student ID', 'Class', 'Type', 'Status', 'Method'];
    const rows = filteredRecords.map(r => [
      new Date(r.timestamp).toLocaleDateString(),
      new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      `${r.student?.first_name} ${r.student?.last_name}`,
      r.student?.student_id_number || '',
      r.student?.class_name || '',
      r.type,
      r.status || '',
      r.verification_method.replace('_', ' '),
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance_${dateFrom}_to_${dateTo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Report exported');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-primary-600">Loading reports...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-4 py-4">
        <Link href="/dashboard/school-admin" className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-2">
          <ArrowLeft size={18} />
          Back to Dashboard
        </Link>
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Attendance Reports</h1>
          <button onClick={handleExport} className="btn-primary flex items-center gap-1 text-sm">
            <Download size={16} />
            Export CSV
          </button>
        </div>
      </header>

      <main className="p-4 max-w-6xl mx-auto">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          <div className="card text-center py-4">
            <p className="text-2xl font-bold text-primary-600">{stats.total}</p>
            <p className="text-xs text-gray-500">Total Arrivals</p>
          </div>
          <div className="card text-center py-4">
            <p className="text-2xl font-bold text-green-600">{stats.onTime}</p>
            <p className="text-xs text-gray-500">On Time</p>
          </div>
          <div className="card text-center py-4">
            <p className="text-2xl font-bold text-red-600">{stats.late}</p>
            <p className="text-xs text-gray-500">Late</p>
          </div>
          <div className="card text-center py-4">
            <p className="text-2xl font-bold text-amber-600">{stats.avgArrival || '--'}</p>
            <p className="text-xs text-gray-500">Avg Arrival</p>
          </div>
        </div>

        {/* Filters */}
        <div className="card mb-4">
          <div className="flex items-center gap-2 mb-3">
            <Filter size={16} className="text-gray-500" />
            <span className="text-sm font-medium">Filters</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">From</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="input text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">To</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="input text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Type</label>
              <select value={filterType} onChange={(e) => setFilterType(e.target.value as any)} className="input text-sm">
                <option value="all">All</option>
                <option value="arrival">Arrivals</option>
                <option value="departure">Departures</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Status</label>
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as any)} className="input text-sm">
                <option value="all">All</option>
                <option value="on_time">On Time</option>
                <option value="late">Late</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Class</label>
              <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} className="input text-sm">
                <option value="all">All Classes</option>
                {classes.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Records table */}
        <div className="card overflow-hidden p-0">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-600">Date & Time</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-600">Student</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-600">Class</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-600">Type</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-600">Status</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-600">Method</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredRecords.slice(0, 100).map(record => (
                <tr key={record.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm">
                    <p>{new Date(record.timestamp).toLocaleDateString()}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(record.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-sm font-medium">
                    {record.student?.first_name} {record.student?.last_name}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{record.student?.class_name}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      record.type === 'arrival' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
                    }`}>
                      {record.type}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      record.status === 'on_time' ? 'bg-green-100 text-green-700' :
                      record.status === 'late' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'
                    }`}>
                      {record.status?.replace('_', ' ') || '-'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 capitalize">
                    {record.verification_method.replace(/_/g, ' ')}
                  </td>
                </tr>
              ))}
              {filteredRecords.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    No records found for this period
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {filteredRecords.length > 100 && (
            <div className="px-4 py-3 bg-gray-50 border-t text-sm text-gray-500 text-center">
              Showing first 100 of {filteredRecords.length} records. Export CSV for full data.
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function calculateAverageTime(timestamps: string[]): string {
  if (timestamps.length === 0) return '';

  const minutes = timestamps.map(t => {
    const d = new Date(t);
    return d.getHours() * 60 + d.getMinutes();
  });

  const avg = Math.round(minutes.reduce((a, b) => a + b, 0) / minutes.length);
  const hours = Math.floor(avg / 60);
  const mins = avg % 60;

  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

