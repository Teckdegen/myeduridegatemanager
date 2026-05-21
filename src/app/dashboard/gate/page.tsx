// @ts-nocheck
'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { fetchData } from '@/lib/api';
import StudentAvatar from '@/components/shared/StudentAvatar';
import { LogIn, LogOut, Camera, CheckCircle, XCircle, ScanLine } from 'lucide-react';
import { toast } from 'sonner';

function splitName(fullName) {
  const parts = (fullName || '').trim().split(/\s+/).filter(Boolean);
  return {
    first: parts[0] || '',
    last: parts.slice(1).join(' ') || '',
  };
}

export default function GateOfficerDashboard() {
  const [gateMode, setGateMode] = useState('arrival');
  const [sessionActive, setSessionActive] = useState(false);
  const [currentTime, setCurrentTime] = useState(null);
  const [todayCount, setTodayCount] = useState(0);
  const [schoolId, setSchoolId] = useState('');
  const [scannedPerson, setScannedPerson] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [facingMode, setFacingMode] = useState('environment');
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const scanIntervalRef = useRef(null);

  const scannedNames = useMemo(() => {
    if (!scannedPerson?.person?.name) return { first: '', last: '' };
    return splitName(scannedPerson.person.name);
  }, [scannedPerson]);

  useEffect(() => {
    setCurrentTime(new Date());
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    loadSchool();
    return () => {
      clearInterval(timer);
      stopCamera();
    };
  }, []);

  const loadSchool = async () => {
    try {
      const data = await fetchData('get_school_admin_data', { role: 'gate_officer' });
      if (data.school_id) setSchoolId(data.school_id);
    } catch {
      /* ignore */
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  const startQrScanning = () => {
    if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
    scanIntervalRef.current = setInterval(async () => {
      if (!videoRef.current || scanning || scannedPerson) return;
      const vw = videoRef.current.videoWidth;
      const vh = videoRef.current.videoHeight;
      if (!vw || !vh) return;

      const canvas = document.createElement('canvas');
      canvas.width = vw;
      canvas.height = vh;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(videoRef.current, 0, 0);
      const imageData = ctx.getImageData(0, 0, vw, vh);

      try {
        const jsQR = (await import('jsqr')).default;
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        if (code?.data) {
          clearInterval(scanIntervalRef.current);
          scanIntervalRef.current = null;
          await lookupPerson(code.data);
        }
      } catch {
        /* skip frame */
      }
    }, 400);
  };

  const startCamera = async (facing = facingMode) => {
    stopCamera();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      startQrScanning();
    } catch {
      toast.error('Camera access denied');
    }
  };

  const resumeScanning = () => {
    setScannedPerson(null);
    setScanning(false);
    requestAnimationFrame(() => {
      setTimeout(() => startCamera(), 150);
    });
  };

  const switchCamera = () => {
    const newMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(newMode);
    startCamera(newMode);
  };

  const lookupPerson = async (scanData) => {
    setScanning(true);
    try {
      const res = await fetch('/api/gate/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scan_data: scanData, school_id: schoolId }),
      });
      const data = await res.json();
      if (data.person) {
        stopCamera();
        setScannedPerson(data);
      } else {
        toast.error(data.error || 'ID not found — scan the QR on the card');
        startQrScanning();
      }
    } catch {
      toast.error('Scan failed');
      startQrScanning();
    }
    setScanning(false);
  };

  const handleAccept = async () => {
    if (!scannedPerson || accepting) return;
    setAccepting(true);
    try {
      const body = {
        school_id: schoolId,
        type: gateMode === 'arrival' ? 'arrival' : 'departure',
        verification_method: 'id_card_scan',
        person_type: scannedPerson.type,
      };
      if (scannedPerson.type === 'staff') {
        body.staff_profile_id = scannedPerson.person.id;
        body.user_id = scannedPerson.person.user_id;
      } else {
        body.student_id = scannedPerson.person.id;
      }

      const res = await fetch('/api/gate/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        const label = gateMode === 'dismissal' ? 'Dismissed' : data.is_late ? 'Late arrival' : 'Checked in';
        toast.success(`${scannedPerson.person.name} — ${label}`);
        setTodayCount((prev) => prev + 1);
        resumeScanning();
      } else {
        toast.error(data.error || 'Failed to log');
      }
    } catch {
      toast.error('Failed to log — try again');
    }
    setAccepting(false);
  };

  const handleReject = () => {
    resumeScanning();
  };

  const handleStartSession = () => {
    setSessionActive(true);
    requestAnimationFrame(() => startCamera());
  };

  const handleEndSession = () => {
    if (confirm('End session?')) {
      setSessionActive(false);
      setTodayCount(0);
      stopCamera();
      setScannedPerson(null);
    }
  };

  if (!sessionActive) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 pt-14 pb-8">
        <div className="w-full max-w-sm">
          <div className="hero-banner text-center mb-6">
            <ScanLine className="mx-auto mb-2 opacity-90" size={32} />
            <h1 className="text-2xl font-bold">Gate Manager</h1>
            <p className="text-white/80 font-mono text-lg mt-1">
              {currentTime ? currentTime.toLocaleTimeString() : '--:--'}
            </p>
            <p className="text-white/60 text-xs mt-1">
              {currentTime
                ? currentTime.toLocaleDateString(undefined, {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                  })
                : ''}
            </p>
          </div>

          <div className="card-elevated p-5 space-y-4">
            <p className="text-sm font-semibold text-slate-600">Session mode</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setGateMode('arrival')}
                className={`p-4 rounded-2xl border-2 transition-all ${
                  gateMode === 'arrival'
                    ? 'border-emerald-500 bg-emerald-50 shadow-sm'
                    : 'border-slate-200 bg-white'
                }`}
              >
                <LogIn
                  className={`mx-auto mb-2 ${gateMode === 'arrival' ? 'text-emerald-600' : 'text-slate-400'}`}
                  size={26}
                />
                <span
                  className={`block text-sm font-semibold ${
                    gateMode === 'arrival' ? 'text-emerald-800' : 'text-slate-500'
                  }`}
                >
                  Arrival
                </span>
              </button>
              <button
                type="button"
                onClick={() => setGateMode('dismissal')}
                className={`p-4 rounded-2xl border-2 transition-all ${
                  gateMode === 'dismissal'
                    ? 'border-orange-500 bg-orange-50 shadow-sm'
                    : 'border-slate-200 bg-white'
                }`}
              >
                <LogOut
                  className={`mx-auto mb-2 ${gateMode === 'dismissal' ? 'text-orange-600' : 'text-slate-400'}`}
                  size={26}
                />
                <span
                  className={`block text-sm font-semibold ${
                    gateMode === 'dismissal' ? 'text-orange-800' : 'text-slate-500'
                  }`}
                >
                  Dismissal
                </span>
              </button>
            </div>
            <button type="button" onClick={handleStartSession} className="btn-primary w-full py-3.5 text-base">
              Start scanning
            </button>
            <p className="text-xs text-center text-slate-400">Scan the QR code on each ID card only</p>
          </div>
        </div>
      </div>
    );
  }

  const modeColor = gateMode === 'arrival' ? 'emerald' : 'orange';

  return (
    <div className="min-h-screen flex flex-col pt-12 pb-6">
      <header className="px-4 py-3 flex items-center justify-between gap-3 max-w-lg mx-auto w-full">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-3 h-3 rounded-full animate-pulse bg-${modeColor}-500 shrink-0`} style={{ backgroundColor: gateMode === 'arrival' ? '#10b981' : '#f97316' }} />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              {gateMode === 'arrival' ? 'Arrival' : 'Dismissal'}
            </p>
            <p className="text-lg font-mono font-bold text-slate-900">
              {currentTime ? currentTime.toLocaleTimeString() : '--:--'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="text-right bg-white rounded-xl px-3 py-1.5 border border-slate-100 shadow-sm">
            <p className="text-[10px] text-slate-500 uppercase font-medium">Today</p>
            <p className="text-lg font-bold text-slate-900 leading-none">{todayCount}</p>
          </div>
          <button type="button" onClick={handleEndSession} className="btn-danger text-xs px-3 py-2">
            End
          </button>
        </div>
      </header>

      <main className="flex-1 px-4 max-w-lg mx-auto w-full">
        {scannedPerson ? (
          <div className="card-elevated p-5 mt-2 animate-in fade-in">
            <div className="flex items-center gap-4 mb-5">
              <StudentAvatar
                photoUrl={scannedPerson.person.photo_url}
                firstName={scannedNames.first}
                lastName={scannedNames.last}
                size="lg"
              />
              <div className="min-w-0 flex-1">
                <p className="text-xl font-bold text-slate-900 truncate">{scannedPerson.person.name}</p>
                <p className="text-sm text-slate-500 font-mono truncate">
                  {scannedPerson.person.student_id || scannedPerson.person.staff_id}
                </p>
                {scannedPerson.person.class_name && (
                  <p className="text-xs text-slate-400 mt-0.5">{scannedPerson.person.class_name}</p>
                )}
              </div>
            </div>

            <div
              className={`text-center py-3 rounded-xl mb-5 text-sm font-bold tracking-wide ${
                gateMode === 'arrival'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-100'
                  : 'bg-orange-50 text-orange-800 border border-orange-100'
              }`}
            >
              {gateMode === 'arrival' ? 'CHECK IN' : 'CHECK OUT'} ·{' '}
              {scannedPerson.type === 'staff' ? 'STAFF' : 'STUDENT'}
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleReject}
                disabled={accepting}
                className="btn-danger flex-1 flex items-center justify-center gap-2 py-3"
              >
                <XCircle size={18} /> Reject
              </button>
              <button
                type="button"
                onClick={handleAccept}
                disabled={accepting}
                className="btn-primary flex-1 flex items-center justify-center gap-2 py-3"
              >
                <CheckCircle size={18} />
                {accepting ? 'Saving…' : 'Accept'}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="aspect-[4/3] bg-slate-900 rounded-3xl overflow-hidden relative mb-4 shadow-xl ring-4 ring-slate-200/50">
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                playsInline
                muted
                autoPlay
              />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-48 h-48 border-2 border-white/80 rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
              </div>
              <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 bg-black/55 backdrop-blur px-3 py-2 rounded-full">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs text-white font-medium">
                    {scanning ? 'Looking up…' : 'Aim at QR on ID card'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={switchCamera}
                  className="bg-black/55 backdrop-blur px-3 py-2 rounded-full text-xs text-white font-medium flex items-center gap-1"
                >
                  <Camera size={14} /> Flip
                </button>
              </div>
            </div>
            <p className="text-sm text-center text-slate-500 px-2">
              Hold the <strong className="text-slate-700">QR code</strong> on the ID card inside the frame
            </p>
          </>
        )}
      </main>
    </div>
  );
}
