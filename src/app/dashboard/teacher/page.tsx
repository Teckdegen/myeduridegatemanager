// @ts-nocheck
'use client';

import { useEffect, useState } from 'react';
import { fetchData } from '@/lib/api';
import StudentAvatar from '@/components/shared/StudentAvatar';
import { PageHeader } from '@/components/ui/PageHeader';
import { Users, UserCheck, AlertTriangle, ArrowRight, GraduationCap } from 'lucide-react';
import { toast } from 'sonner';

export default function TeacherDashboard() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [schoolId, setSchoolId] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [dismissing, setDismissing] = useState(null);

  useEffect(() => {
    loadClass();
  }, []);

  const loadClass = async () => {
    try {
      const schoolData = await fetchData('get_school_admin_data', { role: 'teacher' });
      if (!schoolData.school_id) {
        setLoading(false);
        return;
      }
      setSchoolId(schoolData.school_id);
      setSchoolName(schoolData.school?.name || '');
      const { students: data } = await fetchData('get_students', { school_id: schoolData.school_id });
      setStudents(data || []);
    } catch (err) {
      console.error(err);
      toast.error('Could not load class');
    }
    setLoading(false);
  };

  const handleDismiss = async (studentId, studentName) => {
    setDismissing(studentId);
    try {
      const res = await fetch('/api/notifications/dismissal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: studentId, school_id: schoolId, teacher_name: 'Teacher' }),
      });
      if (!res.ok) throw new Error('Failed');
      toast.success(`${studentName} dismissed — parent notified`);
    } catch {
      toast.error('Failed to dismiss');
    }
    setDismissing(null);
  };

  if (loading) {
    return (
      <div className="page-shell flex items-center justify-center min-h-[60vh]">
        <div className="animate-pulse text-primary-600 font-medium">Loading class...</div>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <div className="hero-banner">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center">
            <GraduationCap size={24} />
          </div>
          <div>
            <p className="text-white/70 text-xs font-medium uppercase tracking-wide">Teacher</p>
            <h1 className="text-xl font-bold">{schoolName || 'My class'}</h1>
            <p className="text-white/80 text-sm">{students.length} students</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="dash-stat">
          <div>
            <p className="text-[11px] font-medium text-slate-500 uppercase">Total</p>
            <p className="text-2xl font-bold text-slate-900">{students.length}</p>
          </div>
          <Users size={20} className="text-primary-600" />
        </div>
        <div className="dash-stat">
          <div>
            <p className="text-[11px] font-medium text-slate-500 uppercase">Present</p>
            <p className="text-2xl font-bold text-emerald-600">0</p>
          </div>
          <UserCheck size={20} className="text-emerald-500" />
        </div>
        <div className="dash-stat">
          <div>
            <p className="text-[11px] font-medium text-slate-500 uppercase">Absent</p>
            <p className="text-2xl font-bold text-red-500">{students.length}</p>
          </div>
          <AlertTriangle size={20} className="text-red-400" />
        </div>
      </div>

      <PageHeader
        title="Students"
        subtitle="Tap Dismiss to notify the parent for pickup"
      />

      <div className="card-elevated divide-y divide-slate-100">
        {students.map((s) => (
          <div key={s.id} className="list-row">
            <StudentAvatar
              photoUrl={s.photo_url}
              firstName={s.first_name}
              lastName={s.last_name}
              size="sm"
            />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-slate-900 truncate">
                {s.first_name} {s.last_name}
              </p>
              <p className="text-xs text-slate-500">{s.class?.name || 'No class'}</p>
              {!s.photo_url && (
                <p className="text-[10px] text-amber-600 mt-0.5">Photo missing — ask admin to re-enroll with camera</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => handleDismiss(s.id, `${s.first_name} ${s.last_name}`)}
              disabled={dismissing === s.id}
              className="shrink-0 text-xs px-4 py-2 rounded-xl bg-orange-500 text-white font-semibold hover:bg-orange-600 flex items-center gap-1.5 disabled:opacity-50 shadow-sm"
            >
              <ArrowRight size={14} />
              {dismissing === s.id ? 'Sending…' : 'Dismiss'}
            </button>
          </div>
        ))}
        {students.length === 0 && (
          <div className="py-12 text-center text-slate-400 text-sm">No students in your class yet</div>
        )}
      </div>

      <div className="alert-info mt-5">
        When you dismiss a student, their parent gets a notification. The student must still scan their QR at the gate before leaving.
      </div>
    </div>
  );
}
