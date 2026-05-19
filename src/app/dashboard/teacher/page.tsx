'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Student, AttendanceRecord, SchoolClass } from '@/lib/types';
import {
  CheckCircle, Clock, Search, Users, UserCheck, AlertTriangle,
  ArrowRight, ScanBarcode, Camera, Bell, FileText, Eye, Filter
} from 'lucide-react';
import { toast } from 'sonner';

interface StudentWithAttendance extends Student {
  todayAttendance: AttendanceRecord | null;
  dismissalStatus: 'none' | 'approved' | 'completed' | 'extra_lesson';
  gatePhoto: string | null;
}

type TabView = 'attendance' | 'dismissal' | 'history';

export default function TeacherDashboard() {
  const [students, setStudents] = useState<StudentWithAttendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<TabView>('attendance');
  const [className, setClassName] = useState('');
  const [grade, setGrade] = useState('');
  const [schoolId, setSchoolId] = useState('');
  const [teacherUserId, setTeacherUserId] = useState('');
  const [gateWindowClosed, setGateWindowClosed] = useState(false);
  const [showScanModal, setShowScanModal] = useState(false);
  const [dismissNoteModal, setDismissNoteModal] = useState<string | null>(null);
  const [dismissNote, setDismissNote] = useState('');
  const [extraLessonTime, setExtraLessonTime] = useState('');
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    fetchClassStudents();
  }, []);

  const fetchClassStudents = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setTeacherUserId(user.id);

    // Get teacher's assigned class via teacher_profiles + teacher_class_assignments
    const { data: teacherProfile } = await supabase
      .from('teacher_profiles')
      .select('id, school_id')
      .eq('user_id', user.id)
      .single();

    if (!teacherProfile) { setLoading(false); return; }
    setSchoolId(teacherProfile.school_id);

    // Get class assignment
    const { data: assignment } = await supabase
      .from('teacher_class_assignments')
      .select('class_id, class:school_classes(id, name, grade)')
      .eq('teacher_profile_id', teacherProfile.id)
      .limit(1)
      .single();

    if (!assignment) { setLoading(false); return; }
    setClassName((assignment as any).class.name);
    setGrade((assignment as any).class.grade);

    const classId = assignment.class_id;

    // Get students in this class
    const { data: classStudents } = await supabase
      .from('students')
      .select('*')
      .eq('school_id', teacherProfile.school_id)
      .eq('class_id', classId)
      .eq('is_active', true)
      .order('last_name');

    if (!classStudents) { setLoading(false); return; }

    // Get today's attendance
    const today = new Date().toISOString().split('T')[0];
    const studentIds = classStudents.map(s => s.id);

    const { data: attendance } = await supabase
      .from('attendance_records')
      .select('*')
      .in('student_id', studentIds)
      .eq('type', 'arrival')
      .gte('timestamp', `${today}T00:00:00`)
      .lte('timestamp', `${today}T23:59:59`);

    // Get today's dismissal requests
    const { data: dismissals } = await supabase
      .from('dismissal_requests')
      .select('*')
      .in('student_id', studentIds)
      .gte('created_at', `${today}T00:00:00`);

    // Check if gate window is closed (after school's gate_close_time)
    const { data: school } = await supabase
      .from('schools')
      .select('gate_close_time')
      .eq('id', teacherProfile.school_id)
      .single();

    if (school?.gate_close_time) {
      const [h, m] = school.gate_close_time.split(':').map(Number);
      const now = new Date();
      const closeTime = new Date();
      closeTime.setHours(h, m, 0, 0);
      setGateWindowClosed(now > closeTime);
    }

    const studentsWithData: StudentWithAttendance[] = classStudents.map(student => {
      const dismissal = dismissals?.find(d => d.student_id === student.id);
      let dismissalStatus: 'none' | 'approved' | 'completed' | 'extra_lesson' = 'none';
      if (dismissal) {
        if (dismissal.extra_lesson_until) dismissalStatus = 'extra_lesson';
        else if (dismissal.status === 'completed') dismissalStatus = 'completed';
        else if (dismissal.status === 'approved') dismissalStatus = 'approved';
      }

      return {
        ...student,
        todayAttendance: attendance?.find(a => a.student_id === student.id) || null,
        dismissalStatus,
        gatePhoto: null, // Would come from attendance record photo if stored
      };
    });

    setStudents(studentsWithData);
    setLoading(false);
  };

  // Mark student present manually (teacher scan)
  const handleMarkPresent = async (studentId: string, method: 'teacher_manual' | 'id_card_scan') => {
    setProcessing(studentId);
    const supabase = createClient();

    const { error } = await supabase.from('attendance_records').insert({
      student_id: studentId,
      school_id: schoolId,
      type: 'arrival',
      verification_method: method,
      verified_by_user_id: teacherUserId,
      status: 'late',
      source: 'teacher',
      timestamp: new Date().toISOString(),
      notes: 'Marked present by teacher in classroom',
    });

    if (error) {
      toast.error('Failed to mark present');
    } else {
      const student = students.find(s => s.id === studentId);
      toast.success(`${student?.first_name} marked present`);

      // Notify parent
      await fetch('/api/notifications/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: studentId,
          attendance_record_id: 'teacher-manual',
          type: 'arrival',
        }),
      });

      fetchClassStudents();
    }
    setProcessing(null);
  };

  // Mark student absent
  const handleMarkAbsent = async (studentId: string) => {
    setProcessing(studentId);
    const supabase = createClient();

    await supabase.from('attendance_records').insert({
      student_id: studentId,
      school_id: schoolId,
      type: 'arrival',
      verification_method: 'teacher_manual',
      verified_by_user_id: teacherUserId,
      status: 'absent',
      source: 'teacher',
      timestamp: new Date().toISOString(),
      notes: 'Marked absent by teacher',
    });

    const student = students.find(s => s.id === studentId);

    // Notify parent of absence
    await fetch('/api/notifications/absence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ student_id: studentId, school_id: schoolId }),
    });

    toast.success(`${student?.first_name} marked absent — parent notified`);
    fetchClassStudents();
    setProcessing(null);
  };

  // Dismiss student (ready for pickup)
  const handleDismiss = async (studentId: string, note?: string) => {
    setProcessing(studentId);
    const supabase = createClient();

    const { error } = await supabase.from('dismissal_requests').insert({
      student_id: studentId,
      school_id: schoolId,
      requested_by_user_id: teacherUserId,
      status: 'approved',
      approved_at: new Date().toISOString(),
      notes: note || null,
      extra_lesson_until: null,
    });

    if (!error) {
      const student = students.find(s => s.id === studentId);
      toast.success(`${student?.first_name} marked ready for pickup`);

      // Notify parent
      await fetch('/api/notifications/dismissal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: studentId,
          school_id: schoolId,
          teacher_name: teacherUserId,
        }),
      });

      fetchClassStudents();
    }
    setProcessing(null);
    setDismissNoteModal(null);
    setDismissNote('');
  };

  // Mark student for extra lesson
  const handleExtraLesson = async (studentId: string) => {
    if (!extraLessonTime) { toast.error('Set lesson end time'); return; }
    setProcessing(studentId);
    const supabase = createClient();

    await supabase.from('dismissal_requests').insert({
      student_id: studentId,
      school_id: schoolId,
      requested_by_user_id: teacherUserId,
      status: 'pending',
      notes: `Extra lesson until ${extraLessonTime}`,
      extra_lesson_until: extraLessonTime,
    });

    toast.success('Student marked for extra lesson');
    fetchClassStudents();
    setProcessing(null);
    setExtraLessonTime('');
  };

  // Bulk dismiss all present students (except extra lesson)
  const handleBulkDismiss = async () => {
    const toDismiss = students.filter(s =>
      s.todayAttendance && s.dismissalStatus === 'none'
    );

    if (toDismiss.length === 0) { toast.error('No students to dismiss'); return; }
    if (!confirm(`Mark ${toDismiss.length} students as ready for pickup?`)) return;

    for (const student of toDismiss) {
      await handleDismiss(student.id);
    }
  };

  const filteredStudents = students.filter(s =>
    `${s.first_name} ${s.last_name}`.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const presentCount = students.filter(s => s.todayAttendance && s.todayAttendance.status !== 'absent').length;
  const absentCount = students.filter(s => !s.todayAttendance || s.todayAttendance.status === 'absent').length;
  const lateCount = students.filter(s => s.todayAttendance?.status === 'late').length;
  const notCheckedIn = students.filter(s => !s.todayAttendance);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-primary-600">Loading class...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b px-6 py-5">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-900">{className}</h1>
          <p className="text-sm text-gray-500">{grade} — {students.length} students</p>
        </div>
      </header>

      <main className="p-6 max-w-5xl mx-auto">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          <div className="card flex items-center gap-3 py-4">
            <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center">
              <Users size={18} className="text-primary-600" />
            </div>
            <div>
              <p className="text-xl font-bold">{students.length}</p>
              <p className="text-xs text-gray-500">Total</p>
            </div>
          </div>
          <div className="card flex items-center gap-3 py-4">
            <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center">
              <UserCheck size={18} className="text-green-600" />
            </div>
            <div>
              <p className="text-xl font-bold text-green-600">{presentCount}</p>
              <p className="text-xs text-gray-500">Present</p>
            </div>
          </div>
          <div className="card flex items-center gap-3 py-4">
            <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
              <AlertTriangle size={18} className="text-red-600" />
            </div>
            <div>
              <p className="text-xl font-bold text-red-600">{absentCount}</p>
              <p className="text-xs text-gray-500">Absent / No Check-in</p>
            </div>
          </div>
          <div className="card flex items-center gap-3 py-4">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
              <Clock size={18} className="text-amber-600" />
            </div>
            <div>
              <p className="text-xl font-bold text-amber-600">{lateCount}</p>
              <p className="text-xs text-gray-500">Late</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-4">
          <button
            onClick={() => setActiveTab('attendance')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'attendance' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'
            }`}
          >
            <UserCheck size={16} />
            Attendance
            {notCheckedIn.length > 0 && (
              <span className="text-xs bg-red-500 text-white px-1.5 py-0.5 rounded-full">{notCheckedIn.length}</span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('dismissal')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'dismissal' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'
            }`}
          >
            <ArrowRight size={16} />
            Dismissal
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search students..."
            className="input pl-10"
          />
        </div>

        {/* ATTENDANCE TAB */}
        {activeTab === 'attendance' && (
          <div>
            {/* Gate window notice */}
            {gateWindowClosed && notCheckedIn.length > 0 && (
              <div className="mb-4 p-4 rounded-xl bg-amber-50 border border-amber-100 flex items-start gap-3">
                <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-800">Gate window closed</p>
                  <p className="text-xs text-amber-700 mt-0.5">
                    {notCheckedIn.length} students were not checked in at the gate. You can mark them present manually or mark as absent.
                  </p>
                </div>
              </div>
            )}

            <div className="card p-0 overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Student</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Gate Check-in</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredStudents.map(student => (
                    <tr key={student.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {student.photo_url ? (
                            <img src={student.photo_url} alt="" className="w-9 h-9 rounded-full object-cover" />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 text-xs font-bold">
                              {student.first_name[0]}{student.last_name[0]}
                            </div>
                          )}
                          <div>
                            <p className="text-sm font-medium">{student.first_name} {student.last_name}</p>
                            <p className="text-xs text-gray-400">{student.student_id_number}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {student.todayAttendance ? (
                          <span className="text-sm text-gray-600">
                            {new Date(student.todayAttendance.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            {student.todayAttendance.source === 'teacher' && (
                              <span className="ml-1 text-xs text-blue-600">(manual)</span>
                            )}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-400">No check-in</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {student.todayAttendance ? (
                          <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium ${
                            student.todayAttendance.status === 'late' ? 'bg-amber-50 text-amber-700' :
                            student.todayAttendance.status === 'absent' ? 'bg-red-50 text-red-700' :
                            'bg-green-50 text-green-700'
                          }`}>
                            {student.todayAttendance.status === 'late' && <><Clock size={12} /> Late</>}
                            {student.todayAttendance.status === 'on_time' && <><CheckCircle size={12} /> Present</>}
                            {student.todayAttendance.status === 'absent' && <><AlertTriangle size={12} /> Absent</>}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-500 font-medium">
                            <Clock size={12} /> Pending
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {!student.todayAttendance && gateWindowClosed && (
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleMarkPresent(student.id, 'teacher_manual')}
                              disabled={processing === student.id}
                              className="text-xs px-2.5 py-1.5 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 font-medium"
                            >
                              Mark Present
                            </button>
                            <button
                              onClick={() => handleMarkAbsent(student.id)}
                              disabled={processing === student.id}
                              className="text-xs px-2.5 py-1.5 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 font-medium"
                            >
                              Absent
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* DISMISSAL TAB */}
        {activeTab === 'dismissal' && (
          <div>
            {/* Bulk dismiss button */}
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-gray-500">
                Mark students as ready for pickup. Gate officer must still verify at the gate.
              </p>
              <button
                onClick={handleBulkDismiss}
                className="btn-primary text-sm flex items-center gap-2"
              >
                <ArrowRight size={14} />
                Dismiss All Present
              </button>
            </div>

            <div className="card p-0 overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Student</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Attendance</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Dismissal Status</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredStudents.filter(s => s.todayAttendance && s.todayAttendance.status !== 'absent').map(student => (
                    <tr key={student.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {student.photo_url ? (
                            <img src={student.photo_url} alt="" className="w-9 h-9 rounded-full object-cover" />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 text-xs font-bold">
                              {student.first_name[0]}{student.last_name[0]}
                            </div>
                          )}
                          <p className="text-sm font-medium">{student.first_name} {student.last_name}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-green-600">
                          {new Date(student.todayAttendance!.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {student.dismissalStatus === 'none' && (
                          <span className="text-xs text-gray-400">Not dismissed</span>
                        )}
                        {student.dismissalStatus === 'approved' && (
                          <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-green-50 text-green-700 font-medium">
                            <CheckCircle size={12} /> Ready for Pickup
                          </span>
                        )}
                        {student.dismissalStatus === 'completed' && (
                          <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-500 font-medium">
                            Released
                          </span>
                        )}
                        {student.dismissalStatus === 'extra_lesson' && (
                          <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-purple-50 text-purple-700 font-medium">
                            <Clock size={12} /> Extra Lesson
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {student.dismissalStatus === 'none' && (
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => setDismissNoteModal(student.id)}
                              disabled={processing === student.id}
                              className="text-xs px-2.5 py-1.5 rounded-lg bg-orange-50 text-orange-700 hover:bg-orange-100 font-medium"
                            >
                              Dismiss
                            </button>
                            <button
                              onClick={() => {
                                const time = prompt('Extra lesson ends at (HH:MM):', '16:00');
                                if (time) { setExtraLessonTime(time); handleExtraLesson(student.id); }
                              }}
                              className="text-xs px-2.5 py-1.5 rounded-lg bg-purple-50 text-purple-700 hover:bg-purple-100 font-medium"
                            >
                              Extra Lesson
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Dismiss with note modal */}
      {dismissNoteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-sm p-6">
            <h3 className="font-bold mb-3">Dismiss Student</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Note (optional)</label>
                <textarea
                  value={dismissNote}
                  onChange={(e) => setDismissNote(e.target.value)}
                  className="input text-sm"
                  rows={2}
                  placeholder="e.g. Parent requested early pickup"
                />
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setDismissNoteModal(null); setDismissNote(''); }} className="flex-1 px-3 py-2 border rounded-lg text-sm">
                  Cancel
                </button>
                <button
                  onClick={() => handleDismiss(dismissNoteModal, dismissNote)}
                  className="flex-1 px-3 py-2 rounded-lg bg-orange-600 text-white text-sm font-medium"
                >
                  Confirm Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
