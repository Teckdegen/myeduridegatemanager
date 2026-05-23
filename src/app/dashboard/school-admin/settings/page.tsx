// @ts-nocheck
'use client';

import { useCallback, useEffect, useState } from 'react';
import { fetchData } from '@/lib/api';
import { Save, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { schoolToSettingsForm } from '@/lib/time-input';

export default function SchoolSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [schoolId, setSchoolId] = useState('');
  const [formData, setFormData] = useState(schoolToSettingsForm(null));

  const loadSettings = useCallback(async (id) => {
    const sid = id || schoolId;
    if (!sid) return;
    try {
      const res = await fetch(`/api/schools/settings?school_id=${sid}`, {
        credentials: 'include',
        cache: 'no-store',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load settings');
      setFormData(schoolToSettingsForm(data.school));
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Could not load settings');
    }
  }, [schoolId]);

  useEffect(() => {
    (async () => {
      try {
        const schoolData = await fetchData('get_school_admin_data', { role: 'school_admin' });
        if (!schoolData.school_id) {
          setLoading(false);
          return;
        }
        setSchoolId(schoolData.school_id);
        await loadSettings(schoolData.school_id);
      } catch (err) {
        console.error(err);
      }
      setLoading(false);
    })();
  }, [loadSettings]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!schoolId) {
      toast.error('School not loaded — refresh the page');
      return;
    }
    if (!formData.name.trim()) {
      toast.error('School name is required');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/schools/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        cache: 'no-store',
        body: JSON.stringify({ school_id: schoolId, ...formData }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      if (data.school) {
        setFormData(schoolToSettingsForm(data.school));
      } else {
        await loadSettings(schoolId);
      }
      toast.success('Settings saved');
    } catch (err) {
      toast.error(err.message || 'Could not save settings');
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-primary-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen pt-14 md:pt-6">
      <h1 className="text-2xl font-bold mb-6">School Settings</h1>

      <form onSubmit={handleSave} className="space-y-6 max-w-2xl">
        <div className="card">
          <h2 className="font-semibold mb-4">School Information</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">School Name</label>
              <input type="text" value={formData.name} onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))} className="input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
              <input type="text" value={formData.address} onChange={(e) => setFormData((p) => ({ ...p, address: e.target.value }))} className="input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Logo URL</label>
              <input type="url" value={formData.logo_url} onChange={(e) => setFormData((p) => ({ ...p, logo_url: e.target.value }))} className="input" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Primary Color</label>
                <div className="flex gap-2">
                  <input type="color" value={formData.primary_color} onChange={(e) => setFormData((p) => ({ ...p, primary_color: e.target.value }))} className="w-10 h-10 rounded border" />
                  <input type="text" value={formData.primary_color} onChange={(e) => setFormData((p) => ({ ...p, primary_color: e.target.value }))} className="input flex-1" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Secondary Color</label>
                <div className="flex gap-2">
                  <input type="color" value={formData.secondary_color} onChange={(e) => setFormData((p) => ({ ...p, secondary_color: e.target.value }))} className="w-10 h-10 rounded border" />
                  <input type="text" value={formData.secondary_color} onChange={(e) => setFormData((p) => ({ ...p, secondary_color: e.target.value }))} className="input flex-1" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <Clock size={18} className="text-primary-600" /> Gate Hours (Lagos)
          </h2>
          <p className="text-xs text-gray-500 mb-4">Used for late marking and gate rules. Changes apply immediately after save.</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Gate Opens</label>
              <input type="time" value={formData.gate_open_time} onChange={(e) => setFormData((p) => ({ ...p, gate_open_time: e.target.value }))} className="input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">School Starts</label>
              <input type="time" value={formData.school_start_time} onChange={(e) => setFormData((p) => ({ ...p, school_start_time: e.target.value }))} className="input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Late Threshold</label>
              <input type="time" value={formData.late_threshold} onChange={(e) => setFormData((p) => ({ ...p, late_threshold: e.target.value }))} className="input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Gate Closes</label>
              <input type="time" value={formData.gate_close_time} onChange={(e) => setFormData((p) => ({ ...p, gate_close_time: e.target.value }))} className="input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Dismissal Start</label>
              <input type="time" value={formData.dismissal_start_time} onChange={(e) => setFormData((p) => ({ ...p, dismissal_start_time: e.target.value }))} className="input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Dismissal End</label>
              <input type="time" value={formData.dismissal_end_time} onChange={(e) => setFormData((p) => ({ ...p, dismissal_end_time: e.target.value }))} className="input" />
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
