// @ts-nocheck
'use client';

import { useCallback, useEffect, useState } from 'react';
import { formatDateTimeLagos } from '@/lib/timezone';
import { toast } from 'sonner';

export default function PickupRequestsPanel({ schoolId }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/pickup-requests?school_id=${schoolId}`, { credentials: 'include' });
      const data = await res.json();
      setRequests(data.pickup_requests || []);
    } catch {
      toast.error('Could not load pickup requests');
    }
    setLoading(false);
  }, [schoolId]);

  useEffect(() => { load(); }, [load]);

  const acknowledge = async (id) => {
    try {
      const res = await fetch('/api/pickup-requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id, status: 'acknowledged', school_id: schoolId }),
      });
      if (!res.ok) throw new Error();
      toast.success('Acknowledged');
      load();
    } catch {
      toast.error('Failed');
    }
  };

  if (!schoolId) return null;

  return (
    <div className="card">
      <h3 className="font-semibold text-sm mb-3">Pickup requests (today)</h3>
      {loading && <p className="text-sm text-gray-400">Loading…</p>}
      {!loading && requests.length === 0 && (
        <p className="text-sm text-gray-400 py-4 text-center">No parent pickup messages today</p>
      )}
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {requests.map((r) => (
          <div key={r.id} className="p-3 rounded-xl border border-gray-100 bg-gray-50/80 text-sm">
            <p className="font-semibold">
              {r.student?.first_name} {r.student?.last_name}
            </p>
            <p className="text-gray-700 mt-1">
              Today, <strong>{r.pickup_person_name}</strong> will pick up
              {r.pickup_person_phone && ` · ${r.pickup_person_phone}`}
            </p>
            {r.message && <p className="text-xs text-gray-500 mt-1">{r.message}</p>}
            <p className="text-[10px] text-gray-400 mt-1">{formatDateTimeLagos(r.created_at)}</p>
            {r.status === 'pending' && (
              <button type="button" onClick={() => acknowledge(r.id)} className="btn-secondary text-xs mt-2 py-1.5">
                Acknowledge
              </button>
            )}
            {r.status !== 'pending' && (
              <span className="text-[10px] text-emerald-600 font-semibold uppercase">{r.status}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
