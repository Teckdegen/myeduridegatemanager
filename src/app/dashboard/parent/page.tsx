// @ts-nocheck
'use client';

import { useEffect, useState } from 'react';
import { fetchData, getSession, logout } from '@/lib/api';
import StudentAvatar from '@/components/shared/StudentAvatar';
import {
  Bell,
  Users,
  LogOut,
  CheckCircle,
  Clock,
  AlertTriangle,
  ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';

export default function ParentDashboard() {
  const [children, setChildren] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState('');
  const [tab, setTab] = useState('children');

  useEffect(() => {
    const session = getSession();
    if (session) {
      setUserName(session.full_name || 'Parent');
      loadData();
    } else {
      setLoading(false);
    }
  }, []);

  const loadData = async () => {
    try {
      const [kidsRes, notifRes] = await Promise.all([
        fetchData('get_parent_children'),
        fetchData('get_parent_notifications'),
      ]);
      setChildren(kidsRes.children || []);
      setNotifications(notifRes.notifications || []);
    } catch (err) {
      console.error(err);
      toast.error('Could not load your dashboard');
    }
    setLoading(false);
  };

  const markRead = async (id) => {
    await fetchData('mark_notification_read', { notification_id: id });
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const notifIcon = (type) => {
    if (type === 'late') return <Clock size={18} className="text-amber-500" />;
    if (type === 'departure') return <AlertTriangle size={18} className="text-orange-500" />;
    return <CheckCircle size={18} className="text-emerald-500" />;
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Slim header — no role switcher overlap */}
      <header className="bg-white border-b border-gray-100 px-4 pt-12 pb-3 safe-top">
        <div className="max-w-lg mx-auto flex items-center justify-between gap-2 pr-14">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">MyEduRide</p>
            <h1 className="text-lg font-semibold text-gray-900 truncate">Hi, {userName.split(' ')[0] || 'there'}</h1>
          </div>
          <button
            type="button"
            onClick={logout}
            className="p-2.5 rounded-full bg-gray-50 text-gray-500 hover:bg-red-50 hover:text-red-600 shrink-0"
            aria-label="Sign out"
            title="Sign out"
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>

      {/* Content — room for bottom nav */}
      <main className="flex-1 overflow-y-auto px-4 py-4 pb-28 max-w-lg mx-auto w-full">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : tab === 'children' ? (
          children.length === 0 ? (
            <div className="bg-white rounded-2xl p-10 text-center shadow-sm border border-gray-100">
              <Users size={36} className="mx-auto text-gray-300 mb-3" />
              <p className="font-medium text-gray-700">No children linked yet</p>
              <p className="text-sm text-gray-400 mt-2 leading-relaxed">
                Ask your school to register your child using your parent email address.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs font-medium text-gray-500 px-1">Your children</p>
              {children.map((child) => (
                <article
                  key={child.id}
                  className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100"
                >
                  <div className="flex gap-4">
                    <StudentAvatar
                      photoUrl={child.photo_url}
                      firstName={child.first_name}
                      lastName={child.last_name}
                      size="lg"
                      accentColor={child.school?.primary_color || '#1B4D3E'}
                    />
                    <div className="flex-1 min-w-0 pt-0.5">
                      <h2 className="text-lg font-bold text-gray-900 leading-tight">
                        {child.first_name} {child.last_name}
                      </h2>
                      <p className="text-sm text-gray-500 mt-0.5">{child.school?.name}</p>
                      <p className="text-sm text-gray-500">{child.class?.name || 'Class not set'}</p>
                      <div className="mt-3 inline-flex items-center gap-1.5 bg-gray-50 border border-gray-100 rounded-lg px-2.5 py-1.5">
                        <span className="text-[10px] font-semibold text-gray-400 uppercase">ID</span>
                        <span className="text-xs font-mono font-medium text-gray-800">
                          {child.student_id_number}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-2 capitalize">
                        {child.relationship || 'Parent'}
                      </p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )
        ) : notifications.length === 0 ? (
          <div className="bg-white rounded-2xl p-10 text-center shadow-sm border border-gray-100">
            <Bell size={36} className="mx-auto text-gray-300 mb-3" />
            <p className="font-medium text-gray-700">No notifications yet</p>
            <p className="text-sm text-gray-400 mt-2">
              When your child arrives or leaves school, alerts will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs font-medium text-gray-500 px-1">
              {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
            </p>
            {notifications.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => !n.is_read && markRead(n.id)}
                className={`w-full text-left bg-white rounded-2xl p-4 border transition-colors ${
                  !n.is_read ? 'border-primary-200 shadow-sm' : 'border-gray-100 opacity-90'
                }`}
              >
                <div className="flex gap-3 items-start">
                  <div className="mt-0.5 shrink-0">{notifIcon(n.type)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-sm text-gray-900">{n.title}</p>
                      {!n.is_read && (
                        <span className="text-[10px] font-bold text-primary-600 bg-primary-50 px-1.5 py-0.5 rounded shrink-0">
                          NEW
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mt-1 leading-snug">{n.message}</p>
                    {n.student && (
                      <p className="text-xs text-gray-400 mt-1.5">
                        {n.student.first_name} {n.student.last_name}
                      </p>
                    )}
                    <p className="text-[11px] text-gray-400 mt-2">
                      {new Date(n.created_at).toLocaleString()}
                    </p>
                  </div>
                  <ChevronRight size={16} className="text-gray-300 shrink-0 mt-1" />
                </div>
              </button>
            ))}
          </div>
        )}
      </main>

      {/* Bottom navigation — mobile friendly, not clustered at top */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 safe-bottom z-20">
        <div className="max-w-lg mx-auto flex">
          <button
            type="button"
            onClick={() => setTab('children')}
            className={`flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors ${
              tab === 'children' ? 'text-primary-700' : 'text-gray-400'
            }`}
          >
            <Users size={22} strokeWidth={tab === 'children' ? 2.5 : 2} />
            <span>My Kids</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('notifications')}
            className={`flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors relative ${
              tab === 'notifications' ? 'text-primary-700' : 'text-gray-400'
            }`}
          >
            <Bell size={22} strokeWidth={tab === 'notifications' ? 2.5 : 2} />
            <span>Alerts</span>
            {unreadCount > 0 && (
              <span className="absolute top-2 right-1/4 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
        </div>
      </nav>
    </div>
  );
}
