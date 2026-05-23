// @ts-nocheck
'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { fetchData } from '@/lib/api';
import StudentAvatar from '@/components/shared/StudentAvatar';
import {
  LogIn,
  LogOut,
  Camera,
  CheckCircle,
  XCircle,
  ScanLine,
  Users,
  Car,
  Search,
  UserCheck,
  Bell,
} from 'lucide-react';
import NotificationsInbox from '@/components/notifications/NotificationsInbox';
import { toast } from 'sonner';
import { formatTimeLagos } from '@/lib/timezone';
import { photoSrc } from '@/lib/photo';

function splitName(fullName) {
  const parts = (fullName || '').trim().split(/\s+/).filter(Boolean);
  return { first: parts[0] || '', last: parts.slice(1).join(' ') || '' };
}

export default function GateOfficerDashboard() {
  const [gateMode, setGateMode] = useState('arrival');
  const [sessionActive, setSessionActive] = useState(false);
  const [gateTab, setGateTab] = useState('scan');
  const [currentTime, setCurrentTime] = useState(null);
  const [todayCount, setTodayCount] = useState(0);
  const [schoolId, setSchoolId] = useState('');
  const [schoolReady, setSchoolReady] = useState(false);
  const [gateSessionId, setGateSessionId] = useState(null);
  const [scannedPerson, setScannedPerson] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [facingMode, setFacingMode] = useState('environment');
  const [allStudents, setAllStudents] = useState([]);
  const [pickupQueue, setPickupQueue] = useState([]);
  const [pickupNotices, setPickupNotices] = useState([]);
  const [pickupPersonsByStudent, setPickupPersonsByStudent] = useState({});
  const [pickupRequests, setPickupRequests] = useState([]);
  const [studentSearch, setStudentSearch] = useState('');
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const scanIntervalRef = useRef(null);

  const scannedNames = useMemo(() => {
    if (!scannedPerson?.person?.name) return { first: '', last: '' };
    return splitName(scannedPerson.person.name);
  }, [scannedPerson]);

  const noticeForStudent = useCallback(
    (studentId) => pickupNotices.find((n) => n.student_id === studentId),
    [pickupNotices]
  );

  const loadGateData = useCallback(async () => {
    if (!schoolId) return;
    try {
      const res = await fetch(`/api/gate/dashboard?school_id=${schoolId}&t=${Date.now()}`, {
        credentials: 'include',
        cache: 'no-store',
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Could not load pickup queue');
        return;
      }
      if (data.students) setAllStudents(data.students);
      setPickupQueue(data.pickup_queue || []);
      if (data.pickup_notices) setPickupNotices(data.pickup_notices);
      if (data.pickup_persons_by_student) setPickupPersonsByStudent(data.pickup_persons_by_student);
      if (data.pickup_requests) setPickupRequests(data.pickup_requests);
    } catch (e) {
      console.error(e);
      toast.error('Could not load gate data');
    }
  }, [schoolId]);

  useEffect(() => {
    setCurrentTime(new Date());
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    loadSchool();
    return () => {
      clearInterval(timer);
      stopCamera();
    };
  }, []);

  useEffect(() => {
    if (!sessionActive || !schoolId) return;
    loadGateData();
    const poll = setInterval(loadGateData, 15000);
    return () => clearInterval(poll);
  }, [sessionActive, schoolId, loadGateData]);

  useEffect(() => {
    if (sessionActive && gateTab === 'scan' && !scannedPerson) {
      requestAnimationFrame(() => startCamera());
    } else if (gateTab !== 'scan') {
      stopCamera();
    }
  }, [gateTab, sessionActive, scannedPerson]);

  const loadSchool = async () => {
    try {
      const data = await fetchData('get_school_admin_data', { role: 'gate_officer' });
      if (data.school_id) {
        setSchoolId(data.school_id);
        setSchoolReady(true);
      } else {
        toast.error('No school linked to your gate officer account');
      }
    } catch {
      toast.error('Could not load school');
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
        /* skip */
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
      setFacingMode(facing);
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
    loadGateData();
    if (gateTab === 'scan') {
      requestAnimationFrame(() => setTimeout(() => startCamera(), 150));
    }
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
        credentials: 'include',
        body: JSON.stringify({ scan_data: scanData, school_id: schoolId }),
      });
      const data = await res.json();
      if (data.person) {
        stopCamera();
        const notice = noticeForStudent(data.person.id);
        const pickupPersons = pickupPersonsByStudent[data.person.id] || [];
        setScannedPerson({ ...data, pickup_notice: notice || null, pickup_persons: pickupPersons });
        setGateTab('scan');
      } else {
        toast.error(data.error || 'ID not found');
        startQrScanning();
      }
    } catch {
      toast.error('Scan failed');
      startQrScanning();
    }
    setScanning(false);
  };

  const openStudentForRelease = (student, fromQueue = false) => {
    const notice = noticeForStudent(student.id);
    const pickupPersons = pickupPersonsByStudent[student.id] || [];
    setGateMode('dismissal');
    setScannedPerson({
      type: 'student',
      from_queue: fromQueue,
      pickup_notice: notice || null,
      pickup_persons: pickupPersons,
      person: {
        id: student.id,
        name: `${student.first_name} ${student.last_name}`,
        student_id: student.student_id_number,
        class_name: student.class?.name || '',
        photo_url: student.photo_url,
        qr_code_data: student.qr_code_data,
      },
    });
    setGateTab('scan');
    stopCamera();
  };

  const handleAccept = async () => {
    if (!scannedPerson || accepting) return;
    setAccepting(true);
    try {
      const body = {
        school_id: schoolId,
        gate_session_id: gateSessionId,
        type: gateMode === 'arrival' ? 'arrival' : 'departure',
        verification_method: 'id_card_scan',
        person_type: scannedPerson.type,
      };
      if (scannedPerson.type === 'staff') {
        body.staff_profile_id = scannedPerson.person.id;
        body.user_id = scannedPerson.person.user_id;
      } else {
        body.student_id = scannedPerson.person.id;
        if (gateMode === 'dismissal') {
          body.from_ready_queue = !!scannedPerson.from_queue;
        }
      }
      const res = await fetch('/api/gate/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`${scannedPerson.person.name} — released (saved)`);
        setTodayCount((p) => p + 1);
        resumeScanning();
      } else {
        toast.error(data.error || 'Failed to log');
      }
    } catch {
      toast.error('Failed — try again');
    }
    setAccepting(false);
  };

  const handleStartSession = async () => {
    if (!schoolReady || !schoolId) {
      toast.error('School not loaded');
      return;
    }
    try {
      const res = await fetch('/api/gate/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'start', school_id: schoolId, mode: gateMode }),
      });
      const data = await res.json();
      if (!data.success || !data.session_id) {
        toast.error(data.error || 'Could not start session');
        return;
      }
      setGateSessionId(data.session_id);
      setSessionActive(true);
      await loadGateData();
      setGateTab('scan');
    } catch {
      toast.error('Could not start session');
    }
  };

  const handleEndSession = async () => {
    if (!confirm('End session?')) return;
    if (gateSessionId) {
      await fetch('/api/gate/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'end', session_id: gateSessionId }),
      }).catch(() => {});
    }
    setSessionActive(false);
    setGateSessionId(null);
    setTodayCount(0);
    stopCamera();
    setScannedPerson(null);
  };

  const filteredStudents = allStudents.filter((s) => {
    const q = studentSearch.toLowerCase();
    return `${s.first_name} ${s.last_name} ${s.student_id_number} ${s.class?.name || ''}`.toLowerCase().includes(q);
  });

  const renderAcceptCard = () => (
    <div className="card-elevated p-5 mt-2">
      <div className="flex items-center gap-4 mb-4">
        <StudentAvatar
          photoUrl={scannedPerson.person.photo_url}
          firstName={scannedNames.first}
          lastName={scannedNames.last}
          size="lg"
        />
        <div className="min-w-0 flex-1">
          <p className="text-xl font-bold text-slate-900 truncate">{scannedPerson.person.name}</p>
          <p className="text-sm text-slate-500 font-mono">{scannedPerson.person.student_id || scannedPerson.person.staff_id}</p>
          {scannedPerson.person.class_name && <p className="text-xs text-slate-400">{scannedPerson.person.class_name}</p>}
        </div>
      </div>
      {scannedPerson.pickup_notice && (
        <div className="mb-4 p-3 rounded-xl bg-blue-50 border border-blue-100 text-sm">
          <p className="font-semibold text-blue-900">Parent pickup notice</p>
          <p className="text-blue-800 mt-1">
            <strong>{scannedPerson.pickup_notice.pickup_person_name}</strong>
            {scannedPerson.pickup_notice.pickup_person_phone && ` · ${scannedPerson.pickup_notice.pickup_person_phone}`}
          </p>
          {scannedPerson.pickup_notice.notes && (
            <p className="text-xs text-blue-700 mt-1">{scannedPerson.pickup_notice.notes}</p>
          )}
        </div>
      )}
      {gateMode === 'dismissal' && scannedPerson.pickup_persons?.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-semibold text-slate-600 mb-2">Authorised pickup persons — verify face matches</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {scannedPerson.pickup_persons.map((pp) => {
              const src = photoSrc(pp.photo_url);
              return (
                <div key={pp.id} className="shrink-0 w-24 text-center">
                  {src ? (
                    <img src={src} alt={pp.name} className="w-20 h-20 rounded-xl object-cover mx-auto border-2 border-slate-200" />
                  ) : (
                    <div className="w-20 h-20 rounded-xl bg-slate-100 mx-auto flex items-center justify-center text-xs text-slate-400">No photo</div>
                  )}
                  <p className="text-[10px] font-semibold mt-1 truncate">{pp.name}</p>
                  <p className="text-[9px] text-slate-500">{pp.relationship}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {scannedPerson.from_queue && (
        <p className="text-xs font-semibold text-orange-700 bg-orange-50 border border-orange-100 rounded-lg px-3 py-2 mb-4">
          Ready for pickup — teacher dismissed this student
        </p>
      )}
      <div
        className={`text-center py-3 rounded-xl mb-4 text-sm font-bold ${
          gateMode === 'arrival' ? 'bg-emerald-50 text-emerald-800' : 'bg-orange-50 text-orange-800'
        }`}
      >
        {gateMode === 'arrival' ? 'CHECK IN' : 'CHECK OUT / RELEASE'}
      </div>
      <div className="flex gap-3">
        <button type="button" onClick={resumeScanning} disabled={accepting} className="btn-danger flex-1 flex items-center justify-center gap-2 py-3">
          <XCircle size={18} /> Cancel
        </button>
        <button type="button" onClick={handleAccept} disabled={accepting} className="btn-primary flex-1 flex items-center justify-center gap-2 py-3">
          <CheckCircle size={18} /> {accepting ? 'Saving…' : 'Confirm release'}
        </button>
      </div>
    </div>
  );

  if (!sessionActive) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 pt-14 pb-8">
        <div className="w-full max-w-sm">
          <div className="hero-banner text-center mb-6">
            <ScanLine className="mx-auto mb-2 opacity-90" size={32} />
            <h1 className="text-2xl font-bold">Gate Manager</h1>
            <p className="text-white/80 font-mono text-lg mt-1">{currentTime ? currentTime.toLocaleTimeString() : '--:--'}</p>
          </div>
          <div className="card-elevated p-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setGateMode('arrival')} className={`p-4 rounded-2xl border-2 ${gateMode === 'arrival' ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200'}`}>
                <LogIn className="mx-auto mb-2 text-emerald-600" size={26} />
                <span className="block text-sm font-semibold">Arrival</span>
              </button>
              <button type="button" onClick={() => setGateMode('dismissal')} className={`p-4 rounded-2xl border-2 ${gateMode === 'dismissal' ? 'border-orange-500 bg-orange-50' : 'border-slate-200'}`}>
                <LogOut className="mx-auto mb-2 text-orange-600" size={26} />
                <span className="block text-sm font-semibold">Dismissal</span>
              </button>
            </div>
            <button type="button" onClick={handleStartSession} disabled={!schoolReady} className="btn-primary w-full py-3.5 disabled:opacity-50">
              {schoolReady ? 'Start gate session' : 'Loading…'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col pt-12 pb-6">
      <header className="px-4 py-2 max-w-lg mx-auto w-full flex items-center justify-between gap-2">
        <p className="text-lg font-mono font-bold">{currentTime ? currentTime.toLocaleTimeString() : '--:--'}</p>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold">{todayCount} scans</span>
          <button type="button" onClick={handleEndSession} className="btn-danger text-xs px-3 py-2">End</button>
        </div>
      </header>

      <div className="px-4 max-w-lg mx-auto w-full">
        <div className="pill-tabs mb-3">
          <button type="button" onClick={() => { setGateTab('scan'); setScannedPerson(null); }} className={gateTab === 'scan' ? 'pill-tab-active' : 'pill-tab-inactive'}>
            <ScanLine size={14} className="inline mr-1" /> Scan
          </button>
          <button type="button" onClick={() => setGateTab('pickup')} className={gateTab === 'pickup' ? 'pill-tab-active' : 'pill-tab-inactive'}>
            <Car size={14} className="inline mr-1" /> Ready ({pickupQueue.length})
          </button>
          <button type="button" onClick={() => setGateTab('students')} className={gateTab === 'students' ? 'pill-tab-active' : 'pill-tab-inactive'}>
            <Users size={14} className="inline mr-1" /> All ({allStudents.length})
          </button>
          <button type="button" onClick={() => setGateTab('alerts')} className={gateTab === 'alerts' ? 'pill-tab-active' : 'pill-tab-inactive'}>
            <Bell size={14} className="inline mr-1" /> Alerts
          </button>
        </div>
      </div>

      <main className="flex-1 px-4 max-w-lg mx-auto w-full overflow-y-auto">
        {scannedPerson && gateTab === 'scan' && renderAcceptCard()}

        {gateTab === 'scan' && !scannedPerson && (
          <>
            <div className="aspect-[4/3] bg-slate-900 rounded-3xl overflow-hidden relative mb-3 shadow-lg">
              <video ref={videoRef} className="w-full h-full object-cover" playsInline muted autoPlay />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-44 h-44 border-2 border-white/80 rounded-2xl" />
              </div>
              <button type="button" onClick={switchCamera} className="absolute bottom-3 right-3 bg-black/60 text-white text-xs px-3 py-2 rounded-full flex items-center gap-1">
                <Camera size={14} /> Flip
              </button>
            </div>
            <p className="text-xs text-center text-slate-500">Scan QR on ID card</p>
          </>
        )}

        {gateTab === 'pickup' && !scannedPerson && (
          <div className="space-y-2 pb-4">
            <h2 className="text-sm font-bold text-slate-800">Ready for Pickup – Awaiting Release</h2>
            <p className="text-xs text-slate-500 mb-2">Only students marked ready by teachers. Release is recorded at server time (WAT).</p>
            {pickupQueue.length === 0 ? (
              <div className="card text-center py-10 text-slate-400 text-sm">No students waiting for pickup</div>
            ) : (
              pickupQueue.map((item) => {
                const s = item.student;
                if (!s) return null;
                const notice = noticeForStudent(s.id);
                return (
                  <div key={item.id} className="card-elevated p-3 flex items-center gap-3">
                    <StudentAvatar photoUrl={s.photo_url} firstName={s.first_name} lastName={s.last_name} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{s.first_name} {s.last_name}</p>
                      <p className="text-xs text-slate-500">{s.class?.name} · Ready {formatTimeLagos(item.created_at)}</p>
                      {notice && (
                        <p className="text-[10px] text-blue-700 mt-0.5">Pickup: {notice.pickup_person_name}</p>
                      )}
                    </div>
                    <button type="button" onClick={() => openStudentForRelease(s, true)} className="btn-primary text-xs px-3 py-2 shrink-0">
                      Release
                    </button>
                  </div>
                );
              })
            )}
          </div>
        )}

        {gateTab === 'alerts' && !scannedPerson && (
          <div className="space-y-4 pb-4">
            <NotificationsInbox schoolId={schoolId} compact />
            <div>
              <h2 className="text-sm font-bold text-slate-800 mb-2">Today&apos;s pickup messages</h2>
              {pickupRequests.length === 0 ? (
                <div className="card text-center py-6 text-slate-400 text-sm">No parent pickup messages today</div>
              ) : (
                pickupRequests.map((r) => {
                  const st = r.student;
                  const s = Array.isArray(st) ? st[0] : st;
                  return (
                    <div key={r.id} className="card p-3 mb-2 text-sm">
                      <p className="font-semibold">{s?.first_name} {s?.last_name}</p>
                      <p className="text-blue-800 mt-1">
                        <strong>{r.pickup_person_name}</strong>
                        {r.pickup_person_phone ? ` · ${r.pickup_person_phone}` : ''}
                      </p>
                      {r.message && <p className="text-xs text-slate-600 mt-1">{r.message}</p>}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {gateTab === 'students' && !scannedPerson && (
          <div className="pb-4">
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mb-3">
              Reference only — release students from the Ready tab after teacher marks them ready.
            </p>
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="search"
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                placeholder="Search all registered students…"
                className="input pl-9"
              />
            </div>
            <div className="card-elevated divide-y max-h-[60vh] overflow-y-auto">
              {filteredStudents.map((s) => {
                const inQueue = pickupQueue.some((q) => q.student?.id === s.id);
                const notice = noticeForStudent(s.id);
                return (
                  <div key={s.id} className="list-row py-3">
                    <StudentAvatar photoUrl={s.photo_url} firstName={s.first_name} lastName={s.last_name} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{s.first_name} {s.last_name}</p>
                      <p className="text-xs text-slate-500 font-mono">{s.student_id_number}</p>
                      {inQueue && <span className="text-[10px] text-orange-600 font-semibold">Waiting pickup</span>}
                      {notice && <p className="text-[10px] text-blue-600">Pickup: {notice.pickup_person_name}</p>}
                    </div>
                    {inQueue ? (
                      <button
                        type="button"
                        onClick={() => openStudentForRelease(s, true)}
                        className="text-xs btn-primary px-2 py-1.5 shrink-0"
                      >
                        Release
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => s.qr_code_data && lookupPerson(s.qr_code_data)}
                        className="text-xs btn-secondary px-2 py-1.5 shrink-0"
                        title="Arrival scan only"
                      >
                        Scan
                      </button>
                    )}
                  </div>
                );
              })}
              {filteredStudents.length === 0 && (
                <p className="py-8 text-center text-slate-400 text-sm">No students found</p>
              )}
            </div>
          </div>
        )}

        {scannedPerson && gateTab !== 'scan' && renderAcceptCard()}
      </main>
    </div>
  );
}
