// @ts-nocheck
'use client';

import { useState, useEffect } from 'react';
import { fetchData } from '@/lib/api';
import { Camera, ScanBarcode, LogIn, LogOut, StopCircle, Shield, Users, GraduationCap, CheckCircle, XCircle, Clock } from 'lucide-react';

export default function GateOfficerDashboard() {
  const [gateMode, setGateMode] = useState('arrival');
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [todayCount, setTodayCount] = useState(0);
  const [schoolId, setSchoolId] = useState('');

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    loadSchool();
    return () => clearInterval(timer);
  }, []);

  const loadSchool = async () => {
    try {
      const data = await fetchData('get_school_admin_data', { role: 'gate_officer' });
      if (data.school_id) setSchoolId(data.school_id);
    } catch {}
  };

  const handleStartSession = () => {
    setSession({ mode: gateMode, started: new Date().toISOString() });
  };

  const handleEndSession = () => {
    if (confirm('End this gate session?')) {
      setSession(null);
      setTodayCount(0);
    }
  };

  // No session — start screen
  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 px-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-primary-600 flex items-center justify-center mx-auto mb-4">
              <Shield size={32} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">Gate Manager</h1>
            <p className="text-gray-400 mt-1 font-mono text-lg">{currentTime.toLocaleTimeString()}</p>
            <p className="text-gray-500 text-sm">{currentTime.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</p>
          </div>

          <div className="bg-gray-800 rounded-2xl p-6 space-y-5">
            <p className="text-sm text-gray-400 font-medium">Select Gate Mode</p>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setGateMode('arrival')}
                className={`p-5 rounded-xl border-2 transition-all ${gateMode === 'arrival' ? 'border-green-500 bg-green-500/10' : 'border-gray-700'}`}>
                <LogIn className={`mx-auto mb-2 ${gateMode === 'arrival' ? 'text-green-400' : 'text-gray-500'}`} size={28} />
                <span className={`block font-medium ${gateMode === 'arrival' ? 'text-green-400' : 'text-gray-400'}`}>Arrival</span>
              </button>
              <button onClick={() => setGateMode('dismissal')}
                className={`p-5 rounded-xl border-2 transition-all ${gateMode === 'dismissal' ? 'border-orange-500 bg-orange-500/10' : 'border-gray-700'}`}>
                <LogOut className={`mx-auto mb-2 ${gateMode === 'dismissal' ? 'text-orange-400' : 'text-gray-500'}`} size={28} />
                <span className={`block font-medium ${gateMode === 'dismissal' ? 'text-orange-400' : 'text-gray-400'}`}>Dismissal</span>
              </button>
            </div>
            <button onClick={handleStartSession} disabled={loading}
              className="w-full py-4 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-semibold text-lg transition-colors">
              Start Gate Session
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Active session
  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      <header className="bg-gray-800 px-5 py-4 flex items-center justify-between border-b border-gray-700">
        <div className="flex items-center gap-4">
          <div className={`w-3 h-3 rounded-full animate-pulse ${gateMode === 'arrival' ? 'bg-green-500' : 'bg-orange-500'}`} />
          <div>
            <p className="text-sm text-gray-400">{gateMode === 'arrival' ? 'Arrival Mode' : 'Dismissal Mode'}</p>
            <p className="text-xl font-mono font-bold">{currentTime.toLocaleTimeString()}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-sm text-gray-400">Processed</p>
            <p className="text-lg font-bold">{todayCount}</p>
          </div>
          <button onClick={handleEndSession} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-medium">
            <StopCircle size={18} /> End Session
          </button>
        </div>
      </header>

      <main className="flex-1 p-5 max-w-2xl mx-auto w-full">
        <div className="space-y-4 mt-8">
          <p className="text-center text-gray-400 text-sm mb-4">Choose verification method</p>
          <button className="w-full p-6 rounded-2xl bg-gray-800 border border-gray-700 hover:border-primary-500 transition-all flex items-center gap-5">
            <div className="w-14 h-14 rounded-xl bg-primary-600/20 flex items-center justify-center">
              <Camera size={28} className="text-primary-400" />
            </div>
            <div className="text-left">
              <span className="text-lg font-semibold">Face Recognition</span>
              <p className="text-sm text-gray-400 mt-0.5">Scan face with camera</p>
            </div>
          </button>
          <button className="w-full p-6 rounded-2xl bg-gray-800 border border-gray-700 hover:border-primary-500 transition-all flex items-center gap-5">
            <div className="w-14 h-14 rounded-xl bg-accent-500/20 flex items-center justify-center">
              <ScanBarcode size={28} className="text-accent-400" />
            </div>
            <div className="text-left">
              <span className="text-lg font-semibold">Scan ID Card</span>
              <p className="text-sm text-gray-400 mt-0.5">Scan barcode on ID card</p>
            </div>
          </button>
        </div>
      </main>
    </div>
  );
}
