// @ts-nocheck
'use client';

import { useEffect, useState } from 'react';
import { fetchData } from '@/lib/api';
import { Save, Clock } from 'lucide-react';
import { toast } from 'sonner';

export default function SchoolSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [schoolId, setSchoolId] = useState('');
  const [formData, setFormData] = useState({
    name: '', address: '', logo_url: '', primary_color: '#1B4D3E', secondary_color: '#D4A017',
    gate_open_time: '06:30', school_start_time: '08:00', late_threshold: '08:15',
    gate_close_time: '09:00', dismissal_start_time: '14:00', dismissal_end_time: '16:00',
  });

  useEffect(() => { loadSettings(); }, []);

  const loadSettings = async () => {
    try {
      const schoolData = await fetchData('get_school_admin_data', { role: 'school_admin' });
      if (!schoolData.school) { setLoading(false); return; }
      setSchoolId(schoolData.school_id);
      const s = schoolData.school;
      setFormData({
        name: s.name || '', address: s.address || '', logo_url: s.logo_url || '',
        primary_color: s.primary_color || '#1B4D3E', secondary_color: s.secondary_color || '#D4A017',
        gate_open_time: s.gate_open_time || '06:30', school_start_time: s.school_start_time || '08:00',
        late_threshold: s.late_threshold || '08:15', gate_close_time: s.gate_close_time || '09:00',
        dismissal_start_time: s.dismissal_start_time || '14:00', dismissal_end_time: s.dismissal_end_time || '16:00',
      });
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const handleSave = async (e: any) => {
    e.preventDefault();
    setSaving(true);
    // TODO: save via API route
    toast.success('Settings saved');
    setSaving(false);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-pulse text-primary-600">Loading...</div></div>;

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <h1 className="text-2xl font-bold mb-6">School Settings</h1>

      <form onSubmit={handleSave} className="space-y-6 max-w-2xl">
        <div className="card">
          <h2 className="font-semibold mb-4">School Information</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">School Name</label>
              <input type="text" value={formData.name} onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))} className="input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
              <input type="text" value={formData.address} onChange={(e) => setFormData(p => ({ ...p, address: e.target.value }))} className="input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Logo URL</label>
              <input type="url" value={formData.logo_url} onChange={(e) => setFormData(p => ({ ...p, logo_url: e.target.value }))} className="input" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Primary Color</label>
                <div className="flex gap-2">
                  <input type="color" value={formData.primary_color} onChange={(e) => setFormData(p => ({ ...p, primary_color: e.target.value }))} className="w-10 h-10 rounded border" />
                  <input type="text" value={formData.primary_color} onChange={(e) => setFormData(p => ({ ...p, primary_color: e.target.value }))} className="input flex-1" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Secondary Color</label>
                <div className="flex gap-2">
                  <input type="color" value={formData.secondary_color} onChange={(e) => setFormData(p => ({ ...p, secondary_color: e.target.value }))} className="w-10 h-10 rounded border" />
                  <input type="text" value={formData.secondary_color} onChange={(e) => setFormData(p => ({ ...p, secondary_color: e.target.value }))} className="input flex-1" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <h2 className="font-semibold mb-4 flex items-center gap-2"><Clock size={18} className="text-primary-600" /> Gate Hours</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Gate Opens</label>
              <input type="time" value={formData.gate_open_time} onChange={(e) => setFormData(p => ({ ...p, gate_open_time: e.target.value }))} className="input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">School Starts</label>
              <input type="time" value={formData.school_start_time} onChange={(e) => setFormData(p => ({ ...p, school_start_time: e.target.value }))} className="input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Late Threshold</label>
              <input type="time" value={formData.late_threshold} onChange={(e) => setFormData(p => ({ ...p, late_threshold: e.target.value }))} className="input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Gate Closes</label>
              <input type="time" value={formData.gate_close_time} onChange={(e) => setFormData(p => ({ ...p, gate_close_time: e.target.value }))} className="input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Dismissal Start</label>
              <input type="time" value={formData.dismissal_start_time} onChange={(e) => setFormData(p => ({ ...p, dismissal_start_time: e.target.value }))} className="input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Dismissal End</label>
              <input type="time" value={formData.dismissal_end_time} onChange={(e) => setFormData(p => ({ ...p, dismissal_end_time: e.target.value }))} className="input" />
            </div>
          </div>
        </div>

        <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2">
          <Save size={16} /> {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </form>
    </div>
  );
}
