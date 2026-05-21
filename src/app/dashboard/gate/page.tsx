// @ts-nocheck
'use client';

import { useState, useEffect, useRef } from 'react';
import { fetchData } from '@/lib/api';
import { photoSrc } from '@/lib/photo';
import { LogIn, LogOut, Camera, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function GateOfficerDashboard() {
  const [gateMode, setGateMode] = useState('arrival');
  const [sessionActive, setSessionActive] = useState(false);
  const [currentTime, setCurrentTime] = useState(null);
  const [todayCount, setTodayCount] = useState(0);
  const [schoolId, setSchoolId] = useState('');
  const [scannedPerson, setScannedPerson] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [facingMode, setFacingMode] = useState('environment');
  const [cameraActive, setCameraActive] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const scanIntervalRef = useRef(null);

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
    } catch {}
  };

  const startCamera = async (facing = facingMode) => {
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing },
        audio: false,
      });
      streamRef.current = stream;
      setCameraActive(true);
      setTimeout(() => {
        if (videoRef.current) videoRef.current.srcObject = stream;
      }, 100);
      startQrScanning();
    } catch {
      toast.error('Camera access denied');
    }
  };

  const switchCamera = () => {
    const newMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(newMode);
    startCamera(newMode);
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
    setCameraActive(false);
  };

  const startQrScanning = () => {
    scanIntervalRef.current = setInterval(async () => {
      if (!videoRef.current || scanning) return;
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
        if (code?.data) {
          clearInterval(scanIntervalRef.current);
          scanIntervalRef.current = null;
          await lookupPerson(code.data);
        }
      } catch {}
    }, 400);
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
        setScannedPerson(data);
        stopCamera();
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
    if (!scannedPerson) return;
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
      toast.success(`${scannedPerson.person.name} — ${data.is_late ? 'LATE' : 'Logged'}`);
      setTodayCount((prev) => prev + 1);
    } else {
      toast.error(data.error || 'Failed to log');
    }
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
    if (confirm('End session?')) {
      setSessionActive(false);
      setTodayCount(0);
      stopCamera();
      setScannedPerson(null);
    }
  };

  const personPhoto = scannedPerson?.person?.photo_url
    ? photoSrc(scannedPerson.person.photo_url)
    : null;

  if (!sessionActive) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white px-4 pt-12">
        <div className="w-full max-w-sm text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Gate Manager</h1>
          <p className="text-gray-500 font-mono text-lg">
            {currentTime ? currentTime.toLocaleTimeString() : '--:--'}
          </p>
          <p className="text-gray-400 text-sm mb-8">
            {currentTime
              ? currentTime.toLocaleDateString(undefined, {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                })
              : ''}
          </p>
          <div className="border rounded-2xl p-6 space-y-5">
            <p className="text-sm text-gray-500 font-medium text-left">Select Mode</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setGateMode('arrival')}
                className={`p-4 rounded-xl border-2 transition-all ${
                  gateMode === 'arrival' ? 'border-primary-500 bg-primary-50' : 'border-gray-200'
                }`}
              >
                <LogIn
                  className={`mx-auto mb-2 ${gateMode === 'arrival' ? 'text-primary-600' : 'text-gray-400'}`}
                  size={24}
                />
                <span
                  className={`block text-sm font-medium ${
                    gateMode === 'arrival' ? 'text-primary-700' : 'text-gray-500'
                  }`}
                >
                  Arrival
                </span>
              </button>
              <button
                type="button"
                onClick={() => setGateMode('dismissal')}
                className={`p-4 rounded-xl border-2 transition-all ${
                  gateMode === 'dismissal' ? 'border-orange-500 bg-orange-50' : 'border-gray-200'
                }`}
              >
                <LogOut
                  className={`mx-auto mb-2 ${gateMode === 'dismissal' ? 'text-orange-600' : 'text-gray-400'}`}
                  size={24}
                />
                <span
                  className={`block text-sm font-medium ${
                    gateMode === 'dismissal' ? 'text-orange-700' : 'text-gray-500'
                  }`}
                >
                  Dismissal
                </span>
              </button>
            </div>
            <button type="button" onClick={handleStartSession} className="btn-primary w-full py-3">
              Start Session
            </button>
            <p className="text-xs text-gray-400">Scan the QR code on each ID card only</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col pt-10">
      <header className="px-5 py-3 flex items-center justify-between border-b">
        <div className="flex items-center gap-3">
          <div
            className={`w-2.5 h-2.5 rounded-full animate-pulse ${
              gateMode === 'arrival' ? 'bg-green-500' : 'bg-orange-500'
            }`}
          />
          <div>
            <p className="text-xs text-gray-500">{gateMode === 'arrival' ? 'Arrival' : 'Dismissal'}</p>
            <p className="text-base font-mono font-bold">
              {currentTime ? currentTime.toLocaleTimeString() : '--:--'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-xs text-gray-500">Scanned</p>
            <p className="text-base font-bold">{todayCount}</p>
          </div>
          <button type="button" onClick={handleEndSession} className="btn-danger text-xs">
            End
          </button>
        </div>
      </header>

      <main className="flex-1 p-4 max-w-lg mx-auto w-full">
        {scannedPerson ? (
          <div className="card mt-4">
            <div className="flex items-center gap-4 mb-4">
              {personPhoto ? (
                <img
                  src={personPhoto}
                  alt=""
                  className="w-16 h-16 rounded-xl object-cover border-2 border-primary-200"
                />
              ) : (
                <div className="w-16 h-16 rounded-xl bg-primary-100 flex items-center justify-center text-primary-700 text-xl font-bold">
                  {scannedPerson.person.name?.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                </div>
              )}
              <div>
                <p className="text-lg font-bold">{scannedPerson.person.name}</p>
                <p className="text-sm text-gray-500 font-mono">
                  {scannedPerson.person.student_id || scannedPerson.person.staff_id}
                </p>
                {scannedPerson.person.class_name && (
                  <p className="text-xs text-gray-400">{scannedPerson.person.class_name}</p>
                )}
              </div>
            </div>
            <div
              className={`text-center py-2 rounded-lg mb-4 text-sm font-medium ${
                gateMode === 'arrival' ? 'bg-green-50 text-green-700' : 'bg-orange-50 text-orange-700'
              }`}
            >
              {gateMode === 'arrival' ? 'ARRIVING' : 'DEPARTING'} —{' '}
              {scannedPerson.type === 'staff' ? 'STAFF' : 'STUDENT'}
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleReject}
                className="btn-danger flex-1 flex items-center justify-center gap-2"
              >
                <XCircle size={16} /> Reject
              </button>
              <button
                type="button"
                onClick={handleAccept}
                className="btn-primary flex-1 flex items-center justify-center gap-2"
              >
                <CheckCircle size={16} /> Accept
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="aspect-[4/3] bg-black rounded-2xl overflow-hidden relative mb-4">
              <video ref={videoRef} className="w-full h-full object-cover" playsInline muted autoPlay />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-44 h-44 border-2 border-white/70 rounded-2xl" />
              </div>
              <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                <div className="flex items-center gap-1.5 bg-black/60 px-3 py-1.5 rounded-full">
                  <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-xs text-white">
                    {scanning ? 'Looking up...' : 'Scan QR on ID card'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={switchCamera}
                  className="bg-black/60 px-3 py-1.5 rounded-full text-xs text-white"
                >
                  <Camera size={14} className="inline mr-1" />
                  Flip
                </button>
              </div>
            </div>
            <p className="text-sm text-center text-gray-500">
              Hold the <strong>QR code</strong> on the student or staff ID card inside the frame
            </p>
          </>
        )}
      </main>
    </div>
  );
}
