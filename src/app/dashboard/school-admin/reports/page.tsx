// @ts-nocheck
'use client';

import { useEffect, useState } from 'react';
import { fetchData } from '@/lib/api';
import { BarChart3, Download, Users, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';

export default function ReportsPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, present: 0, late: 0, absent: 0 });

  useEffect(() => { loadReports(); }, []);

  const loadReports = async () => {
    try {
      const schoolData = await fetchData('get_school_admin_data', { role: 'school_admin' });
      if (!schoolData.school_id) { setLoading(false); return; }

      const dashboard = await fetchData('get_school_dashboard', { school_id: schoolData.school_id });
      setStats({
        total: dashboard.total_students,
        present: dashboard.present_today,
        late: dashboard.late_today,
        absent: dashboard.absent_today,
      });
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-pulse text-primary-600">Loading...</div></div>;

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Reports</h1>
          <p className="text-sm text-gray-500">School performance overview</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="card text-center py-5">
          <p className="text-2xl font-bold">{stats.total}</p>
          <p className="text-xs text-gray-500">Total Students</p>
        </div>
        <div className="card text-center py-5">
          <p className="text-2xl font-bold text-green-600">{stats.present}</p>
          <p className="text-xs text-gray-500">Present Today</p>
        </div>
        <div className="card text-center py-5">
          <p className="text-2xl font-bold text-amber-600">{stats.late}</p>
          <p className="text-xs text-gray-500">Late Today</p>
        </div>
        <div className="card text-center py-5">
          <p className="text-2xl font-bold text-red-600">{stats.absent}</p>
          <p className="text-xs text-gray-500">Absent Today</p>
        </div>
      </div>

      <div className="card text-center py-12">
        <BarChart3 size={40} className="mx-auto text-gray-300 mb-3" />
        <p className="text-gray-500">Detailed charts will populate as attendance data accumulates</p>
      </div>
    </div>
  );
}
