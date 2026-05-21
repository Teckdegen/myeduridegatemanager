// @ts-nocheck
'use client';

import { useEffect, useState } from 'react';
import { getSession } from '@/lib/api';
import { Bell, Sunrise, Sun, Moon, Backpack, Home, UserCheck, BellRing, CheckCircle, Clock, AlertTriangle, LogOut } from 'lucide-react';

export default function ParentDashboard() {
  const [children, setChildren] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState('');
  const [userId, setUserId] = useState('');

  useEffect(() => {
    const session = getSession();
    if (session) {
      setUserName(session.full_name || '');
      setUserId(session.user_id || '');
      loadChildren(session.user_id);
    } else {
      setLoading(false);
    }
  }, []);

  const loadChildren = async (uid) => {
    if (!uid) { setLoading(false); return; }
    try {
      // Get student-parent links
      const res = await fetch('/api/data', {
        method: 'POST', cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'query', params: { table: 'student_parents', select: 'student_id', filters: { parent_user_id: uid } } }),
      });
      const data = await res.json();
      const studentIds = (data.data || []).map(r => r.student_id);

      if (studentIds.length === 0) { setLoading(false); return; }

      // Get student details
      const childrenData = [];
      for (const sid of studentIds) {
        const sRes = await fetch('/api/data', {
          method: 'POST', cache: 'no-store',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'query', params: { table: 'students', select: '*, class:school_classes(name), school:schools(name, primary_color, logo_url)', filters: { id: sid } } }),
        });
        const sData = await sRes.json();
        if (sData.data?.[0]) childrenData.push(sData.data[0]);
      }
      setChildren(childrenData);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return { text: 'Good Morning', icon: <Sunrise size={22} className="text-amber-500" /> };
    if (hour < 17) return { text: 'Good Afternoon', icon: <Sun size={22} className="text-orange-500" /> };
    return { text: 'Good Evening', icon: <Moon size={22} className="text-indigo-500" /> };
  };

  const greeting = getGreeting();

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
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center text-white text-xs font-bold">
              {userName?.split(' ').map(n => n[0]).join('').slice(0,2) || '?'}
            </div>
            <Bell size={20} className="text-gray-600" />
          </div>
        </div>
      </header>

      <main className="p-4 max-w-2xl mx-auto">
        {loading ? (
          <div className="text-center py-12"><div className="animate-pulse text-primary-600">Loading...</div></div>
        ) : children.length === 0 ? (
          <div className="card text-center py-12 mt-6">
            <Backpack size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">No children linked to your account yet.</p>
            <p className="text-sm text-gray-400 mt-1">Your school will add your children to the system.</p>
          </div>
        ) : (
          <div className="space-y-4 mt-4">
            {children.map(child => (
              <div key={child.id} className="card" style={{ borderTopColor: child.school?.primary_color || '#1B4D3E', borderTopWidth: '4px' }}>
                <div className="flex items-center gap-4">
                  {child.photo_url ? (
                    <img src={child.photo_url} alt={child.first_name} className="w-14 h-14 rounded-xl object-cover" />
                  ) : (
                    <div className="w-14 h-14 rounded-xl flex items-center justify-center text-white text-lg font-bold" style={{ backgroundColor: child.school?.primary_color || '#1B4D3E' }}>
                      {child.first_name?.[0]}{child.last_name?.[0]}
                    </div>
                  )}
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-800">{child.first_name} {child.last_name}</h3>
                    <p className="text-sm text-gray-500">{child.school?.name} — {child.class?.name || ''}</p>
                    <p className="text-xs text-gray-400">{child.student_id_number}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
