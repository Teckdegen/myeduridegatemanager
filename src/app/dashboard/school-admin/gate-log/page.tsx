// @ts-nocheck
'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { AttendanceRecordWithStudent } from '@/lib/types';
import { DoorOpen, Clock, CheckCircle, AlertTriangle, LogOut as LogOutIcon, Camera, ScanBarcode, UserCheck } from 'lucide-react';

export default function GateLogPage() {
  const [records, setRecords] = useState<AttendanceRecordWithStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSessions, setActiveSessions] = useState(0);

  useEffect(() => {
    fetchGateLog();
    const interval = setInterval(fetchGateLog, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const fetchGateLog = async () => {
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

    const today = new Date().toISOString().split('T')[0];

    // Get today's gate activity
    const { data } = await supabase
      .from('attendance_records')
      .select('*, student:students(first_name, last_name, class_name, photo_url, student_id_number)')
      .eq('school_id', role.school_id)
      .gte('timestamp', `${today}T00:00:00`)
      .order('timestamp', { ascending: false })
      .limit(50);

    // Get active sessions
    const { count } = await supabase
      .from('gate_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('school_id', role.school_id)
      .eq('status', 'active');

    if (data) setRecords(data as any);
    setActiveSessions(count || 0);
    setLoading(false);
  };

  const getMethodIcon = (method: string) => {
    switch (method) {
      case 'face_recognition': return <Camera size={14} className="text-purple-600" />;
      case 'id_card_scan': return <ScanBarcode size={14} className="text-blue-600" />;
      default: return <UserCheck size={14} className="text-gray-600" />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-primary-600">Loading gate log...</div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gate Activity</h1>
          <p className="text-sm text-gray-500">Live feed of today's gate events</p>
        </div>
        <div className="flex items-center gap-2">
          {activeSessions > 0 ? (
            <span className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-50 text-green-700 text-sm font-medium">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              {activeSessions} Active Session{activeSessions > 1 ? 's' : ''}
            </span>
          ) : (
            <span className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-100 text-gray-500 text-sm font-medium">
              <span className="w-2 h-2 rounded-full bg-gray-400" />
              No Active Sessions
            </span>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="card flex items-center gap-3 py-4">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
            <DoorOpen size={18} className="text-blue-600" />
          </div>
          <div>
            <p className="text-xl font-bold">{records.length}</p>
            <p className="text-xs text-gray-500">Total Events</p>
          </div>
        </div>
        <div className="card flex items-center gap-3 py-4">
          <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center">
            <CheckCircle size={18} className="text-green-600" />
          </div>
          <div>
            <p className="text-xl font-bold">{records.filter(r => r.type === 'arrival').length}</p>
            <p className="text-xs text-gray-500">Arrivals</p>
          </div>
        </div>
        <div className="card flex items-center gap-3 py-4">
          <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center">
            <LogOutIcon size={18} className="text-orange-600" />
          </div>
          <div>
            <p className="text-xl font-bold">{records.filter(r => r.type === 'departure').length}</p>
            <p className="text-xs text-gray-500">Departures</p>
          </div>
        </div>
        <div className="card flex items-center gap-3 py-4">
          <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
            <AlertTriangle size={18} className="text-amber-600" />
          </div>
          <div>
            <p className="text-xl font-bold">{records.filter(r => r.status === 'late').length}</p>
            <p className="text-xs text-gray-500">Late</p>
          </div>
        </div>
      </div>

      {/* Live feed */}
      <div className="card p-0 overflow-hidden">
        <div className="px-4 py-3 border-b bg-gray-50 flex items-center gap-2">
          <Clock size={14} className="text-gray-400" />
          <span className="text-sm font-medium text-gray-600">Today's Gate Log</span>
        </div>
        <div className="divide-y max-h-[600px] overflow-y-auto">
          {records.map(record => (
            <div key={record.id} className="px-4 py-3 flex items-center gap-4 hover:bg-gray-50">
              {/* Time */}
              <div className="w-16 text-right shrink-0">
                <p className="text-sm font-mono font-medium text-gray-700">
                  {new Date(record.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>

              {/* Type indicator */}
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                record.type === 'arrival' ? 'bg-green-50' : 'bg-orange-50'
              }`}>
                {record.type === 'arrival' ? (
                  <CheckCircle size={14} className="text-green-600" />
                ) : (
                  <LogOutIcon size={14} className="text-orange-600" />
                )}
              </div>

              {/* Student */}
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {record.student?.photo_url ? (
                  <img src={record.student.photo_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 text-xs font-bold">
                    {record.student?.first_name?.[0]}{record.student?.last_name?.[0]}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{record.student?.first_name} {record.student?.last_name}</p>
                  <p className="text-xs text-gray-400">{record.student?.class_name}</p>
                </div>
              </div>

              {/* Method */}
              <div className="flex items-center gap-1.5 shrink-0">
                {getMethodIcon(record.verification_method)}
                <span className="text-xs text-gray-400 capitalize">
                  {record.verification_method === 'face_recognition' ? 'Face' :
                   record.verification_method === 'id_card_scan' ? 'ID Card' : 'Manual'}
                </span>
              </div>

              {/* Status */}
              {record.status === 'late' && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-medium shrink-0">
                  Late
                </span>
              )}
            </div>
          ))}

          {records.length === 0 && (
            <div className="py-12 text-center">
              <DoorOpen size={32} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-400">No gate activity today yet</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

