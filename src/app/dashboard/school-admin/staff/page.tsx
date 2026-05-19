'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { UserProfile, UserSchoolRole } from '@/lib/types';
import { Plus, Users, GraduationCap, Trash2, Shield } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

interface StaffMember {
  profile: UserProfile;
  role: UserSchoolRole;
}

export default function StaffManagementPage() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [schoolId, setSchoolId] = useState('');

  useEffect(() => {
    fetchStaff();
  }, []);

  const fetchStaff = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: adminRole } = await supabase
      .from('user_school_roles')
      .select('school_id')
      .eq('user_id', user.id)
      .eq('role', 'school_admin')
      .single();

    if (!adminRole) return;
    setSchoolId(adminRole.school_id);

    // Get all staff roles for this school (excluding parents)
    const { data: roles } = await supabase
      .from('user_school_roles')
      .select('*, profile:user_profiles(*)')
      .eq('school_id', adminRole.school_id)
      .in('role', ['school_admin', 'teacher', 'gate_officer'])
      .eq('is_active', true);

    if (roles) {
      const staffList: StaffMember[] = roles.map((r: any) => ({
        profile: r.profile,
        role: r,
      }));
      setStaff(staffList);
    }
    setLoading(false);
  };

  const handleRemoveStaff = async (roleId: string) => {
    if (!confirm('Remove this staff member from the school?')) return;

    const supabase = createClient();
    await supabase
      .from('user_school_roles')
      .update({ is_active: false })
      .eq('id', roleId);

    setStaff(prev => prev.filter(s => s.role.id !== roleId));
    toast.success('Staff member removed');
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'school_admin': return 'bg-purple-100 text-purple-700';
      case 'teacher': return 'bg-blue-100 text-blue-700';
      case 'gate_officer': return 'bg-orange-100 text-orange-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-primary-600">Loading staff...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Staff Management ({staff.length})</h1>
            <p className="text-sm text-gray-500">Manage teachers and gate officers</p>
          </div>
          <button onClick={() => setShowAddModal(true)} className="btn-primary flex items-center gap-1 text-sm">
            <Plus size={16} />
            Add Staff
          </button>
        </div>
      </header>

      <main className="p-4 max-w-4xl mx-auto">
        <div className="space-y-3">
          {staff.map(({ profile, role }) => (
            <div key={role.id} className="card flex items-center gap-4 py-4">
              <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-sm">
                {profile.full_name?.split(' ').map(n => n[0]).join('') || '?'}
              </div>
              <div className="flex-1">
                <p className="font-medium">{profile.full_name}</p>
                <p className="text-sm text-gray-500">{profile.email}</p>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full font-medium capitalize ${getRoleBadgeColor(role.role)}`}>
                {role.role.replace('_', ' ')}
              </span>
              <button
                onClick={() => handleRemoveStaff(role.id)}
                className="text-gray-400 hover:text-red-600 transition-colors"
                title="Remove staff"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}

          {staff.length === 0 && (
            <div className="card text-center text-gray-500 py-8">
              No staff members yet. Add teachers and gate officers.
            </div>
          )}
        </div>
      </main>

      {/* Add Staff Modal */}
      {showAddModal && (
        <AddStaffModal
          schoolId={schoolId}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => { setShowAddModal(false); fetchStaff(); }}
        />
      )}
    </div>
  );
}

// ============ ADD STAFF MODAL ============
function AddStaffModal({ schoolId, onClose, onSuccess }: {
  schoolId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<'teacher' | 'gate_officer'>('teacher');
  const [className, setClassName] = useState('');
  const [grade, setGrade] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/staff/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          full_name: fullName,
          phone,
          role,
          school_id: schoolId,
          class_name: role === 'teacher' ? className : undefined,
          grade: role === 'teacher' ? grade : undefined,
        }),
      });

      const result = await response.json();
      if (result.success) {
        toast.success(`${fullName} added as ${role.replace('_', ' ')}`);
        onSuccess();
      } else {
        toast.error(result.error || 'Failed to add staff');
      }
    } catch {
      toast.error('Failed to add staff member');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-md p-6">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Shield size={20} className="text-primary-600" />
          Add Staff Member
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
              placeholder="staff@email.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="input"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="input"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <select value={role} onChange={(e) => setRole(e.target.value as any)} className="input">
              <option value="teacher">Teacher</option>
              <option value="gate_officer">Gate Officer</option>
            </select>
          </div>

          {role === 'teacher' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Class</label>
                <input
                  type="text"
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                  className="input"
                  placeholder="e.g. JSS 1A"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Grade</label>
                <input
                  type="text"
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                  className="input"
                  placeholder="e.g. Grade 7"
                />
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn-primary flex-1">
              {loading ? 'Adding...' : 'Add Staff'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
