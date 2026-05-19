'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { School } from '@/lib/types';
import { ArrowLeft, Save, Clock } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

export default function SchoolSettingsPage() {
  const [school, setSchool] = useState<School | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    logo_url: '',
    primary_color: '#1B4D3E',
    secondary_color: '#D4A017',
    gate_open_time: '06:30',
    school_start_time: '08:00',
    late_threshold: '08:15',
    gate_close_time: '09:00',
    dismissal_start_time: '14:00',
    dismissal_end_time: '16:00',
  });

  useEffect(() => {
    fetchSchool();
  }, []);

  const fetchSchool = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: role } = await supabase
      .from('user_school_roles')
      .select('school_id')
      .eq('user_id', user.id)
      .eq('role', 'school_admin')
      .single();

    if (!role) return;

    const { data: schoolData } = await supabase
      .from('schools')
      .select('*')
      .eq('id', role.school_id)
      .single();

    if (schoolData) {
      setSchool(schoolData);
      setFormData({
        name: schoolData.name || '',
        address: schoolData.address || '',
        logo_url: schoolData.logo_url || '',
        primary_color: schoolData.primary_color || '#1B4D3E',
        secondary_color: schoolData.secondary_color || '#D4A017',
        gate_open_time: schoolData.gate_open_time || '06:30',
        school_start_time: schoolData.school_start_time || '08:00',
        late_threshold: schoolData.late_threshold || '08:15',
        gate_close_time: schoolData.gate_close_time || '09:00',
        dismissal_start_time: schoolData.dismissal_start_time || '14:00',
        dismissal_end_time: schoolData.dismissal_end_time || '16:00',
      });
    }
    setLoading(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!school) return;
    setSaving(true);

    const supabase = createClient();
    const { error } = await supabase
      .from('schools')
      .update({
        name: formData.name,
        address: formData.address,
        logo_url: formData.logo_url || null,
        primary_color: formData.primary_color,
        secondary_color: formData.secondary_color,
        gate_open_time: formData.gate_open_time,
        school_start_time: formData.school_start_time,
        late_threshold: formData.late_threshold,
        gate_close_time: formData.gate_close_time,
        dismissal_start_time: formData.dismissal_start_time,
        dismissal_end_time: formData.dismissal_end_time,
      })
      .eq('id', school.id);

    if (error) {
      toast.error('Failed to save settings');
    } else {
      toast.success('Settings saved successfully');
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-primary-600">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-4 py-4">
        <Link href="/dashboard/school-admin" className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-2">
          <ArrowLeft size={18} />
          Back to Dashboard
        </Link>
        <h1 className="text-xl font-bold">School Settings</h1>
      </header>

      <main className="p-4 max-w-2xl mx-auto">
        <form onSubmit={handleSave} className="space-y-6">
          {/* School Info */}
          <div className="card">
            <h2 className="font-semibold mb-4">School Information</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">School Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="input"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <textarea
                  value={formData.address}
                  onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                  className="input"
                  rows={2}
                />
              </div>
            </div>
          </div>

          {/* School Branding */}
          <div className="card">
            <h2 className="font-semibold mb-4">School Branding</h2>
            <p className="text-sm text-gray-500 mb-4">
              Your school colors and logo appear on parent notifications, ID cards, and the gate interface.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Logo URL</label>
                <input
                  type="url"
                  value={formData.logo_url}
                  onChange={(e) => setFormData(prev => ({ ...prev, logo_url: e.target.value }))}
                  className="input"
                  placeholder="https://your-school.com/logo.png"
                />
                {formData.logo_url && (
                  <div className="mt-2 p-3 bg-gray-50 rounded-lg inline-block">
                    <img src={formData.logo_url} alt="Logo preview" className="h-12 object-contain" />
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Primary Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={formData.primary_color}
                      onChange={(e) => setFormData(prev => ({ ...prev, primary_color: e.target.value }))}
                      className="w-10 h-10 rounded-lg border cursor-pointer"
                    />
                    <input
                      type="text"
                      value={formData.primary_color}
                      onChange={(e) => setFormData(prev => ({ ...prev, primary_color: e.target.value }))}
                      className="input flex-1"
                      placeholder="#1B4D3E"
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Used for headers, buttons, accents</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Secondary Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={formData.secondary_color}
                      onChange={(e) => setFormData(prev => ({ ...prev, secondary_color: e.target.value }))}
                      className="w-10 h-10 rounded-lg border cursor-pointer"
                    />
                    <input
                      type="text"
                      value={formData.secondary_color}
                      onChange={(e) => setFormData(prev => ({ ...prev, secondary_color: e.target.value }))}
                      className="input flex-1"
                      placeholder="#D4A017"
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Used for highlights, badges</p>
                </div>
              </div>
              {/* Preview */}
              <div className="p-4 rounded-xl border" style={{ borderColor: formData.primary_color }}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 rounded-lg" style={{ backgroundColor: formData.primary_color }} />
                  <div className="w-8 h-8 rounded-lg" style={{ backgroundColor: formData.secondary_color }} />
                  <span className="text-sm text-gray-500">Color Preview</span>
                </div>
                <div className="p-3 rounded-lg text-white text-sm font-medium" style={{ backgroundColor: formData.primary_color }}>
                  {formData.name || 'School Name'} — Notification Header
                </div>
              </div>
            </div>
          </div>

          {/* Gate Hours */}
          <div className="card">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <Clock size={18} className="text-primary-600" />
              Gate Hours Configuration
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              These times determine when students are marked as "on time" or "late" and when the gate is active.
            </p>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Gate Opens</label>
                <input
                  type="time"
                  value={formData.gate_open_time}
                  onChange={(e) => setFormData(prev => ({ ...prev, gate_open_time: e.target.value }))}
                  className="input"
                />
                <p className="text-xs text-gray-400 mt-1">When gate officer can start session</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">School Starts</label>
                <input
                  type="time"
                  value={formData.school_start_time}
                  onChange={(e) => setFormData(prev => ({ ...prev, school_start_time: e.target.value }))}
                  className="input"
                />
                <p className="text-xs text-gray-400 mt-1">Official school start time</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Late Threshold</label>
                <input
                  type="time"
                  value={formData.late_threshold}
                  onChange={(e) => setFormData(prev => ({ ...prev, late_threshold: e.target.value }))}
                  className="input"
                />
                <p className="text-xs text-gray-400 mt-1">After this time = marked late</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Gate Closes</label>
                <input
                  type="time"
                  value={formData.gate_close_time}
                  onChange={(e) => setFormData(prev => ({ ...prev, gate_close_time: e.target.value }))}
                  className="input"
                />
                <p className="text-xs text-gray-400 mt-1">Morning gate session ends</p>
              </div>
            </div>
          </div>

          {/* Dismissal Hours */}
          <div className="card">
            <h2 className="font-semibold mb-4">Dismissal Window</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Dismissal Starts</label>
                <input
                  type="time"
                  value={formData.dismissal_start_time}
                  onChange={(e) => setFormData(prev => ({ ...prev, dismissal_start_time: e.target.value }))}
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Dismissal Ends</label>
                <input
                  type="time"
                  value={formData.dismissal_end_time}
                  onChange={(e) => setFormData(prev => ({ ...prev, dismissal_end_time: e.target.value }))}
                  className="input"
                />
              </div>
            </div>
          </div>

          {/* Save button */}
          <button type="submit" disabled={saving} className="btn-primary w-full py-3 flex items-center justify-center gap-2">
            <Save size={18} />
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </form>
      </main>
    </div>
  );
}
