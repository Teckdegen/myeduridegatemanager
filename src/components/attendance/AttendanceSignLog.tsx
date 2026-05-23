// @ts-nocheck
'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle, LogOut as LogOutIcon, User } from 'lucide-react';
import { todayInLagos } from '@/lib/timezone';

export default function AttendanceSignLog({
  schoolId,
  title = 'Sign in / out log',
  defaultEntity = 'all',
}) {
  const [date, setDate] = useState(todayInLagos());
  const [entity, setEntity] = useState(defaultEntity);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ school_id: schoolId, date, entity });
      const res = await fetch(`/api/attendance/sign-log?${params}`, { credentials: 'include' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed');
      setEntries(json.entries || []);
    } catch {
      setEntries([]);
    }
    setLoading(false);
  }, [schoolId, date, entity]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-slate-900">{title}</h2>
        <p className="text-xs text-slate-500">Student check-in/out and staff gate scans (Lagos date)</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">Date</label>
          <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">Show</label>
          <select className="input" value={entity} onChange={(e) => setEntity(e.target.value)}>
            <option value="all">Students & staff</option>
            <option value="student">Students only</option>
            <option value="staff">Staff only</option>
          </select>
        </div>
      </div>

      {loading && <p className="text-sm text-slate-500 animate-pulse">Loading…</p>}

      {!loading && (
        <div className="card-elevated divide-y max-h-[70vh] overflow-y-auto">
          {entries.map((e) => (
            <div key={`${e.entity}-${e.id}`} className="px-4 py-3 flex items-center gap-3">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                  e.entity === 'staff' ? 'bg-violet-50' :
                  e.type === 'arrival' || e.type === 'clock_in' ? 'bg-emerald-50' : 'bg-orange-50'
                }`}
              >
                {e.entity === 'staff' ? (
                  <User size={14} className="text-violet-600" />
                ) : e.type === 'arrival' || e.type === 'clock_in' ? (
                  <CheckCircle size={14} className="text-emerald-600" />
                ) : (
                  <LogOutIcon size={14} className="text-orange-600" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{e.name}</p>
                <p className="text-xs text-slate-500">
                  {e.type_label}
                  {e.detail ? ` · ${e.detail}` : ''}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-mono font-medium">{e.time_display}</p>
                {e.status === 'late' && (
                  <span className="text-[10px] text-amber-700 font-semibold">Late</span>
                )}
              </div>
            </div>
          ))}
          {entries.length === 0 && (
            <p className="py-12 text-center text-slate-400 text-sm">No sign-ins for this date</p>
          )}
        </div>
      )}
    </div>
  );
}
