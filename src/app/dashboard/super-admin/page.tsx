'use client';

import { useEffect, useState } from 'react';
import type { School } from '@/lib/types';
import { Building2, Users, Plus, Search, Settings, BarChart3, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface SchoolWithStats extends School {
  student_count: number;
  staff_count: number;
}

export default function SuperAdminDashboard() {
  const [schools, setSchools] = useState<SchoolWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [totalStats, setTotalStats] = useState({ schools: 0, students: 0, staff: 0 });

  useEffect(() => {
    fetchSchools();
  }, []);

  const fetchSchools = async () => {
    try {
      const res = await fetch('/api/schools/list');
      const data = await res.json();

      if (!res.ok || !data.schools) {
        setLoading(false);
        return;
      }

      const schoolsWithStats = data.schools;
      setSchools(schoolsWithStats);
      setTotalStats({
        schools: schoolsWithStats.length,
        students: schoolsWithStats.reduce((sum: number, s: any) => sum + s.student_count, 0),
        staff: schoolsWithStats.reduce((sum: number, s: any) => sum + s.staff_count, 0),
      });
    } catch (err) {
      console.error('Failed to fetch schools:', err);
    }
    setLoading(false);
  };

  const handleDeleteSchool = async (schoolId: string, schoolName: string) => {
    if (!confirm(`Are you sure you want to delete "${schoolName}"? This will remove all associated data.`)) return;

    const res = await fetch(`/api/schools/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ school_id: schoolId }),
    });

    if (res.ok) {
      setSchools(prev => prev.filter(s => s.id !== schoolId));
      toast.success(`${schoolName} deleted`);
    } else {
      toast.error('Failed to delete school');
    }
  };

  const filteredSchools = schools.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.address || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-primary-600">Loading schools...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="p-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Platform Overview</h1>
            <p className="text-sm text-gray-500">Manage all schools across MyEduRide</p>
          </div>
        </div>
        {/* Platform stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="card flex items-center gap-4 py-5">
            <div className="w-12 h-12 rounded-xl bg-primary-50 flex items-center justify-center">
              <Building2 size={22} className="text-primary-600" />
            </div>
            <div>
              <p className="text-3xl font-bold">{totalStats.schools}</p>
              <p className="text-sm text-gray-500">Schools</p>
            </div>
          </div>
          <div className="card flex items-center gap-4 py-5">
            <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center">
              <Users size={22} className="text-green-600" />
            </div>
            <div>
              <p className="text-3xl font-bold">{totalStats.students}</p>
              <p className="text-sm text-gray-500">Total Students</p>
            </div>
          </div>
          <div className="card flex items-center gap-4 py-5">
            <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center">
              <BarChart3 size={22} className="text-amber-600" />
            </div>
            <div>
              <p className="text-3xl font-bold">{totalStats.staff}</p>
              <p className="text-sm text-gray-500">Total Staff</p>
            </div>
          </div>
        </div>

        {/* Search + Add */}
        <div className="flex gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search schools..."
              className="input pl-10"
            />
          </div>
          <button onClick={() => setShowAddModal(true)} className="btn-primary flex items-center gap-1">
            <Plus size={16} />
            Add School
          </button>
        </div>

        {/* Schools list */}
        <div className="space-y-3">
          {filteredSchools.map(school => (
            <div key={school.id} className="card flex items-center gap-4 py-4">
              <div className="w-12 h-12 rounded-lg bg-primary-100 flex items-center justify-center text-primary-700 font-bold">
                {school.name.split(' ').map(w => w[0]).join('').slice(0, 2)}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold truncate">{school.name}</h3>
                <p className="text-sm text-gray-500 truncate">{school.address || 'No address'}</p>
              </div>
              <div className="text-center px-4">
                <p className="text-lg font-bold text-primary-600">{school.student_count}</p>
                <p className="text-xs text-gray-500">Students</p>
              </div>
              <div className="text-center px-4">
                <p className="text-lg font-bold text-green-600">{school.staff_count}</p>
                <p className="text-xs text-gray-500">Staff</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleDeleteSchool(school.id, school.name)}
                  className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                  title="Delete school"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}

          {filteredSchools.length === 0 && (
            <div className="card text-center text-gray-500 py-8">
              {searchQuery ? 'No schools match your search' : 'No schools yet. Add your first school.'}
            </div>
          )}
        </div>
      </main>

      {showAddModal && (
        <AddSchoolModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => { setShowAddModal(false); fetchSchools(); }}
        />
      )}
    </div>
  );
}

// ============ ADD SCHOOL MODAL ============
function AddSchoolModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    admin_email: '',
    admin_name: '',
    admin_phone: '',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/schools/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const result = await response.json();
      if (result.success) {
        toast.success(`${formData.name} created with admin ${formData.admin_name}`);
        onSuccess();
      } else {
        toast.error(result.error || 'Failed to create school');
      }
    } catch {
      toast.error('Failed to create school');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-md p-6">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Building2 size={20} className="text-primary-600" />
          Add New School
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">School Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="input"
              placeholder="e.g. Greenfield Academy"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
              className="input"
              placeholder="School address"
            />
          </div>

          <hr className="my-4" />
          <p className="text-sm font-medium text-gray-700">School Admin (first admin for this school)</p>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Admin Email</label>
            <input
              type="email"
              value={formData.admin_email}
              onChange={(e) => setFormData(prev => ({ ...prev, admin_email: e.target.value }))}
              className="input"
              placeholder="admin@school.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Admin Full Name</label>
            <input
              type="text"
              value={formData.admin_name}
              onChange={(e) => setFormData(prev => ({ ...prev, admin_name: e.target.value }))}
              className="input"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Admin Phone</label>
            <input
              type="tel"
              value={formData.admin_phone}
              onChange={(e) => setFormData(prev => ({ ...prev, admin_phone: e.target.value }))}
              className="input"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn-primary flex-1">
              {loading ? 'Creating...' : 'Create School'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
