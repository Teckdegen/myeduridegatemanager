// @ts-nocheck
'use client';

import { useEffect, useState } from 'react';
import { fetchData, getSession } from '@/lib/api';
import { CheckCircle, Clock, AlertTriangle, Bell, Sunrise, Sun, Moon, Backpack, Home, UserCheck, BellRing, LogOut } from 'lucide-react';

export default function ParentDashboard() {
  const [children, setChildren] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState('');

  useEffect(() => {
    const session = getSession();
    if (session) setUserName(session.full_name || '');
    setLoading(false);
  }, []);

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
          <button className="relative p-2 rounded-full hover:bg-gray-100">
            <Bell size={20} className="text-gray-600" />
          </button>
        </div>
      </header>

      <main className="p-4 max-w-2xl mx-auto">
        <div className="card text-center py-12 mt-6">
          <Backpack size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">No children linked to your account yet.</p>
          <p className="text-sm text-gray-400 mt-1">Your school will add your children to the system.</p>
        </div>
      </main>
    </div>
  );
}
