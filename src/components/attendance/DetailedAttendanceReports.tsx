// @ts-nocheck
'use client';

import { useCallback, useEffect, useState } from 'react';
import { Download, Calendar, BarChart3 } from 'lucide-react';
import { toast } from 'sonner';
import { formatTimeLagos, todayInLagos } from '@/lib/timezone';

const STATUS_LABELS = {
  present: 'Present',
  on_time: 'Present',
  late: 'Late',
  absent: 'Absent',
  dismissed: 'Dismissed',
};

export default function DetailedAttendanceReports({
  schoolId,
  classFilter = null,
  classes = [],
  title = 'Attendance reports',
}) {
  const [reportType, setReportType] = useState('daily');
  const [date, setDate] = useState(todayInLagos());
  const [classId, setClassId] = useState(classFilter || '');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);

  const loadReport = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        school_id: schoolId,
        type: reportType,
        date,
      });
      if (classId) params.set('class_id', classId);
      const res = await fetch(`/api/attendance/reports?${params}`, { credentials: 'include' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load report');
      setData(json);
    } catch (e) {
      toast.error(e.message || 'Could not load report');
      setData(null);
    }
    setLoading(false);
  }, [schoolId, reportType, date, classId]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const exportCsv = async () => {
    if (!schoolId) return;
    try {
      const params = new URLSearchParams({
        school_id: schoolId,
        type: reportType,
        date,
        format: 'csv',
      });
      if (classId) params.set('class_id', classId);
      const res = await fetch(`/api/attendance/reports?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const disp = res.headers.get('Content-Disposition');
      const match = disp?.match(/filename="(.+)"/);
      a.download = match?.[1] || `attendance_${reportType}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('CSV downloaded');
    } catch {
      toast.error('CSV export failed');
    }
  };

  const printPdf = () => {
    window.print();
  };

  return (
    <div className="space-y-4 print-area">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-slate-900">{title}</h2>
        <div className="flex gap-2">
          <button type="button" onClick={exportCsv} className="btn-secondary text-sm flex items-center gap-1.5 py-2">
            <Download size={16} /> CSV
          </button>
          {reportType !== 'daily' && (
            <button type="button" onClick={printPdf} className="btn-secondary text-sm flex items-center gap-1.5 py-2">
              <Download size={16} /> Print / PDF
            </button>
          )}
        </div>
      </div>

      <div className="pill-tabs">
        {['daily', 'weekly', 'monthly'].map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setReportType(t)}
            className={reportType === t ? 'pill-tab-active' : 'pill-tab-inactive'}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">
            {reportType === 'daily' ? 'Date' : reportType === 'weekly' ? 'Week containing' : 'Month'}
          </label>
          <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        {!classFilter && classes.length > 0 && (
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">Class</label>
            <select className="input" value={classId} onChange={(e) => setClassId(e.target.value)}>
              <option value="">All classes</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {loading && <p className="text-sm text-slate-500 animate-pulse">Loading report…</p>}

      {!loading && data?.type === 'daily' && (
        <>
          <div className="grid grid-cols-4 gap-2">
            {[
              ['Total', data.summary?.total],
              ['Present', data.summary?.present],
              ['Late', data.summary?.late],
              ['Absent', data.summary?.absent],
            ].map(([label, val]) => (
              <div key={label} className="card text-center py-3">
                <p className="text-xl font-bold">{val ?? 0}</p>
                <p className="text-[10px] text-slate-500 uppercase">{label}</p>
              </div>
            ))}
          </div>
          <div className="card-elevated overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="text-left px-3 py-2 text-xs text-slate-500">Student</th>
                  <th className="text-left px-3 py-2 text-xs text-slate-500">Class</th>
                  <th className="text-left px-3 py-2 text-xs text-slate-500">Status</th>
                  <th className="text-left px-3 py-2 text-xs text-slate-500">Check-in</th>
                  <th className="text-left px-3 py-2 text-xs text-slate-500">Check-out</th>
                  <th className="text-left px-3 py-2 text-xs text-slate-500">Late (min)</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {(data.report || []).map((r) => (
                  <tr key={r.student_id}>
                    <td className="px-3 py-2 font-medium">{r.first_name} {r.last_name}</td>
                    <td className="px-3 py-2 text-slate-600">{r.class_name}</td>
                    <td className="px-3 py-2">
                      <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded ${
                        r.status === 'absent' ? 'bg-red-50 text-red-700' :
                        r.status === 'late' ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-800'
                      }`}>
                        {STATUS_LABELS[r.status] || r.status}{r.dismissed && r.status !== 'dismissed' ? ' · Released' : ''}
                      </span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{formatTimeLagos(r.check_in_time)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{formatTimeLagos(r.check_out_time)}</td>
                    <td className="px-3 py-2">{r.minutes_late ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {!loading && data && data.type !== 'daily' && (
        <>
          <div className="card p-4 flex items-center gap-3">
            <BarChart3 className="text-primary-600" size={28} />
            <div>
              <p className="text-2xl font-bold">{data.summary?.attendance_pct ?? 0}%</p>
              <p className="text-xs text-slate-500">
                {data.summary?.grand_present} present · {data.summary?.grand_late} late · {data.summary?.grand_absent} absent
                {' '}over {data.summary?.total_days} days
              </p>
            </div>
          </div>
          <h3 className="text-sm font-semibold text-slate-700">By class</h3>
          <div className="grid gap-2">
            {(data.class_breakdown || []).map((c) => (
              <div key={c.class_id} className="card-elevated p-3 flex justify-between items-center">
                <div>
                  <p className="font-semibold">{c.class_name}</p>
                  <p className="text-xs text-slate-500">{c.student_count} students</p>
                </div>
                <p className="text-lg font-bold text-primary-700">{c.attendance_pct}%</p>
              </div>
            ))}
          </div>
          <h3 className="text-sm font-semibold text-slate-700 mt-4">Daily breakdown</h3>
          <div className="card-elevated divide-y max-h-64 overflow-y-auto">
            {(data.daily_summaries || []).map((d) => (
              <div key={d.date} className="flex justify-between px-3 py-2 text-sm">
                <span>{d.date}</span>
                <span className="text-emerald-600">{d.present} in</span>
                <span className="text-amber-600">{d.late} late</span>
                <span className="text-red-500">{d.absent} out</span>
              </div>
            ))}
          </div>
        </>
      )}

      <p className="text-xs text-slate-400">Times shown in West Africa Time (UTC+1, Lagos).</p>
    </div>
  );
}
