'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Student, AttendanceRecord, School, Notification } from '@/lib/types';
import {
  CheckCircle, Clock, AlertTriangle, LogOut, Bell, Sun, Moon, Sunrise,
  Backpack, Home, UserCheck, ArrowRight, Mail, BellRing, CreditCard, Car
} from 'lucide-react';
import Link from 'next/link';
import { PushNotificationPrompt } from '@/components/shared/PushNotificationPrompt';

interface ChildWithAttendance {
  student: Student;
  school: School;
  todayArrival: AttendanceRecord | null;
  todayDeparture: AttendanceRecord | null;
}

export default function ParentDashboard() {
  const [children, setChildren] = useState<ChildWithAttendance[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'kids' | 'activity'>('kids');

  useEffect(() => {
    fetchChildren();
    fetchNotifications();
  }, []);

  const fetchChildren = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: links } = await supabase
      .from('student_parents')
      .select('student_id')
      .eq('parent_user_id', user.id);

    if (!links || links.length === 0) {
      setLoading(false);
      return;
    }

    const studentIds = links.map(l => l.student_id);

    const { data: students } = await supabase
      .from('students')
      .select('*, school:schools(*)')
      .in('id', studentIds)
      .eq('is_active', true);

    if (!students) {
      setLoading(false);
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    const { data: attendance } = await supabase
      .from('attendance_records')
      .select('*')
      .in('student_id', studentIds)
      .gte('timestamp', `${today}T00:00:00`)
      .lte('timestamp', `${today}T23:59:59`)
      .order('timestamp', { ascending: false });

    const childrenData: ChildWithAttendance[] = students.map((student: any) => ({
      student,
      school: student.school,
      todayArrival: attendance?.find(a => a.student_id === student.id && a.type === 'arrival') || null,
      todayDeparture: attendance?.find(a => a.student_id === student.id && a.type === 'departure') || null,
    }));

    setChildren(childrenData);
    setLoading(false);

    // Subscribe to realtime
    const channel = supabase
      .channel('parent-realtime')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'attendance_records',
        filter: `student_id=in.(${studentIds.join(',')})`,
      }, () => {
        fetchChildren();
        fetchNotifications();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  };

  const fetchNotifications = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);

    if (data) setNotifications(data);
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return { text: 'Good Morning', icon: <Sunrise size={22} className="text-amber-500" /> };
    if (hour < 17) return { text: 'Good Afternoon', icon: <Sun size={22} className="text-orange-500" /> };
    return { text: 'Good Evening', icon: <Moon size={22} className="text-indigo-500" /> };
  };

  const greeting = getGreeting();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-blue-50">
        <div className="text-center">
          <Backpack size={40} className="mx-auto text-primary-600 mb-3 animate-bounce" />
          <p className="text-primary-600 font-medium">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b sticky top-0 z-20 px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            {greeting.icon}
            <div>
              <h1 className="text-lg font-bold text-gray-800">{greeting.text}</h1>
              <p className="text-sm text-gray-500">Here is how your kids are doing today</p>
            </div>
          </div>
          <button className="relative p-2 rounded-full hover:bg-gray-100">
            <Bell size={20} className="text-gray-600" />
            {notifications.filter(n => !n.is_read).length > 0 && (
              <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white" />
            )}
          </button>
        </div>
      </header>

      <main className="p-4 max-w-2xl mx-auto pb-24">
        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('kids')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'kids'
                ? 'bg-white shadow-sm text-gray-900'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Backpack size={16} />
            My Kids
          </button>
          <button
            onClick={() => setActiveTab('activity')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors relative ${
              activeTab === 'activity'
                ? 'bg-white shadow-sm text-gray-900'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <BellRing size={16} />
            Activity
            {notifications.filter(n => !n.is_read).length > 0 && (
              <span className="text-xs bg-red-500 text-white px-1.5 py-0.5 rounded-full">
                {notifications.filter(n => !n.is_read).length}
              </span>
            )}
          </button>
        </div>

        {activeTab === 'kids' ? (
          <>
            {children.length === 0 ? (
              <div className="text-center py-12">
                <Backpack size={48} className="mx-auto text-gray-300 mb-4" />
                <h2 className="text-lg font-semibold text-gray-700">No children linked yet</h2>
                <p className="text-sm text-gray-500 mt-1">Your school will add your children to the system.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {children.map(({ student, school, todayArrival, todayDeparture }) => (
                  <ChildCard
                    key={student.id}
                    student={student}
                    school={school}
                    todayArrival={todayArrival}
                    todayDeparture={todayDeparture}
                  />
                ))}
              </div>
            )}
          </>
        ) : (
          <ActivityFeed notifications={notifications} />
        )}
      </main>

      <PushNotificationPrompt />
    </div>
  );
}

