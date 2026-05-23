// @ts-nocheck
'use client';

import { useCallback, useEffect, useState } from 'react';
import { fetchData } from '@/lib/api';
import { Calendar, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { todayInLagos } from '@/lib/timezone';

const DAY_TYPES = [
  { value: 'public_holiday', label: 'Public holiday' },
  { value: 'school_event', label: 'School event' },
  { value: 'closure', label: 'Closure' },
];

export default function SchoolCalendarPage() {
  const [schoolId, setSchoolId] = useState('');
  const [days, setDays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    calendar_date: todayInLagos(),
    day_type: 'public_holiday',
    title: '',
    description: '',
    notify_parents: false,
  });

  const loadDays = useCallback(async (sid) => {
    if (!sid) return;
    const res = await fetch(`/api/schools/calendar?school_id=${sid}`, { credentials: 'include' });
    const json = await res.json();
    if (json.migration_required) {
      toast.error('Run migration 20260526_investor_features.sql on Supabase');
      setDays([]);
      return;
    }
    if (!res.ok) throw new Error(json.error);
    setDays(json.days || []);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const data = await fetchData('get_school_admin_data', { role: 'school_admin' });
        setSchoolId(data.school_id || '');
        if (data.school_id) await loadDays(data.school_id);
      } catch (e) {
        toast.error('Could not load calendar');
      }
      setLoading(false);
    })();
  }, [loadDays]);

  const addDay = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) {
      toast.error('Title required');
      return;
    }
    try {
      const res = await fetch('/api/schools/calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ school_id: schoolId, ...form }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast.success('Day saved — excluded from attendance reports');
      setForm((f) => ({ ...f, title: '', description: '' }));
      await loadDays(schoolId);
    } catch (err) {
      toast.error(err.message || 'Failed');
    }
  };

  const removeDay = async (id) => {
    if (!confirm('Remove this day from calendar?')) return;
    const res = await fetch(
      `/api/schools/calendar?id=${id}&school_id=${schoolId}`,
      { method: 'DELETE', credentials: 'include' }
    );
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.error || 'Failed');
      return;
    }
    toast.success('Removed');
    await loadDays(schoolId);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center md:ml-56">
        <div className="animate-pulse text-primary-600">Loading…</div>
      </div>
    );
  }

  return (
    <div className="p-6 min-h-screen md:ml-56 pt-14 md:pt-6 max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Calendar className="text-primary-600" size={28} />
        <div>
          <h1 className="text-2xl font-bold">School calendar</h1>
          <p className="text-sm text-slate-500">
            Holidays and events are not counted as absent in reports. Parents can be notified for events.
          </p>
        </div>
      </div>

      <form onSubmit={addDay} className="card-elevated p-5 space-y-3 mb-6">
        <h2 className="font-semibold text-sm">Add non-school day</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate-500 block mb-1">Date</label>
            <input
              type="date"
              className="input"
              value={form.calendar_date}
              onChange={(e) => setForm({ ...form, calendar_date: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1">Type</label>
            <select
              className="input"
              value={form.day_type}
              onChange={(e) => setForm({ ...form, day_type: e.target.value })}
            >
              {DAY_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="text-xs text-slate-500 block mb-1">Title</label>
          <input
            className="input"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="e.g. Democracy Day"
            required
          />
        </div>
        <div>
          <label className="text-xs text-slate-500 block mb-1">Notes (optional)</label>
          <textarea
            className="input min-h-[72px]"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.notify_parents}
            onChange={(e) => setForm({ ...form, notify_parents: e.target.checked })}
          />
          Flag for parent notification (future)
        </label>
        <button type="submit" className="btn-primary w-full">Save day</button>
      </form>

      <div className="card-elevated divide-y">
        {days.map((d) => (
          <div key={d.id} className="p-4 flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold">{d.title}</p>
              <p className="text-xs text-slate-500">
                {d.calendar_date} · {d.day_type.replace('_', ' ')}
              </p>
              {d.description && <p className="text-sm text-slate-600 mt-1">{d.description}</p>}
            </div>
            <button
              type="button"
              onClick={() => removeDay(d.id)}
              className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
              aria-label="Delete"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        {days.length === 0 && (
          <p className="py-10 text-center text-slate-400 text-sm">No holidays or events yet</p>
        )}
      </div>
    </div>
  );
}
