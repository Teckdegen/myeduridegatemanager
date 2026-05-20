// @ts-nocheck
'use client';

import { useState, useEffect } from 'react';
import { fetchData } from '@/lib/api';
import { LogIn, LogOut, StopCircle, Clock, Camera, ScanBarcode } from 'lucide-react';

export default function GateOfficerDashboard() {
  const [gateMode, setGateMode] = useState('arrival');
  const [session, setSession] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [todayCount, setTodayCount] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

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
      <div className="min-h-screen flex items-center justify-center bg-white px-4">
        <div className="w-full max-w-sm text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Gate Manager</h1>
          <p className="text-gray-500 font-mono text-lg">{currentTime.toLocaleTimeString()}</p>
          <p className="text-gray-400 text-sm mb-8">{currentTime.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</p>

          <div className="border rounded-2xl p-6 space-y-5">
            <p className="text-sm text-gray-500 font-medium text-left">Select Mode</p>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setGateMode('arrival')}
                className={`p-4 rounded-xl border-2 transition-all ${gateMode === 'arrival' ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300'}`}>
                <LogIn className={`mx-auto mb-2 ${gateMode === 'arrival' ? 'text-primary-600' : 'text-gray-400'}`} size={24} />
                <span className={`block text-sm font-medium ${gateMode === 'arrival' ? 'text-primary-700' : 'text-gray-500'}`}>Arrival</span>
              </button>
              <button onClick={() => setGateMode('dismissal')}
                className={`p-4 rounded-xl border-2 transition-all ${gateMode === 'dismissal' ? 'border-orange-500 bg-orange-50' : 'border-gray-200 hover:border-gray-300'}`}>
                <LogOut className={`mx-auto mb-2 ${gateMode === 'dismissal' ? 'text-orange-600' : 'text-gray-400'}`} size={24} />
                <span className={`block text-sm font-medium ${gateMode === 'dismissal' ? 'text-orange-700' : 'text-gray-500'}`}>Dismissal</span>
              </button>
            </div>
            <button onClick={handleStartSession}
              className="w-full py-3.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-semibold transition-colors">
              Start Session
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Active session — camera auto-detects face or barcode
  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <header className="px-5 py-4 flex items-center justify-between border-b">
        <div className="flex items-center gap-3">
          <div className={`w-2.5 h-2.5 rounded-full animate-pulse ${gateMode === 'arrival' ? 'bg-green-500' : 'bg-orange-500'}`} />
          <div>
            <p className="text-xs text-gray-500">{gateMode === 'arrival' ? 'Arrival Mode' : 'Dismissal Mode'}</p>
            <p className="text-lg font-mono font-bold text-gray-900">{currentTime.toLocaleTimeString()}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-xs text-gray-500">Processed</p>
            <p className="text-lg font-bold text-gray-900">{todayCount}</p>
          </div>
          <button onClick={handleEndSession} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 font-medium text-sm transition-colors">
            <StopCircle size={16} /> End
          </button>
        </div>
      </header>

      {/* Camera area — auto detects face or barcode */}
      <main className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md">
          {/* Camera placeholder */}
          <div className="aspect-[4/3] bg-gray-100 rounded-2xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center mb-4">
            <Camera size={40} className="text-gray-300 mb-3" />
            <p className="text-sm text-gray-500 font-medium">Camera Active</p>
            <p className="text-xs text-gray-400 mt-1">Auto-detects face or ID card barcode</p>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border">
            <div className="flex items-center gap-2 flex-1">
              <Camera size={14} className="text-primary-600" />
              <span className="text-xs text-gray-600">Face Recognition</span>
            </div>
            <div className="w-px h-4 bg-gray-200" />
            <div className="flex items-center gap-2 flex-1">
              <ScanBarcode size={14} className="text-primary-600" />
              <span className="text-xs text-gray-600">Barcode Scan</span>
            </div>
          </div>

          <p className="text-center text-xs text-gray-400 mt-4">
            Point camera at student or hold ID card in view. System auto-detects.
          </p>
        </div>
      </main>
    </div>
  );
}
