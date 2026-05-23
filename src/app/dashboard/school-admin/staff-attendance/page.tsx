// @ts-nocheck
'use client';

import { useEffect, useState } from 'react';
import { fetchData } from '@/lib/api';
import { todayInLagos } from '@/lib/timezone';
import { toast } from 'sonner';
import { UserCheck } from 'lucide-react';

export default function StaffAttendancePage() {
  const [schoolId, setSchoolId] = useState('');
  const [staff, setStaff] = useState([]);
  const [date, setDate] = useState(todayInLagos());
  const [marked, setMarked] = useState({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await fetchData('get_school_admin_data', { role: 'school_admin' });
        setSchoolId(data.school_id || '');
        const res = await fetch(`/api/schools/staff?school_id=${data.school_id}`, { credentials: 'include' });
        const json = await res.json();
        setStaff(
          (json.staff || []).filter((r) =>
            ['school_admin', 'teacher', 'gate_officer'].includes(r.role)
          )
        );
      } catch {
        toast.error('Could not load staff');
      }
      setLoading(false);
    })();
  }, []);

  const toggle = async (userId, name, currentlyPresent) => {
    setBusy(userId);
    try {
      const res = await fetch('/api/staff/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          school_id: schoolId,
          user_id: userId,
          calendar_date: date,
          present: !currentlyPresent,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setMarked((m) => ({ ...m, [userId]: !currentlyPresent }));
      toast.success(`${name} — ${!currentlyPresent ? 'marked present' : 'cleared'}`);
    } catch (e) {
      toast.error(e.message || 'Failed');
    }
    setBusy(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center md:ml-56">
        <div className="animate-pulse text-primary-600">Loading…</div>
      </div>
    );
  }

  return (
    <div className="p-6 min-h-screen md:ml-56 pt-14 md:pt-6 max-w-lg">
      <div className="flex items-center gap-3 mb-2">
        <UserCheck className="text-primary-600" size={26} />
        <h1 className="text-2xl font-bold">Staff attendance</h1>
      </div>
      <p className="text-sm text-slate-500 mb-6">
        Official records for monthly staff reports. Gate scans are kept separately for audit.
      </p>

      <div className="mb-4">
        <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">Date</label>
        <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>

      <div className="card-elevated divide-y">
        {staff.map((s) => {
          const present = marked[s.user_id];
          return (
            <div key={s.id} className="p-4 flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold">{s.full_name || s.email}</p>
                <p className="text-xs text-slate-500 capitalize">{s.role?.replace('_', ' ')}</p>
              </div>
              <button
                type="button"
                disabled={busy === s.user_id}
                onClick={() => toggle(s.user_id, s.full_name || 'Staff', present)}
                className={`text-sm px-4 py-2 rounded-xl font-semibold ${
                  present ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'
                }`}
              >
                {busy === s.user_id ? '…' : present ? 'Present ✓' : 'Mark present'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
