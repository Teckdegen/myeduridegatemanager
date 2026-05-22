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
  Car,
  Send,
} from 'lucide-react';
import { toast } from 'sonner';

export default function ParentDashboard() {
  const [children, setChildren] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState('');
  const [tab, setTab] = useState('children');
  const [pickupForm, setPickupForm] = useState({
    student_id: '',
    pickup_person_name: '',
    pickup_person_phone: '',
    relationship: '',
    notes: '',
    is_self: true,
  });
  const [submittingPickup, setSubmittingPickup] = useState(false);
  const [recentNotices, setRecentNotices] = useState([]);

  useEffect(() => {
    const session = getSession();
    if (session) {
      setUserName(session.full_name || 'Parent');
      loadData();
    } else {
      setLoading(false);
    }
  }, []);

  const submitPickupNotice = async () => {
    if (!pickupForm.student_id || !pickupForm.pickup_person_name.trim()) {
      toast.error('Select a child and who will pick them up');
      return;
    }
    setSubmittingPickup(true);
    try {
      const res = await fetch('/api/parents/pickup-notice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          student_id: pickupForm.student_id,
          pickup_person_name: pickupForm.pickup_person_name.trim(),
          pickup_person_phone: pickupForm.pickup_person_phone,
          relationship: pickupForm.relationship,
          notes: pickupForm.notes,
          is_self: pickupForm.is_self,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('School and gate have been notified');
        setPickupForm((f) => ({ ...f, notes: '', relationship: '' }));
        const noticeRes = await fetch('/api/parents/pickup-notice', { credentials: 'include' });
        const noticeData = await noticeRes.json();
        setRecentNotices(noticeData.notices || []);
      } else {
        toast.error(data.error || 'Could not send');
      }
    } catch {
      toast.error('Failed to send notice');
    }
    setSubmittingPickup(false);
  };

  const loadData = async () => {
    try {
      const [kidsRes, notifRes] = await Promise.all([
        fetchData('get_parent_children'),
        fetchData('get_parent_notifications'),
      ]);
      setChildren(kidsRes.children || []);
      setNotifications(notifRes.notifications || []);
      const sess = getSession();
      if (kidsRes.children?.[0]) {
        setPickupForm((f) => ({
          ...f,
          student_id: f.student_id || kidsRes.children[0].id,
          pickup_person_name: f.is_self ? (sess?.full_name || '') : f.pickup_person_name,
        }));
      }
      const noticeRes = await fetch('/api/parents/pickup-notice', { credentials: 'include' });
      const noticeData = await noticeRes.json();
      setRecentNotices(noticeData.notices || []);
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
        ) : tab === 'pickup' ? (
          children.length === 0 ? (
            <div className="bg-white rounded-2xl p-10 text-center shadow-sm border border-gray-100">
              <Car size={36} className="mx-auto text-gray-300 mb-3" />
              <p className="font-medium text-gray-700">Link a child first</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <h2 className="font-semibold text-gray-900 mb-1">Notify school — who is picking up?</h2>
                <p className="text-xs text-gray-500 mb-4 leading-relaxed">
                  Tell the gate who will collect your child today. If someone else is coming, enter their name and phone.
                </p>
                <label className="text-xs font-medium text-gray-500 block mb-1">Child</label>
                <select
                  className="input mb-3"
                  value={pickupForm.student_id}
                  onChange={(e) => setPickupForm((f) => ({ ...f, student_id: e.target.value }))}
                >
                  {children.map((c) => (
                    <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>
                  ))}
                </select>
                <label className="flex items-center gap-2 mb-3 text-sm">
                  <input
                    type="checkbox"
                    checked={pickupForm.is_self}
                    onChange={(e) =>
                      setPickupForm((f) => ({
                        ...f,
                        is_self: e.target.checked,
                        pickup_person_name: e.target.checked ? (userName || '') : '',
                        relationship: e.target.checked ? 'parent (self)' : '',
                      }))
                    }
                  />
                  I am picking up myself
                </label>
                {!pickupForm.is_self && (
                  <>
                    <label className="text-xs font-medium text-gray-500 block mb-1">Pickup person name *</label>
                    <input
                      className="input mb-3"
                      value={pickupForm.pickup_person_name}
                      onChange={(e) => setPickupForm((f) => ({ ...f, pickup_person_name: e.target.value }))}
                      placeholder="Full name of person picking up"
                    />
                    <label className="text-xs font-medium text-gray-500 block mb-1">Their phone</label>
                    <input
                      className="input mb-3"
                      value={pickupForm.pickup_person_phone}
                      onChange={(e) => setPickupForm((f) => ({ ...f, pickup_person_phone: e.target.value }))}
                      placeholder="Phone number"
                    />
                    <label className="text-xs font-medium text-gray-500 block mb-1">Relationship</label>
                    <input
                      className="input mb-3"
                      value={pickupForm.relationship}
                      onChange={(e) => setPickupForm((f) => ({ ...f, relationship: e.target.value }))}
                      placeholder="e.g. Aunt, Driver, Family friend"
                    />
                  </>
                )}
                {pickupForm.is_self && (
                  <>
                    <label className="text-xs font-medium text-gray-500 block mb-1">Your name</label>
                    <input
                      className="input mb-3"
                      value={pickupForm.pickup_person_name}
                      onChange={(e) => setPickupForm((f) => ({ ...f, pickup_person_name: e.target.value }))}
                    />
                  </>
                )}
                <label className="text-xs font-medium text-gray-500 block mb-1">Note to school (optional)</label>
                <textarea
                  className="input mb-4 min-h-[80px]"
                  value={pickupForm.notes}
                  onChange={(e) => setPickupForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="e.g. Black Toyota, ID at reception…"
                />
                <button
                  type="button"
                  onClick={submitPickupNotice}
                  disabled={submittingPickup}
                  className="btn-primary w-full flex items-center justify-center gap-2 py-3"
                >
                  <Send size={18} />
                  {submittingPickup ? 'Sending…' : 'Send to school & gate'}
                </button>
              </div>
              {recentNotices.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 px-1 mb-2">Sent today / recently</p>
                  {recentNotices.map((n) => (
                    <div key={n.id} className="bg-white rounded-xl p-3 border border-gray-100 mb-2 text-sm">
                      <p className="font-medium">{n.pickup_person_name}</p>
                      <p className="text-xs text-gray-500">{new Date(n.created_at).toLocaleString()}</p>
                      {n.notes && <p className="text-xs text-gray-600 mt-1">{n.notes}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
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
            onClick={() => setTab('pickup')}
            className={`flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors ${
              tab === 'pickup' ? 'text-primary-700' : 'text-gray-400'
            }`}
          >
            <Car size={22} strokeWidth={tab === 'pickup' ? 2.5 : 2} />
            <span>Pickup</span>
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
