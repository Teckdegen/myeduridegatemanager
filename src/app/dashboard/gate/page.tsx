// @ts-nocheck
'use client';

import { useState, useEffect, useRef } from 'react';
import { fetchData, getSession } from '@/lib/api';
import { LogIn, LogOut, StopCircle, Camera, ScanBarcode, CheckCircle, XCircle, Search } from 'lucide-react';
import { toast } from 'sonner';

export default function GateOfficerDashboard() {
  const [gateMode, setGateMode] = useState('arrival');
  const [sessionActive, setSessionActive] = useState(false);
  const [currentTime, setCurrentTime] = useState(null);
  const [todayCount, setTodayCount] = useState(0);
  const [schoolId, setSchoolId] = useState('');
  const [scannedPerson, setScannedPerson] = useState(null);
  const [manualInput, setManualInput] = useState('');
  const [facingMode, setFacingMode] = useState('environment');
  const [cameraActive, setCameraActive] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const scanIntervalRef = useRef(null);

  useEffect(() => {
    setCurrentTime(new Date());
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    loadSchool();
    return () => { clearInterval(timer); stopCamera(); };
  }, []);

  const loadSchool = async () => {
    try {
      const data = await fetchData('get_school_admin_data', { role: 'gate_officer' });
      if (data.school_id) setSchoolId(data.school_id);
    } catch {}
  };

  const startCamera = async (facing = facingMode) => {
    // Stop existing stream first
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); }
    if (scanIntervalRef.current) { clearInterval(scanIntervalRef.current); }
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing }, audio: false });
      streamRef.current = stream;
      setCameraActive(true);
      setTimeout(() => {
        if (videoRef.current) { videoRef.current.srcObject = stream; }
      }, 100);
      startBarcodeScanning();
    } catch { toast.error('Camera access denied'); }
  };

  const switchCamera = () => {
    const newMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(newMode);
    startCamera(newMode);
  };

  const stopCamera = () => {
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    if (scanIntervalRef.current) { clearInterval(scanIntervalRef.current); scanIntervalRef.current = null; }
    setCameraActive(false);
  };

  const startBarcodeScanning = () => {
    scanIntervalRef.current = setInterval(async () => {
      if (!videoRef.current) return;
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(videoRef.current, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      try {
        const jsQR = (await import('jsqr')).default;
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        if (code) {
          clearInterval(scanIntervalRef.current);
          await lookupPerson(code.data);
        }
      } catch {}
    }, 500);
  };

  const lookupPerson = async (scanData) => {
    setScanning(true);
    try {
      const res = await fetch('/api/gate/scan', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scan_data: scanData, school_id: schoolId }),
      });
      const data = await res.json();
      if (data.person) { setScannedPerson(data); }
      else { toast.error('Person not found'); startBarcodeScanning(); }
    } catch { toast.error('Scan failed'); startBarcodeScanning(); }
    setScanning(false);
  };

  const handleManualSearch = async () => {
    if (!manualInput.trim()) return;
    await lookupPerson(manualInput.trim());
    setManualInput('');
  };

  const handleAccept = async () => {
    if (!scannedPerson) return;
    const res = await fetch('/api/gate/accept', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        student_id: scannedPerson.person.id,
        school_id: schoolId,
        type: gateMode === 'arrival' ? 'arrival' : 'departure',
        verification_method: 'id_card_scan',
      }),
    });
    const data = await res.json();
    if (data.success) {
      toast.success(`${scannedPerson.person.name} — ${data.is_late ? 'LATE' : 'On Time'}`);
      setTodayCount(prev => prev + 1);
    } else { toast.error('Failed to log'); }
    setScannedPerson(null);
    startCamera();
  };

  const handleReject = () => {
    setScannedPerson(null);
    startCamera();
  };

  const handleStartSession = () => {
    setSessionActive(true);
    startCamera();
  };

  const handleEndSession = () => {
    if (confirm('End session?')) { setSessionActive(false); setTodayCount(0); stopCamera(); setScannedPerson(null); }
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
              <button onClick={() => setGateMode('arrival')} className={`p-4 rounded-xl border-2 transition-all ${gateMode === 'arrival' ? 'border-primary-500 bg-primary-50' : 'border-gray-200'}`}>
                <LogIn className={`mx-auto mb-2 ${gateMode === 'arrival' ? 'text-primary-600' : 'text-gray-400'}`} size={24} />
                <span className={`block text-sm font-medium ${gateMode === 'arrival' ? 'text-primary-700' : 'text-gray-500'}`}>Arrival</span>
              </button>
              <button onClick={() => setGateMode('dismissal')} className={`p-4 rounded-xl border-2 transition-all ${gateMode === 'dismissal' ? 'border-orange-500 bg-orange-50' : 'border-gray-200'}`}>
                <LogOut className={`mx-auto mb-2 ${gateMode === 'dismissal' ? 'text-orange-600' : 'text-gray-400'}`} size={24} />
                <span className={`block text-sm font-medium ${gateMode === 'dismissal' ? 'text-orange-700' : 'text-gray-500'}`}>Dismissal</span>
              </button>
            </div>
            <button onClick={handleStartSession} className="btn-primary w-full py-3">Start Session</button>
          </div>
        </div>
      </div>
    );
  }

  // Active session
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="px-5 py-3 flex items-center justify-between border-b">
        <div className="flex items-center gap-3">
          <div className={`w-2.5 h-2.5 rounded-full animate-pulse ${gateMode === 'arrival' ? 'bg-green-500' : 'bg-orange-500'}`} />
          <div>
            <p className="text-xs text-gray-500">{gateMode === 'arrival' ? 'Arrival' : 'Dismissal'}</p>
            <p className="text-base font-mono font-bold">{currentTime ? currentTime.toLocaleTimeString() : '--:--'}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right"><p className="text-xs text-gray-500">Scanned</p><p className="text-base font-bold">{todayCount}</p></div>
          <button onClick={handleEndSession} className="btn-danger text-xs">End</button>
        </div>
      </header>

      <main className="flex-1 p-4 max-w-lg mx-auto w-full">
        {/* Scanned person card */}
        {scannedPerson ? (
          <div className="card mt-4">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-14 h-14 rounded-xl bg-primary-100 flex items-center justify-center text-primary-700 text-xl font-bold">
                {scannedPerson.person.name?.split(' ').map(n => n[0]).join('').slice(0,2)}
              </div>
              <div>
                <p className="text-lg font-bold">{scannedPerson.person.name}</p>
                <p className="text-sm text-gray-500">{scannedPerson.person.student_id || scannedPerson.person.staff_id}</p>
                {scannedPerson.person.class_name && <p className="text-xs text-gray-400">{scannedPerson.person.class_name}</p>}
              </div>
            </div>
            <div className={`text-center py-2 rounded-lg mb-4 text-sm font-medium ${gateMode === 'arrival' ? 'bg-green-50 text-green-700' : 'bg-orange-50 text-orange-700'}`}>
              {gateMode === 'arrival' ? 'ARRIVING' : 'DEPARTING'} — {scannedPerson.type === 'staff' ? 'STAFF' : 'STUDENT'}
            </div>
            <div className="flex gap-3">
              <button onClick={handleReject} className="btn-danger flex-1 flex items-center justify-center gap-2"><XCircle size={16} /> Reject</button>
              <button onClick={handleAccept} className="btn-primary flex-1 flex items-center justify-center gap-2"><CheckCircle size={16} /> Accept</button>
            </div>
          </div>
        ) : (
          <>
            {/* Camera */}
            <div className="aspect-[4/3] bg-black rounded-2xl overflow-hidden relative mb-4">
              <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-48 h-32 border-2 border-white/50 rounded-xl" />
              </div>
              <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                <div className="flex items-center gap-1.5 bg-black/60 px-3 py-1.5 rounded-full">
                  <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-xs text-white">Scanning...</span>
                </div>
                <button onClick={switchCamera} className="bg-black/60 px-3 py-1.5 rounded-full text-xs text-white hover:bg-black/80">
                  Switch Camera
                </button>
              </div>
            </div>

            {/* Manual input */}
            <div className="flex gap-2">
              <input type="text" value={manualInput} onChange={e => setManualInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleManualSearch(); }}
                placeholder="Enter student ID manually..." className="input flex-1" />
              <button onClick={handleManualSearch} className="btn-primary px-3"><Search size={16} /></button>
            </div>
            <p className="text-xs text-gray-400 text-center mt-3">Point camera at ID card barcode, or type student ID above</p>
          </>
        )}
      </main>
    </div>
  );
}
