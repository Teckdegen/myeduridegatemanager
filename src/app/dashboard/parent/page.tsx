// @ts-nocheck
'use client';

import { useEffect, useState } from 'react';
import { fetchData, getSession, logout } from '@/lib/api';
import {
  Bell,
  Sunrise,
  Sun,
  Moon,
  Backpack,
  Users,
  LogOut,
  CheckCircle,
  Clock,
  AlertTriangle,
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
      setUserName(session.full_name || '');
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
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return { text: 'Good Morning', icon: <Sunrise size={22} className="text-amber-500" /> };
    if (hour < 17) return { text: 'Good Afternoon', icon: <Sun size={22} className="text-orange-500" /> };
    return { text: 'Good Evening', icon: <Moon size={22} className="text-indigo-500" /> };
  };

  const greeting = getGreeting();
  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const notifIcon = (type) => {
    if (type === 'late') return <Clock size={16} className="text-amber-600" />;
    if (type === 'absent' || type === 'departure') return <AlertTriangle size={16} className="text-orange-600" />;
    return <CheckCircle size={16} className="text-green-600" />;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50">
      <header className="bg-white/80 backdrop-blur-sm border-b sticky top-0 z-20 px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            {greeting.icon}
            <div>
              <h1 className="text-lg font-bold text-gray-800">{greeting.text}</h1>
              <p className="text-sm text-gray-500">Welcome, {userName}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Bell size={20} className="text-gray-600" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </div>
            <button onClick={logout} className="p-2 text-gray-500 hover:text-gray-700" title="Sign out">
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      <main className="p-4 max-w-2xl mx-auto">
        <div className="flex gap-1 bg-white/80 p-1 rounded-xl mb-4 border">
          <button
            onClick={() => setTab('children')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2 ${
              tab === 'children' ? 'bg-primary-600 text-white shadow-sm' : 'text-gray-600'
            }`}
          >
            <Users size={16} /> My Children ({children.length})
          </button>
          <button
            onClick={() => setTab('notifications')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2 ${
              tab === 'notifications' ? 'bg-primary-600 text-white shadow-sm' : 'text-gray-600'
            }`}
          >
            <Bell size={16} /> Notifications
            {unreadCount > 0 && (
              <span className="bg-red-500 text-white text-xs px-1.5 rounded-full">{unreadCount}</span>
            )}
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-pulse text-primary-600">Loading...</div>
          </div>
        ) : tab === 'children' ? (
          children.length === 0 ? (
            <div className="card text-center py-12">
              <Backpack size={40} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500 font-medium">No children linked yet</p>
              <p className="text-sm text-gray-400 mt-1">
                When your school registers your child with your email, they will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {children.map((child) => (
                <div
                  key={child.id}
                  className="card"
                  style={{
                    borderTopColor: child.school?.primary_color || '#1B4D3E',
                    borderTopWidth: '4px',
                  }}
                >
                  <div className="flex items-start gap-4">
                    {child.photo_url ? (
                      <img
                        src={child.photo_url}
                        alt={`${child.first_name} ${child.last_name}`}
                        className="w-16 h-16 rounded-xl object-cover"
                      />
                    ) : (
                      <div
                        className="w-16 h-16 rounded-xl flex items-center justify-center text-white text-lg font-bold"
                        style={{ backgroundColor: child.school?.primary_color || '#1B4D3E' }}
                      >
                        {child.first_name?.[0]}
                        {child.last_name?.[0]}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-gray-800 text-lg">
                        {child.first_name} {child.last_name}
                      </h3>
                      <p className="text-sm text-gray-500">{child.school?.name}</p>
                      <p className="text-sm text-gray-500">Class: {child.class?.name || '—'}</p>
                      <p className="text-xs font-mono text-primary-700 mt-2 bg-primary-50 inline-block px-2 py-1 rounded">
                        ID: {child.student_id_number}
                      </p>
                      <p className="text-xs text-gray-400 mt-1 capitalize">
                        Your relationship: {child.relationship || 'parent'}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : notifications.length === 0 ? (
          <div className="card text-center py-12">
            <Bell size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">No notifications yet</p>
            <p className="text-sm text-gray-400 mt-1">
              Arrival, late, and dismissal alerts will show up here.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => !n.is_read && markRead(n.id)}
                className={`w-full text-left card py-3 transition-colors ${
                  !n.is_read ? 'border-l-4 border-l-primary-500 bg-primary-50/50' : 'opacity-80'
                }`}
              >
                <div className="flex gap-3">
                  <div className="mt-0.5">{notifIcon(n.type)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{n.title}</p>
                    <p className="text-sm text-gray-600 mt-0.5">{n.message}</p>
                    {n.student && (
                      <p className="text-xs text-gray-400 mt-1">
                        {n.student.first_name} {n.student.last_name}
                      </p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(n.created_at).toLocaleString()}
                    </p>
                  </div>
                  {!n.is_read && (
                    <span className="text-xs text-primary-600 font-medium shrink-0">New</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