// ============ CHILD CARD ============
function ChildCard({ student, school, todayArrival, todayDeparture }: {
  student: Student;
  school: School;
  todayArrival: AttendanceRecord | null;
  todayDeparture: AttendanceRecord | null;
}) {
  const schoolColor = school.primary_color || '#1B4D3E';
  const isAtSchool = todayArrival && !todayDeparture;
  const hasLeft = todayDeparture !== null;
  const isLate = todayArrival?.status === 'late';

  return (
    <div
      className="rounded-2xl overflow-hidden shadow-sm border border-gray-100 bg-white"
      style={{ borderTopColor: schoolColor, borderTopWidth: '4px' }}
    >
      {/* School header */}
      <div className="px-4 py-2 flex items-center gap-2" style={{ backgroundColor: `${schoolColor}08` }}>
        {school.logo_url ? (
          <img src={school.logo_url} alt={school.name} className="h-4 w-4 object-contain" />
        ) : (
          <div className="w-4 h-4 rounded" style={{ backgroundColor: schoolColor }} />
        )}
        <span className="text-xs font-medium" style={{ color: schoolColor }}>{school.name}</span>
      </div>

      {/* Student info */}
      <div className="p-4">
        <div className="flex items-center gap-4">
          {student.photo_url ? (
            <img
              src={student.photo_url}
              alt={student.first_name}
              className="w-14 h-14 rounded-2xl object-cover shadow-sm"
            />
          ) : (
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center text-white text-lg font-bold shadow-sm"
              style={{ backgroundColor: schoolColor }}
            >
              {student.first_name[0]}{student.last_name[0]}
            </div>
          )}

          <div className="flex-1">
            <h3 className="text-base font-bold text-gray-800">
              {student.first_name} {student.last_name}
            </h3>
            <p className="text-sm text-gray-500">{(student as any).class?.name || ''}</p>
          </div>

          {/* Status icon */}
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            isAtSchool ? 'bg-green-50' : hasLeft ? 'bg-blue-50' : 'bg-gray-50'
          }`}>
            {isAtSchool ? (
              <Backpack size={20} className="text-green-600" />
            ) : hasLeft ? (
              <Home size={20} className="text-blue-600" />
            ) : (
              <Clock size={20} className="text-gray-400" />
            )}
          </div>
        </div>

        {/* Status timeline */}
        <div className="mt-4 space-y-2">
          {/* Arrival */}
          <div className={`flex items-center gap-3 p-3 rounded-xl ${
            todayArrival ? 'bg-green-50' : 'bg-gray-50'
          }`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              todayArrival ? 'bg-green-100' : 'bg-gray-200'
            }`}>
              {todayArrival ? (
                <CheckCircle size={16} className="text-green-600" />
              ) : (
                <Clock size={16} className="text-gray-400" />
              )}
            </div>
            <div className="flex-1">
              <p className={`text-sm font-medium ${todayArrival ? 'text-green-800' : 'text-gray-500'}`}>
                {todayArrival ? 'Arrived at school' : 'Waiting for arrival'}
              </p>
              {todayArrival && (
                <p className="text-xs text-green-600">
                  {new Date(todayArrival.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
            </div>
            {isLate && (
              <span className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-700 flex items-center gap-1">
                <AlertTriangle size={12} />
                Late
              </span>
            )}
          </div>

          {/* Departure */}
          {todayArrival && (
            <div className={`flex items-center gap-3 p-3 rounded-xl ${
              todayDeparture ? 'bg-blue-50' : 'bg-gray-50'
            }`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                todayDeparture ? 'bg-blue-100' : 'bg-gray-200'
              }`}>
                {todayDeparture ? (
                  <LogOut size={16} className="text-blue-600" />
                ) : (
                  <UserCheck size={16} className="text-gray-400" />
                )}
              </div>
              <div className="flex-1">
                <p className={`text-sm font-medium ${todayDeparture ? 'text-blue-800' : 'text-gray-500'}`}>
                  {todayDeparture ? 'Left school' : 'Still at school'}
                </p>
                {todayDeparture && (
                  <p className="text-xs text-blue-600">
                    {new Date(todayDeparture.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============ ACTIVITY FEED ============
function ActivityFeed({ notifications }: { notifications: Notification[] }) {
  if (notifications.length === 0) {
    return (
      <div className="text-center py-12">
        <BellRing size={40} className="mx-auto text-gray-300 mb-3" />
        <p className="text-gray-500">No activity yet today</p>
      </div>
    );
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'arrival': return <CheckCircle size={16} className="text-green-600" />;
      case 'departure': return <LogOut size={16} className="text-blue-600" />;
      case 'late': return <AlertTriangle size={16} className="text-amber-600" />;
      case 'dismissal': return <ArrowRight size={16} className="text-orange-600" />;
      default: return <Bell size={16} className="text-gray-600" />;
    }
  };

  const getNotificationBg = (type: string) => {
    switch (type) {
      case 'arrival': return 'bg-green-50';
      case 'departure': return 'bg-blue-50';
      case 'late': return 'bg-amber-50';
      case 'dismissal': return 'bg-orange-50';
      default: return 'bg-gray-50';
    }
  };

  return (
    <div className="space-y-2">
      {notifications.map(notification => (
        <div
          key={notification.id}
          className={`p-4 rounded-xl border transition-colors ${
            notification.is_read ? 'bg-white border-gray-100' : 'bg-blue-50/50 border-blue-100'
          }`}
        >
          <div className="flex items-start gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${getNotificationBg(notification.type)}`}>
              {getNotificationIcon(notification.type)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800">{notification.title}</p>
              <p className="text-xs text-gray-500 mt-0.5">{notification.message}</p>
              <div className="flex items-center gap-2 mt-1.5">
                <Clock size={10} className="text-gray-400" />
                <p className="text-xs text-gray-400">
                  {new Date(notification.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  {' — '}
                  {new Date(notification.created_at).toLocaleDateString()}
                </p>
                {notification.email_sent && <Mail size={10} className="text-gray-400" />}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
