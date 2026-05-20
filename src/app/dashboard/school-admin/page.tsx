// @ts-nocheck
'use client';

import { useEffect, useState } from 'react';
import { fetchData, getSession } from '@/lib/api';
import { Users, GraduationCap, UserCheck, Clock, TrendingUp, AlertTriangle, Plus, Bell } from 'lucide-react';
import Link from 'next/link';

export default function SchoolAdminDashboard() {
  const [stats, setStats] = useState({
    total_students: 0, present_today: 0, absent_today: 0,
    late_today: 0, total_teachers: 0, total_parents: 0,
  });
  const [recentActivity, setRecentActivity] = useState([]);
  const [schoolName, setSchoolName] = useState('');
  const [userName, setUserName] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const session = getSession();
    if (session) setUserName(session.full_name || '');
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const schoolData = await fetchData('get_school_admin_data', { role: 'school_admin' });
      if (!schoolData.school) { setLoading(false); return; }
      setSchoolName(schoolData.school.name);
      const dashboard = await fetchData('get_school_dashboard', { school_id: schoolData.school_id });
      setStats(dashboard);
      setRecentActivity(dashboard.recent_activity || []);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="animate-pulse text-primary-600 font-medium">Loading dashboard...</div></div>;
  }

  return (
    <div className="p-6 min-h-screen">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">{schoolName}</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="p-2.5 rounded-xl bg-white border border-gray-100 shadow-sm hover:shadow-md transition-all">
            <Bell size={18} className="text-gray-500" />
          </button>
          <div className="flex items-center gap-2.5 pl-3 pr-4 py-2 rounded-xl bg-white border border-gray-100 shadow-sm">
            <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 text-xs font-bold">
              {userName.split(' ').map(n => n[0]).join('').slice(0, 2)}
            </div>
            <div>
              <p className="text-xs font-medium text-gray-800">{userName}</p>
              <p className="text-[10px] text-gray-400">Admin</p>
            </div>
          </div>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="stat-card">
          <div>
            <p className="text-xs text-gray-500 mb-1">Students</p>
            <p className="text-2xl font-bold text-gray-900">{formatNumber(stats.total_students)}</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-purple-100 flex items-center justify-center">
            <Users size={20} className="text-purple-600" />
          </div>
        </div>
        <div className="stat-card">
          <div>
            <p className="text-xs text-gray-500 mb-1">Teachers</p>
            <p className="text-2xl font-bold text-gray-900">{formatNumber(stats.total_teachers)}</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-blue-100 flex items-center justify-center">
            <GraduationCap size={20} className="text-blue-600" />
          </div>
        </div>
        <div className="stat-card">
          <div>
            <p className="text-xs text-gray-500 mb-1">Parents</p>
            <p className="text-2xl font-bold text-gray-900">{formatNumber(stats.total_parents)}</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-orange-100 flex items-center justify-center">
            <UserCheck size={20} className="text-orange-600" />
          </div>
        </div>
        <div className="stat-card">
          <div>
            <p className="text-xs text-gray-500 mb-1">Present Today</p>
            <p className="text-2xl font-bold text-gray-900">{formatNumber(stats.present_today)}</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-green-100 flex items-center justify-center">
            <TrendingUp size={20} className="text-green-600" />
          </div>
        </div>
      </div>

      {/* Second row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
        <div className="card flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-green-50 flex items-center justify-center">
            <UserCheck size={22} className="text-green-600" />
          </div>
          <div>
            <p className="text-2xl font-bold">{stats.present_today}</p>
            <p className="text-xs text-gray-500">On Time Today</p>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center">
            <Clock size={22} className="text-amber-600" />
          </div>
          <div>
            <p className="text-2xl font-bold">{stats.late_today}</p>
            <p className="text-xs text-gray-500">Late Today</p>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center">
            <AlertTriangle size={22} className="text-red-600" />
          </div>
          <div>
            <p className="text-2xl font-bold">{stats.absent_today}</p>
            <p className="text-xs text-gray-500">Absent Today</p>
          </div>
        </div>
      </div>

      {/* Quick Actions + Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Quick Actions */}
        <div className="card">
          <h3 className="font-semibold text-sm mb-4">Quick Actions</h3>
          <div className="space-y-2">
            <Link href="/dashboard/school-admin/students/new" className="flex items-center gap-3 p-3 rounded-xl hover:bg-primary-50 transition-all group">
              <div className="w-9 h-9 rounded-lg bg-primary-100 flex items-center justify-center group-hover:bg-primary-200 transition-all">
                <Plus size={16} className="text-primary-600" />
              </div>
              <span className="text-sm font-medium text-gray-700">Add Student</span>
            </Link>
            <Link href="/dashboard/school-admin/staff" className="flex items-center gap-3 p-3 rounded-xl hover:bg-blue-50 transition-all group">
              <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center group-hover:bg-blue-200 transition-all">
                <GraduationCap size={16} className="text-blue-600" />
              </div>
              <span className="text-sm font-medium text-gray-700">Add Staff</span>
            </Link>
            <Link href="/dashboard/school-admin/setup" className="flex items-center gap-3 p-3 rounded-xl hover:bg-orange-50 transition-all group">
              <div className="w-9 h-9 rounded-lg bg-orange-100 flex items-center justify-center group-hover:bg-orange-200 transition-all">
                <School size={16} className="text-orange-600" />
              </div>
              <span className="text-sm font-medium text-gray-700">School Setup</span>
            </Link>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="card lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm">Recent Gate Activity</h3>
            <Link href="/dashboard/school-admin/gate-log" className="text-xs text-primary-600 hover:underline">View All</Link>
          </div>
          <div className="space-y-3">
            {recentActivity.slice(0, 5).map((record: any) => (
              <div key={record.id} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600">
                  {record.student?.first_name?.[0]}{record.student?.last_name?.[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{record.student?.first_name} {record.student?.last_name}</p>
                  <p className="text-xs text-gray-400">{record.type === 'arrival' ? 'Arrived' : 'Left'}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">{new Date(record.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                    record.status === 'on_time' ? 'bg-green-50 text-green-700' : record.status === 'late' ? 'bg-red-50 text-red-700' : 'bg-gray-50 text-gray-500'
                  }`}>{record.status === 'on_time' ? 'On Time' : record.status === 'late' ? 'Late' : ''}</span>
                </div>
              </div>
            ))}
            {recentActivity.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-6">No gate activity yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function formatNumber(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(n >= 10000 ? 1 : 2) + 'K';
  return n.toString();
}
