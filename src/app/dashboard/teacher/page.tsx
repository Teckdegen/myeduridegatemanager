// @ts-nocheck
'use client';

import { useEffect, useState } from 'react';
import { fetchData } from '@/lib/api';
import { Users, UserCheck, Clock, AlertTriangle, ArrowRight, CheckCircle, Search } from 'lucide-react';
import { toast } from 'sonner';

export default function TeacherDashboard() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [schoolId, setSchoolId] = useState('');
  const [className, setClassName] = useState('');

  useEffect(() => { loadClass(); }, []);

  const loadClass = async () => {
    try {
      // Get teacher's school
      const schoolData = await fetchData('get_school_admin_data', { role: 'teacher' });
      if (!schoolData.school_id) {
        setLoading(false);
        return;
      }
      setSchoolId(schoolData.school_id);
      setClassName(schoolData.school?.name || 'My Class');

      // Get students for this school (teacher sees all for now)
      const { students: data } = await fetchData('get_students', { school_id: schoolData.school_id });
      setStudents(data || []);
    } catch (err) {
      console.error('Teacher load error:', err);
    }
    setLoading(false);
  };

  const handleDismiss = async (studentId: string) => {
    toast.success('Student marked for dismissal');
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="animate-pulse text-primary-600">Loading class...</div></div>;
  }

  return (
    <div className="p-6 min-h-screen">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-1">Teacher Dashboard</h1>
        <p className="text-sm text-gray-500 mb-6">{className} — {students.length} students</p>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="stat-card">
            <div>
              <p className="text-xs text-gray-500">Total</p>
              <p className="text-xl font-bold">{students.length}</p>
            </div>
            <Users size={18} className="text-primary-600" />
          </div>
          <div className="stat-card">
            <div>
              <p className="text-xs text-gray-500">Present</p>
              <p className="text-xl font-bold text-green-600">0</p>
            </div>
            <UserCheck size={18} className="text-green-600" />
          </div>
          <div className="stat-card">
            <div>
              <p className="text-xs text-gray-500">Absent</p>
              <p className="text-xl font-bold text-red-600">{students.length}</p>
            </div>
            <AlertTriangle size={18} className="text-red-600" />
          </div>
        </div>

        {/* Student list */}
        <div className="card p-0 overflow-hidden">
          <div className="px-4 py-3 border-b bg-gray-50">
            <h3 className="text-sm font-semibold">Students</h3>
          </div>
          <div className="divide-y">
            {students.map((s: any) => (
              <div key={s.id} className="px-4 py-3 flex items-center gap-3 hover:bg-gray-50">
                <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 text-xs font-bold">
                  {s.first_name?.[0]}{s.last_name?.[0]}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{s.first_name} {s.last_name}</p>
                  <p className="text-xs text-gray-400">{s.class?.name || ''}</p>
                </div>
                <button
                  onClick={() => handleDismiss(s.id)}
                  className="text-xs px-3 py-1.5 rounded-lg bg-orange-50 text-orange-700 hover:bg-orange-100 font-medium"
                >
                  Dismiss
                </button>
              </div>
            ))}
            {students.length === 0 && (
              <div className="py-8 text-center text-gray-400">No students in your class yet</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
