'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Student, GateSession, School } from '@/lib/types';
import { FaceScanner } from '@/components/gate/FaceScanner';
import { IdCardScanner } from '@/components/gate/IdCardScanner';
import { StudentVerificationCard } from '@/components/gate/StudentVerificationCard';
import { StaffVerificationCard } from '@/components/gate/StaffVerificationCard';
import { Camera, ScanBarcode, LogIn, LogOut, StopCircle, Clock, Shield, Users, GraduationCap } from 'lucide-react';

type VerificationMode = 'face' | 'barcode';
type GateMode = 'arrival' | 'dismissal';
type ScanTarget = 'student' | 'staff';

interface MatchedStaff {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  photo_url: string | null;
  staff_id_number: string | null;
  role: string;
}

export default function GateOfficerDashboard() {
  const [gateMode, setGateMode] = useState<GateMode>('arrival');
  const [scanTarget, setScanTarget] = useState<ScanTarget>('student');
  const [verificationMode, setVerificationMode] = useState<VerificationMode | null>(null);
  const [matchedStudent, setMatchedStudent] = useState<Student | null>(null);
  const [matchedStaff, setMatchedStaff] = useState<MatchedStaff | null>(null);
  const [dismissalApproved, setDismissalApproved] = useState(false);
  const [dismissalTeacher, setDismissalTeacher] = useState('');
  const [session, setSession] = useState<GateSession | null>(null);
  const [school, setSchool] = useState<School | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [todayCount, setTodayCount] = useState(0);

  // Live clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleStartSession = async () => {
    setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: role } = await supabase
      .from('user_school_roles')
      .select('school_id, school:schools(*)')
      .eq('user_id', user.id)
      .eq('role', 'gate_officer')
      .single();

    if (!role) return;
    setSchool((role as any).school);

    const { data: newSession } = await supabase
      .from('gate_sessions')
      .insert({
        school_id: role.school_id,
        gate_officer_user_id: user.id,
        mode: gateMode,
        status: 'active',
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    setSession(newSession);
    setLoading(false);
  };

  const handleEndSession = async () => {
    if (!session) return;
    if (!confirm('End this gate session?')) return;

    const supabase = createClient();
    await supabase
      .from('gate_sessions')
      .update({ status: 'closed', ended_at: new Date().toISOString() })
      .eq('id', session.id);

    setSession(null);
    setVerificationMode(null);
    setMatchedStudent(null);
    setTodayCount(0);
  };

  const handleStudentMatched = async (student: Student) => {
    setMatchedStudent(student);

    // If dismissal mode, check if teacher has approved
    if (gateMode === 'dismissal') {
      const supabase = createClient();
      const today = new Date().toISOString().split('T')[0];

      const { data: dismissal } = await supabase
        .from('dismissal_requests')
        .select('*, requested_by:user_profiles!requested_by_user_id(full_name)')
        .eq('student_id', student.id)
        .eq('status', 'approved')
        .gte('created_at', `${today}T00:00:00`)
        .single();

      if (dismissal) {
        setDismissalApproved(true);
        setDismissalTeacher((dismissal as any).requested_by?.full_name || 'Teacher');
      } else {
        setDismissalApproved(false);
        setDismissalTeacher('');
      }
    }
  };

  const handleAccept = async () => {
    if (!matchedStudent || !session) return;
    setLoading(true);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const now = new Date();

    // Log attendance
    const { data: record } = await supabase
      .from('attendance_records')
      .insert({
        student_id: matchedStudent.id,
        school_id: session.school_id,
        gate_session_id: session.id,
        type: gateMode === 'arrival' ? 'arrival' : 'departure',
        verification_method: verificationMode === 'face' ? 'face_recognition' : 'id_card_scan',
        verified_by_user_id: user.id,
        status: gateMode === 'arrival' ? getArrivalStatus(now, school) : 'on_time',
        timestamp: now.toISOString(),
      })
      .select()
      .single();

    // If dismissal, mark dismissal request as completed
    if (gateMode === 'dismissal' && dismissalApproved) {
      const today = new Date().toISOString().split('T')[0];
      await supabase
        .from('dismissal_requests')
        .update({ status: 'completed', completed_at: now.toISOString() })
        .eq('student_id', matchedStudent.id)
        .eq('status', 'approved')
        .gte('created_at', `${today}T00:00:00`);
    }

    // Trigger notification to parent
    if (record) {
      await fetch('/api/notifications/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: matchedStudent.id,
          attendance_record_id: record.id,
          type: gateMode === 'arrival' ? 'arrival' : 'departure',
        }),
      });
    }

    setTodayCount(prev => prev + 1);
    setMatchedStudent(null);
    setVerificationMode(null);
    setDismissalApproved(false);
    setDismissalTeacher('');
    setLoading(false);
  };

  const handleReject = () => {
    setMatchedStudent(null);
    setMatchedStaff(null);
    setVerificationMode(null);
    setDismissalApproved(false);
    setDismissalTeacher('');
  };

  // Staff accept handler
  const handleStaffAccept = async () => {
    if (!matchedStaff || !session) return;
    setLoading(true);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const now = new Date();

    await supabase.from('staff_attendance').insert({
      user_id: matchedStaff.user_id,
      school_id: session.school_id,
      gate_session_id: session.id,
      type: gateMode === 'arrival' ? 'clock_in' : 'clock_out',
      verification_method: verificationMode === 'face' ? 'face_recognition' : 'id_card_scan',
      verified_by_user_id: user.id,
      timestamp: now.toISOString(),
    });

    setTodayCount(prev => prev + 1);
    setMatchedStaff(null);
    setVerificationMode(null);
    setLoading(false);
  };

  // Handle staff matched from scanner
  const handleStaffMatched = (staff: MatchedStaff) => {
    setMatchedStaff(staff);
  };

  // No active session — show session start screen
  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 px-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-primary-600 flex items-center justify-center mx-auto mb-4">
              <Shield size={32} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">Gate Manager</h1>
            <p className="text-gray-400 mt-1 font-mono text-lg">
              {currentTime.toLocaleTimeString()}
            </p>
            <p className="text-gray-500 text-sm">
              {currentTime.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>

          <div className="bg-gray-800 rounded-2xl p-6 space-y-5">
            <p className="text-sm text-gray-400 font-medium">Select Gate Mode</p>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setGateMode('arrival')}
                className={`p-5 rounded-xl border-2 transition-all ${
                  gateMode === 'arrival'
                    ? 'border-green-500 bg-green-500/10'
                    : 'border-gray-700 hover:border-gray-600'
                }`}
              >
                <LogIn className={`mx-auto mb-2 ${gateMode === 'arrival' ? 'text-green-400' : 'text-gray-500'}`} size={28} />
                <span className={`block font-medium ${gateMode === 'arrival' ? 'text-green-400' : 'text-gray-400'}`}>
                  Arrival
                </span>
              </button>
              <button
                onClick={() => setGateMode('dismissal')}
                className={`p-5 rounded-xl border-2 transition-all ${
                  gateMode === 'dismissal'
                    ? 'border-orange-500 bg-orange-500/10'
                    : 'border-gray-700 hover:border-gray-600'
                }`}
              >
                <LogOut className={`mx-auto mb-2 ${gateMode === 'dismissal' ? 'text-orange-400' : 'text-gray-500'}`} size={28} />
                <span className={`block font-medium ${gateMode === 'dismissal' ? 'text-orange-400' : 'text-gray-400'}`}>
                  Dismissal
                </span>
              </button>
            </div>

            <button
              onClick={handleStartSession}
              disabled={loading}
              className="w-full py-4 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-semibold text-lg transition-colors disabled:opacity-50"
            >
              {loading ? 'Starting...' : 'Start Gate Session'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Active session
  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      {/* Header */}
      <header className="bg-gray-800 px-5 py-4 flex items-center justify-between border-b border-gray-700">
        <div className="flex items-center gap-4">
          <div className={`w-3 h-3 rounded-full animate-pulse ${gateMode === 'arrival' ? 'bg-green-500' : 'bg-orange-500'}`} />
          <div>
            <p className="text-sm text-gray-400">
              {gateMode === 'arrival' ? 'Arrival Mode' : 'Dismissal Mode'}
            </p>
            <p className="text-xl font-mono font-bold">{currentTime.toLocaleTimeString()}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-sm text-gray-400">Processed</p>
            <p className="text-lg font-bold">{todayCount}</p>
          </div>
          <button
            onClick={handleEndSession}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-medium transition-colors"
          >
            <StopCircle size={18} />
            End Session
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 p-5 max-w-2xl mx-auto w-full">
        {/* Student matched — show verification card */}
        {matchedStudent ? (
          <StudentVerificationCard
            student={matchedStudent}
            gateMode={gateMode}
            dismissalApproved={dismissalApproved}
            dismissalTeacher={dismissalTeacher}
            onAccept={handleAccept}
            onReject={handleReject}
            loading={loading}
          />
        ) : matchedStaff ? (
          <StaffVerificationCard
            staff={matchedStaff}
            gateMode={gateMode}
            onAccept={handleStaffAccept}
            onReject={handleReject}
            loading={loading}
          />
        ) : (
          <>
            {/* Student / Staff toggle */}
            <div className="flex gap-2 mt-4 mb-6 bg-gray-800 p-1 rounded-xl">
              <button
                onClick={() => setScanTarget('student')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  scanTarget === 'student' ? 'bg-gray-700 text-white' : 'text-gray-500'
                }`}
              >
                <Users size={16} />
                Student
              </button>
              <button
                onClick={() => setScanTarget('staff')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  scanTarget === 'staff' ? 'bg-gray-700 text-white' : 'text-gray-500'
                }`}
              >
                <GraduationCap size={16} />
                Staff
              </button>
            </div>

            {/* Mode selection */}
            {!verificationMode ? (
              <div className="space-y-4">
                <p className="text-center text-gray-400 text-sm mb-4">
                  Choose how to verify the {scanTarget}
                </p>
                <button
                  onClick={() => setVerificationMode('face')}
                  className="w-full p-6 rounded-2xl bg-gray-800 border border-gray-700 hover:border-primary-500 transition-all flex items-center gap-5"
                >
                  <div className="w-14 h-14 rounded-xl bg-primary-600/20 flex items-center justify-center">
                    <Camera size={28} className="text-primary-400" />
                  </div>
                  <div className="text-left">
                    <span className="text-lg font-semibold">Face Recognition</span>
                    <p className="text-sm text-gray-400 mt-0.5">Scan {scanTarget} face with camera</p>
                  </div>
                </button>
                <button
                  onClick={() => setVerificationMode('barcode')}
                  className="w-full p-6 rounded-2xl bg-gray-800 border border-gray-700 hover:border-primary-500 transition-all flex items-center gap-5"
                >
                  <div className="w-14 h-14 rounded-xl bg-accent-500/20 flex items-center justify-center">
                    <ScanBarcode size={28} className="text-accent-400" />
                  </div>
                  <div className="text-left">
                    <span className="text-lg font-semibold">Scan ID Card</span>
                    <p className="text-sm text-gray-400 mt-0.5">Scan barcode on {scanTarget} ID card</p>
                  </div>
                </button>
              </div>
            ) : verificationMode === 'face' ? (
              <FaceScanner
                onStudentMatched={scanTarget === 'student' ? handleStudentMatched : undefined}
                onStaffMatched={scanTarget === 'staff' ? handleStaffMatched : undefined}
                scanTarget={scanTarget}
                onCancel={() => setVerificationMode(null)}
              />
            ) : (
              <IdCardScanner
                onStudentMatched={handleStudentMatched}
                onCancel={() => setVerificationMode(null)}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}

function getArrivalStatus(now: Date, school: School | null): 'on_time' | 'late' {
  if (!school?.late_threshold) return 'on_time';

  const [hours, minutes] = school.late_threshold.split(':').map(Number);
  const threshold = new Date(now);
  threshold.setHours(hours, minutes, 0, 0);

  return now > threshold ? 'late' : 'on_time';
}
