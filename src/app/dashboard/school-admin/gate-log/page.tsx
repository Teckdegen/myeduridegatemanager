// @ts-nocheck
'use client';

import { useEffect, useState } from 'react';
import { fetchData } from '@/lib/api';
import { DoorOpen, CheckCircle, LogOut as LogOutIcon, Clock, Camera, ScanBarcode } from 'lucide-react';

export default function GateLogPage() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadLog(); }, []);

  const loadLog = async () => {
    try {
      const schoolData = await fetchData('get_school_admin_data', { role: 'school_admin' });
      if (!schoolData.school_id) { setLoading(false); return; }

      const today = new Date().toISOString().split('T')[0];
      const result = await fetchData('query', {
        table: 'attendance_records',
        select: '*, student:students(first_name, last_name, photo_url)',
        filters: { school_id: schoolData.school_id },
        order: { column: 'timestamp', ascending: false },
        limit: 50,
      });
      setRecords(result.data || []);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-pulse text-primary-600">Loading...</div></div>;

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Gate Activity</h1>
        <p className="text-sm text-gray-500">Live feed of gate events</p>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="divide-y">
          {records.map((record: any) => (
            <div key={record.id} className="px-4 py-3 flex items-center gap-4 hover:bg-gray-50">
              <div className="w-14 text-right shrink-0">
                <p className="text-sm font-mono font-medium text-gray-700">
                  {new Date(record.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                record.type === 'arrival' ? 'bg-green-50' : 'bg-orange-50'
              }`}>
                {record.type === 'arrival' ? <CheckCircle size={14} className="text-green-600" /> : <LogOutIcon size={14} className="text-orange-600" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{record.student?.first_name} {record.student?.last_name}</p>
              </div>
              {record.status === 'late' && <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">Late</span>}
            </div>
          ))}
          {records.length === 0 && <div className="py-12 text-center text-gray-400">No gate activity yet</div>}
        </div>
      </div>
    </div>
  );
}
