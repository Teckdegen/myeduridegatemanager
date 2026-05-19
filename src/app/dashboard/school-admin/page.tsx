'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { DashboardStats, AttendanceRecordWithStudent } from '@/lib/types';
import { Users, GraduationCap, UserCheck, Clock, TrendingUp, AlertTriangle, Plus, Search } from 'lucide-react';
import Link from 'next/link';

export default function SchoolAdminDashboard() {
  const [stats, setStats] = useState<DashboardStats & { total_teachers: number; total_parents: number }>({
    total_students: 0,
    present_today: 0,
    absent_today: 0,
    late_today: 0,
    dismissed_today: 0,
    total_teachers: 0,
    total_parents: 0,
  });
  const [recentActivity, setRecentActivity] = useState<AttendanceRecordWithStudent[]>([]);
  const [schoolName, setSchoolName] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboard = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: role } = await supabase
        .from('user_school_roles')
        .select('school_id, school:schools(name)')
        .eq('user_id', user.id)
        .eq('role', 'school_admin')
        .single();

      if (!role) return;
      setSchoolName((role as any).school.name);
      const schoolId = role.school_id;
      const today = new Date().toISOString().split('T')[0];

      // Counts
      const { count: totalStudents } = await supabase
        .from('students')
        .select('*', { count: 'exact', head: true })
        .eq('school_id', schoolId)
        .eq('is_active', true);

      const { count: totalTeachers } = await supabase
        .from('user_school_roles')
        .select('*', { count: 'exact', head: true })
        .eq('school_id', schoolId)
        .eq('role', 'teacher')
        .eq('is_active', true);

      const { count: totalParents } = await supabase
        .from('user_school_roles')
        .select('*', { count: 'exact', head: true })
        .eq('school_id', schoolId)
        .eq('role', 'parent')
        .eq('is_active', true);

      // Today's attendance
      const { data: todayAttendance } = await supabase
        .from('attendance_records')
        .select('student_id, status')
        .eq('school_id', schoolId)
        .eq('type', 'arrival')
        .gte('timestamp', `${today}T00:00:00`)
        .lte('timestamp', `${today}T23:59:59`);

      const presentToday = todayAttendance?.length || 0;
      const lateToday = todayAttendance?.filter(a => a.status === 'late').length || 0;

      // Recent activity
      const { data: recent } = await supabase
        .from('attendance_records')
        .select('*, student:students(first_name, last_name, class_name, photo_url, student_id_number)')
        .eq('school_id', schoolId)
        .order('timestamp', { ascending: false })
        .limit(10);

      setStats({
        total_students: totalStudents || 0,
        present_today: presentToday,
        absent_today: (totalStudents || 0) - presentToday,
        late_today: lateToday,
        dismissed_today: 0,
        total_teachers: totalTeachers || 0,
        total_parents: totalParents || 0,
      });

      if (recent) setRecentActivity(recent as any);
      setLoading(false);
    };

    fetchDashboard();
  }, []);

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
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Search..."
              className="pl-9 pr-4 py-2 border rounded-lg text-sm w-64 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
            />
          </div>
          <Link href="/dashboard/school-admin/students/new" className="btn-primary flex items-center gap-2 text-sm">
            <Plus size={16} />
            New Student
          </Link>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard
          icon={<Users size={22} />}
          label="Students"
          value={stats.total_students.toLocaleString()}
          color="purple"
        />
        <StatCard
          icon={<GraduationCap size={22} />}
          label="Teachers"
          value={stats.total_teachers.toLocaleString()}
          color="blue"
        />
        <StatCard
          icon={<UserCheck size={22} />}
          label="Parents"
          value={stats.total_parents.toLocaleString()}
          color="orange"
        />
        <StatCard
          icon={<TrendingUp size={22} />}
          label="Present Today"
          value={stats.present_today.toLocaleString()}
          color="green"
        />
      </div>

      {/* Second row stats */}
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
          <Link href="/dashboard/school-admin/attendance" className="text-sm text-primary-600 hover:underline">
            View All
          </Link>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b">
              <th className="text-left pb-3 text-xs font-medium text-gray-500 uppercase">Student</th>
              <th className="text-left pb-3 text-xs font-medium text-gray-500 uppercase">ID</th>
              <th className="text-left pb-3 text-xs font-medium text-gray-500 uppercase">Class</th>
              <th className="text-left pb-3 text-xs font-medium text-gray-500 uppercase">Type</th>
              <th className="text-left pb-3 text-xs font-medium text-gray-500 uppercase">Time</th>
              <th className="text-left pb-3 text-xs font-medium text-gray-500 uppercase">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {recentActivity.map(record => (
              <tr key={record.id} className="hover:bg-gray-50">
                <td className="py-3">
                  <div className="flex items-center gap-2">
                    {record.student?.photo_url ? (
                      <img src={record.student.photo_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 text-xs font-bold">
                        {record.student?.first_name?.[0]}{record.student?.last_name?.[0]}
                      </div>
                    )}
                    <span className="text-sm font-medium">{record.student?.first_name} {record.student?.last_name}</span>
                  </div>
                </td>
                <td className="py-3 text-sm text-gray-500 font-mono">{record.student?.student_id_number}</td>
                <td className="py-3 text-sm text-gray-500">{record.student?.class_name}</td>
                <td className="py-3">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                    record.type === 'arrival' ? 'bg-blue-50 text-blue-700' : 'bg-orange-50 text-orange-700'
                  }`}>
                    {record.type === 'arrival' ? 'Arrival' : 'Departure'}
                  </span>
                </td>
                <td className="py-3 text-sm text-gray-500">
                  {new Date(record.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </td>
                <td className="py-3">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                    record.status === 'on_time' ? 'bg-green-50 text-green-700' :
                    record.status === 'late' ? 'bg-red-50 text-red-700' : 'bg-gray-50 text-gray-700'
                  }`}>
                    {record.status === 'on_time' ? 'On Time' : record.status === 'late' ? 'Late' : '-'}
                  </span>
                </td>
              </tr>
            ))}
            {recentActivity.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-gray-400">No gate activity yet today</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: 'purple' | 'blue' | 'orange' | 'green';
}) {
  const styles = {
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
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${s.icon}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}
