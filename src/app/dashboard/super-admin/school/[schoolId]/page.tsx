// @ts-nocheck
'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Users, GraduationCap, UserCheck, Clock, AlertTriangle, ArrowLeft, TrendingUp } from 'lucide-react';
import Link from 'next/link';

export default function SchoolDetailPage() {
  const params = useParams();
  const schoolId = params.schoolId as string;
  const [school, setSchool] = useState(null);
  const [stats, setStats] = useState({ total_students: 0, total_teachers: 0, total_parents: 0, present_today: 0, late_today: 0, absent_today: 0 });
  const [students, setStudents] = useState([]);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadSchool(); }, [schoolId]);

  const loadSchool = async () => {
    try {
      // Get school info
      const schoolRes = await fetch('/api/schools/list', { cache: 'no-store' });
      const schoolData = await schoolRes.json();
      const found = schoolData.schools?.find((s: any) => s.id === schoolId);
      if (found) setSchool(found);

      // Get dashboard stats for this school
      const statsRes = await fetch('/api/data', {
        method: 'POST', cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_school_dashboard', params: { school_id: schoolId } }),
      });
      const statsData = await statsRes.json();
      if (statsData) setStats(statsData);
      setActivity(statsData.recent_activity || []);

      // Get students
      const studentsRes = await fetch('/api/data', {
        method: 'POST', cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_students', params: { school_id: schoolId } }),
      });
      const studentsData = await studentsRes.json();
      setStudents(studentsData.students || []);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-pulse text-primary-600">Loading school...</div></div>;

  return (
    <div className="p-6 min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <Link href="/dashboard/super-admin" className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-3">
          <ArrowLeft size={16} /> Back to All Schools
        </Link>
        <h1 className="text-2xl font-bold">{(school as any)?.name || 'School'}</h1>
        <p className="text-sm text-gray-500">{(school as any)?.address || ''}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="stat-card">
          <div>
            <p className="text-xs text-gray-500 mb-1">Students</p>
            <p className="text-2xl font-bold">{stats.total_students}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center">
            <Users size={18} className="text-primary-600" />
          </div>
        </div>
        <div className="stat-card">
          <div>
            <p className="text-xs text-gray-500 mb-1">Teachers</p>
            <p className="text-2xl font-bold">{stats.total_teachers}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
            <GraduationCap size={18} className="text-blue-600" />
          </div>
        </div>
        <div className="stat-card">
          <div>
            <p className="text-xs text-gray-500 mb-1">Present Today</p>
            <p className="text-2xl font-bold text-green-600">{stats.present_today}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
            <UserCheck size={18} className="text-green-600" />
          </div>
        </div>
        <div className="stat-card">
          <div>
            <p className="text-xs text-gray-500 mb-1">Late Today</p>
            <p className="text-2xl font-bold text-amber-600">{stats.late_today}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
            <Clock size={18} className="text-amber-600" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Students list */}
        <div className="card">
          <h3 className="font-semibold text-sm mb-4">Students ({students.length})</h3>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {students.slice(0, 20).map((s: any) => (
              <div key={s.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50">
                <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 text-xs font-bold">
                  {s.first_name?.[0]}{s.last_name?.[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{s.first_name} {s.last_name}</p>
                  <p className="text-xs text-gray-400">{s.student_id_number}</p>
                </div>
                <span className="text-xs text-gray-400">{s.class?.name || ''}</span>
              </div>
            ))}
            {students.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No students yet</p>}
          </div>
        </div>

        {/* Recent activity */}
        <div className="card">
          <h3 className="font-semibold text-sm mb-4">Recent Gate Activity</h3>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {activity.slice(0, 15).map((r: any) => (
              <div key={r.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center ${r.type === 'arrival' ? 'bg-green-50' : 'bg-orange-50'}`}>
                  {r.type === 'arrival' ? <UserCheck size={12} className="text-green-600" /> : <ArrowLeft size={12} className="text-orange-600" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{r.student?.first_name} {r.student?.last_name}</p>
                  <p className="text-xs text-gray-400">{r.type === 'arrival' ? 'Arrived' : 'Left'}</p>
                </div>
                <span className="text-xs text-gray-500">{new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            ))}
            {activity.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No activity yet</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
