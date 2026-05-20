// @ts-nocheck
'use client';

import { useState, useEffect, useRef } from 'react';
import { fetchData, getSession } from '@/lib/api';
import { LogIn, LogOut, StopCircle, Camera, ScanBarcode } from 'lucide-react';

export default function GateOfficerDashboard() {
  const [gateMode, setGateMode] = useState('arrival');
  const [sessionActive, setSessionActive] = useState(false);
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [todayCount, setTodayCount] = useState(0);
  const [cameraError, setCameraError] = useState('');
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    setCurrentTime(new Date());
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => {
      clearInterval(timer);
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    };
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 640, height: 480 },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraError('');
    } catch (err) {
      setCameraError('Camera access denied. Please allow camera permissions.');
    }
  };

  const handleStartSession = async () => {
    setSessionActive(true);
    await startCamera();
  };

  const handleEndSession = () => {
    if (confirm('End this gate session?')) {
      setSessionActive(false);
      setTodayCount(0);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
    }
  };

  // Start screen
  if (!sessionActive) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white px-4">
        <div className="w-full max-w-sm text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Gate Manager</h1>
          <p className="text-gray-500 font-mono text-lg">{currentTime ? currentTime.toLocaleTimeString() : '--:--'}</p>
          <p className="text-gray-400 text-sm mb-8">{currentTime ? currentTime.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }) : ''}</p>

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

  // Active session with live camera
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="px-5 py-3 flex items-center justify-between border-b">
        <div className="flex items-center gap-3">
          <div className={`w-2.5 h-2.5 rounded-full animate-pulse ${gateMode === 'arrival' ? 'bg-green-500' : 'bg-orange-500'}`} />
          <div>
            <p className="text-xs text-gray-500">{gateMode === 'arrival' ? 'Arrival' : 'Dismissal'}</p>
            <p className="text-base font-mono font-bold text-gray-900">{(currentTime?.toLocaleTimeString() || '--:--')}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-xs text-gray-500">Scanned</p>
            <p className="text-base font-bold">{todayCount}</p>
          </div>
          <button onClick={handleEndSession} className="px-3 py-2 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 font-medium text-xs transition-colors">
            End Session
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-lg">
          {/* Live camera feed */}
          <div className="aspect-[4/3] bg-black rounded-2xl overflow-hidden relative mb-4">
            <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
            {/* Scan overlay */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-48 h-48 border-2 border-white/50 rounded-2xl" />
            </div>
            {/* Status bar */}
            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
              <div className="flex items-center gap-1.5 bg-black/60 px-3 py-1.5 rounded-full">
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-xs text-white">Scanning...</span>
              </div>
              <div className="flex items-center gap-2 bg-black/60 px-3 py-1.5 rounded-full">
                <Camera size={12} className="text-white" />
                <ScanBarcode size={12} className="text-white" />
              </div>
            </div>
          </div>

          {cameraError && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-100 mb-4">
              <p className="text-sm text-red-600">{cameraError}</p>
              <button onClick={startCamera} className="text-xs text-red-700 underline mt-1">Try Again</button>
            </div>
          )}

          <p className="text-center text-xs text-gray-400">
            Camera auto-detects face or ID card barcode. Hold steady for best results.
          </p>
        </div>
      </main>
    </div>
  );
}

