// @ts-nocheck
'use client';

import { useEffect, useState } from 'react';
import { fetchData } from '@/lib/api';
import { Users, UserCheck, AlertTriangle, ArrowRight, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function TeacherDashboard() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [schoolId, setSchoolId] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [dismissing, setDismissing] = useState(null);

  useEffect(() => { loadClass(); }, []);

  const loadClass = async () => {
    try {
      const schoolData = await fetchData('get_school_admin_data', { role: 'teacher' });
      if (!schoolData.school_id) { setLoading(false); return; }
      setSchoolId(schoolData.school_id);
      setSchoolName(schoolData.school?.name || '');
      const { students: data } = await fetchData('get_students', { school_id: schoolData.school_id });
      setStudents(data || []);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const handleDismiss = async (studentId, studentName) => {
    setDismissing(studentId);
    try {
      // Send dismissal notification to parent directly
      await fetch('/api/notifications/dismissal', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: studentId, school_id: schoolId, teacher_name: 'Teacher' }),
      });
      toast.success(`${studentName} dismissed — parent notified`);
    } catch {
      toast.error('Failed to dismiss');
    }
    setDismissing(null);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-pulse text-primary-600">Loading...</div></div>;

  return (
    <div className="p-6 min-h-screen">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-1">Teacher Dashboard</h1>
        <p className="text-sm text-gray-500 mb-6">{schoolName} — {students.length} students</p>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="stat-card"><div><p className="text-xs text-gray-500">Total</p><p className="text-xl font-bold">{students.length}</p></div><Users size={18} className="text-primary-600" /></div>
          <div className="stat-card"><div><p className="text-xs text-gray-500">Present</p><p className="text-xl font-bold text-green-600">0</p></div><UserCheck size={18} className="text-green-600" /></div>
          <div className="stat-card"><div><p className="text-xs text-gray-500">Absent</p><p className="text-xl font-bold text-red-600">{students.length}</p></div><AlertTriangle size={18} className="text-red-600" /></div>
        </div>

        {/* Student list with dismiss */}
        <div className="card p-0 overflow-hidden">
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <span className="text-sm font-semibold">Students</span>
            <span className="text-xs text-gray-400">Click Dismiss to notify parent for pickup</span>
          </div>
          <div className="divide-y">
            {students.map((s) => (
              <div key={s.id} className="px-4 py-3 flex items-center gap-3 hover:bg-gray-50">
                <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 text-xs font-bold">{s.first_name?.[0]}{s.last_name?.[0]}</div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{s.first_name} {s.last_name}</p>
                  <p className="text-xs text-gray-400">{s.class?.name || ''}</p>
                </div>
                <button
                  onClick={() => handleDismiss(s.id, `${s.first_name} ${s.last_name}`)}
                  disabled={dismissing === s.id}
                  className="text-xs px-3 py-1.5 rounded-lg bg-orange-50 text-orange-700 hover:bg-orange-100 font-medium flex items-center gap-1 disabled:opacity-50"
                >
                  <ArrowRight size={12} />
                  {dismissing === s.id ? 'Sending...' : 'Dismiss'}
                </button>
              </div>
            ))}
            {students.length === 0 && <div className="py-8 text-center text-gray-400">No students</div>}
          </div>
        </div>

        <div className="mt-4 p-3 rounded-lg bg-amber-50 border border-amber-100">
          <p className="text-xs text-amber-800">When you dismiss a student, their parent receives a notification. The student must still be scanned at the gate before leaving.</p>
        </div>
      </div>
    </div>
  );
}
