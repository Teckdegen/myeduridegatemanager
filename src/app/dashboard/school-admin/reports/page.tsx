// @ts-nocheck
'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { BarChart3, Download, Calendar, TrendingUp, Users, Clock, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface WeeklyData {
  day: string;
  present: number;
  late: number;
  absent: number;
}

interface ClassReport {
  class_name: string;
  total: number;
  avg_attendance: number;
  avg_late: number;
}

export default function ReportsPage() {
  const [weeklyData, setWeeklyData] = useState<WeeklyData[]>([]);
  const [classReports, setClassReports] = useState<ClassReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalStudents, setTotalStudents] = useState(0);
  const [avgAttendance, setAvgAttendance] = useState(0);
  const [schoolId, setSchoolId] = useState('');

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
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

    // Get total students
    const { count } = await supabase
      .from('students')
      .select('*', { count: 'exact', head: true })
      .eq('school_id', role.school_id)
      .eq('is_active', true);

    setTotalStudents(count || 0);

    // Get last 7 days attendance
    const days: WeeklyData[] = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const dayName = date.toLocaleDateString(undefined, { weekday: 'short' });

      const { data: dayAttendance } = await supabase
        .from('attendance_records')
        .select('student_id, status')
        .eq('school_id', role.school_id)
        .eq('type', 'arrival')
        .gte('timestamp', `${dateStr}T00:00:00`)
        .lte('timestamp', `${dateStr}T23:59:59`);

      const present = dayAttendance?.length || 0;
      const late = dayAttendance?.filter(a => a.status === 'late').length || 0;

      days.push({
        day: dayName,
        present: present - late,
        late,
        absent: (count || 0) - present,
      });
    }

    setWeeklyData(days);

    // Calculate average attendance
    const totalPresent = days.reduce((sum, d) => sum + d.present + d.late, 0);
    const totalPossible = days.length * (count || 1);
    setAvgAttendance(Math.round((totalPresent / totalPossible) * 100));

    // Get class-level reports
    const { data: students } = await supabase
      .from('students')
      .select('id, class_name')
      .eq('school_id', role.school_id)
      .eq('is_active', true);

    if (students) {
      const classMap = new Map<string, string[]>();
      for (const s of students) {
        if (!classMap.has(s.class_name)) classMap.set(s.class_name, []);
        classMap.get(s.class_name)!.push(s.id);
      }

      const reports: ClassReport[] = [];
      for (const [className, studentIds] of classMap) {
        const today = new Date().toISOString().split('T')[0];
        const { data: classAttendance } = await supabase
          .from('attendance_records')
          .select('student_id, status')
          .in('student_id', studentIds)
          .eq('type', 'arrival')
          .gte('timestamp', `${today}T00:00:00`);

        const present = classAttendance?.length || 0;
        const late = classAttendance?.filter(a => a.status === 'late').length || 0;

        reports.push({
          class_name: className,
          total: studentIds.length,
          avg_attendance: studentIds.length > 0 ? Math.round((present / studentIds.length) * 100) : 0,
          avg_late: late,
        });
      }

      reports.sort((a, b) => a.class_name.localeCompare(b.class_name));
      setClassReports(reports);
    }

    setLoading(false);
  };

  const handleExportReport = async () => {
    const headers = ['Class', 'Total Students', 'Attendance %', 'Late Today'];
    const rows = classReports.map(r => [r.class_name, r.total, `${r.avg_attendance}%`, r.avg_late]);
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `school_report_${new Date().toISOString().split('T')[0]}.csv`;
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
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
          <p className="text-sm text-gray-500">School performance overview</p>
        </div>
        <button onClick={handleExportReport} className="btn-primary flex items-center gap-2 text-sm">
          <Download size={16} />
          Export Report
        </button>
      </div>

      {/* Overview stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="card flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary-50 flex items-center justify-center">
            <Users size={22} className="text-primary-600" />
          </div>
          <div>
            <p className="text-2xl font-bold">{totalStudents}</p>
            <p className="text-sm text-gray-500">Total Students</p>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center">
            <TrendingUp size={22} className="text-green-600" />
          </div>
          <div>
            <p className="text-2xl font-bold">{avgAttendance}%</p>
            <p className="text-sm text-gray-500">Avg Attendance (7 days)</p>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center">
            <Calendar size={22} className="text-amber-600" />
          </div>
          <div>
            <p className="text-2xl font-bold">7</p>
            <p className="text-sm text-gray-500">Days Tracked</p>
          </div>
        </div>
      </div>

      {/* Weekly chart (simple bar representation) */}
      <div className="card mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Weekly Attendance</h2>
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-green-500" /> Present
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-amber-500" /> Late
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-red-200" /> Absent
            </span>
          </div>
        </div>

        <div className="flex items-end gap-2 h-48">
          {weeklyData.map((day, idx) => {
            const total = totalStudents || 1;
            const presentHeight = (day.present / total) * 100;
            const lateHeight = (day.late / total) * 100;
            const absentHeight = (day.absent / total) * 100;

            return (
              <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex flex-col-reverse gap-0.5 h-40">
                  <div
                    className="w-full bg-green-500 rounded-t"
                    style={{ height: `${presentHeight}%` }}
                  />
                  <div
                    className="w-full bg-amber-500"
                    style={{ height: `${lateHeight}%` }}
                  />
                  <div
                    className="w-full bg-red-200 rounded-b"
                    style={{ height: `${absentHeight}%` }}
                  />
                </div>
                <span className="text-xs text-gray-500">{day.day}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Class breakdown */}
      <div className="card p-0 overflow-hidden">
        <div className="px-4 py-3 border-b bg-gray-50">
          <h2 className="text-sm font-semibold text-gray-700">Attendance by Class (Today)</h2>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b">
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Class</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Students</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Attendance</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Late</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {classReports.map(report => (
              <tr key={report.class_name} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-medium">{report.class_name}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{report.total}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          report.avg_attendance >= 80 ? 'bg-green-500' :
                          report.avg_attendance >= 60 ? 'bg-amber-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${report.avg_attendance}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium">{report.avg_attendance}%</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  {report.avg_late > 0 ? (
                    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
                      <Clock size={10} />
                      {report.avg_late}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400">0</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

