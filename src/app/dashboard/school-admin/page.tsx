// @ts-nocheck
'use client';

import { useEffect, useState } from 'react';
import { fetchData } from '@/lib/api';
import { Users, GraduationCap, UserCheck, Clock, TrendingUp, AlertTriangle, Plus, Search } from 'lucide-react';
import Link from 'next/link';

export default function SchoolAdminDashboard() {
  const [stats, setStats] = useState({
    total_students: 0, present_today: 0, absent_today: 0,
    late_today: 0, total_teachers: 0, total_parents: 0,
  });
  const [recentActivity, setRecentActivity] = useState([]);
  const [schoolName, setSchoolName] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      // Get school info
      const schoolData = await fetchData('get_school_admin_data', { role: 'school_admin' });
      if (!schoolData.school) { setLoading(false); return; }
      setSchoolName(schoolData.school.name);

      // Get dashboard stats
      const dashboard = await fetchData('get_school_dashboard', { school_id: schoolData.school_id });
      setStats(dashboard);
      setRecentActivity(dashboard.recent_activity || []);
    } catch (err) {
      console.error('Dashboard load error:', err);
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-primary-600">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-sm text-gray-500">{schoolName}</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/dashboard/school-admin/students/new" className="btn-primary flex items-center gap-2 text-sm">
            <Plus size={16} />
            New Student
          </Link>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard icon={<Users size={22} />} label="Students" value={stats.total_students} color="purple" />
        <StatCard icon={<GraduationCap size={22} />} label="Teachers" value={stats.total_teachers} color="blue" />
        <StatCard icon={<UserCheck size={22} />} label="Parents" value={stats.total_parents} color="orange" />
        <StatCard icon={<TrendingUp size={22} />} label="Present Today" value={stats.present_today} color="green" />
      </div>

      {/* Second row */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="card flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center">
            <UserCheck size={22} className="text-green-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{stats.present_today}</p>
            <p className="text-sm text-gray-500">On Time Today</p>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center">
            <Clock size={22} className="text-amber-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{stats.late_today}</p>
            <p className="text-sm text-gray-500">Late Today</p>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center">
            <AlertTriangle size={22} className="text-red-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{stats.absent_today}</p>
            <p className="text-sm text-gray-500">Absent Today</p>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Recent Gate Activity</h2>
          <Link href="/dashboard/school-admin/attendance" className="text-sm text-primary-600 hover:underline">View All</Link>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b">
              <th className="text-left pb-3 text-xs font-medium text-gray-500 uppercase">Student</th>
              <th className="text-left pb-3 text-xs font-medium text-gray-500 uppercase">Type</th>
              <th className="text-left pb-3 text-xs font-medium text-gray-500 uppercase">Time</th>
              <th className="text-left pb-3 text-xs font-medium text-gray-500 uppercase">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {recentActivity.map((record: any) => (
              <tr key={record.id} className="hover:bg-gray-50">
                <td className="py-3 text-sm font-medium">
                  {record.student?.first_name} {record.student?.last_name}
                </td>
                <td className="py-3">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                    record.type === 'arrival' ? 'bg-blue-50 text-blue-700' : 'bg-orange-50 text-orange-700'
                  }`}>{record.type === 'arrival' ? 'Arrival' : 'Departure'}</span>
                </td>
                <td className="py-3 text-sm text-gray-500">
                  {new Date(record.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </td>
                <td className="py-3">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                    record.status === 'on_time' ? 'bg-green-50 text-green-700' :
                    record.status === 'late' ? 'bg-red-50 text-red-700' : 'bg-gray-50 text-gray-700'
                  }`}>{record.status === 'on_time' ? 'On Time' : record.status === 'late' ? 'Late' : '-'}</span>
                </td>
              </tr>
            ))}
            {recentActivity.length === 0 && (
              <tr><td colSpan={4} className="py-8 text-center text-gray-400">No gate activity yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color }: any) {
  const styles: any = {
    purple: { bg: 'bg-purple-50', icon: 'bg-purple-100 text-purple-600', border: 'border-purple-100' },
    blue: { bg: 'bg-blue-50', icon: 'bg-blue-100 text-blue-600', border: 'border-blue-100' },
    orange: { bg: 'bg-orange-50', icon: 'bg-orange-100 text-orange-600', border: 'border-orange-100' },
    green: { bg: 'bg-green-50', icon: 'bg-green-100 text-green-600', border: 'border-green-100' },
  };
  const s = styles[color];
  return (
    <div className={`rounded-xl p-4 border ${s.bg} ${s.border}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500 mb-1">{label}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
        </div>
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${s.icon}`}>{icon}</div>
      </div>
    </div>
  );
}
