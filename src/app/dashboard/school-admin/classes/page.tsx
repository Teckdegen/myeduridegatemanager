// @ts-nocheck
'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Plus, Users, GraduationCap, ChevronRight, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

interface ClassGroup {
  class_name: string;
  grade: string;
  student_count: number;
  teacher_name: string | null;
  teacher_id: string | null;
}

export default function ClassesPage() {
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [schoolId, setSchoolId] = useState('');

  useEffect(() => {
    fetchClasses();
  }, []);

  const fetchClasses = async () => {
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
    setSchoolId(role.school_id);

    // Get all students grouped by class
    const { data: students } = await supabase
      .from('students')
      .select('class_name, grade')
      .eq('school_id', role.school_id)
      .eq('is_active', true);

    // Get teacher assignments
    const { data: teacherClasses } = await supabase
      .from('teacher_classes')
      .select('class_name, grade, teacher:user_profiles!teacher_user_id(id, full_name)')
      .eq('school_id', role.school_id);

    if (students) {
      // Group students by class
      const classMap = new Map<string, { grade: string; count: number }>();
      for (const s of students) {
        const key = s.class_name;
        if (classMap.has(key)) {
          classMap.get(key)!.count++;
        } else {
          classMap.set(key, { grade: s.grade, count: 1 });
        }
      }

      // Merge with teacher data
      const classGroups: ClassGroup[] = Array.from(classMap.entries()).map(([className, data]) => {
        const teacherAssignment = teacherClasses?.find((tc: any) => tc.class_name === className);
        return {
          class_name: className,
          grade: data.grade,
          student_count: data.count,
          teacher_name: (teacherAssignment as any)?.teacher?.full_name || null,
          teacher_id: (teacherAssignment as any)?.teacher?.id || null,
        };
      });

      classGroups.sort((a, b) => a.class_name.localeCompare(b.class_name));
      setClasses(classGroups);
    }

    setLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-primary-600">Loading classes...</div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Classes</h1>
          <p className="text-sm text-gray-500">{classes.length} classes configured</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="btn-primary flex items-center gap-2 text-sm"
        >
          <Plus size={16} />
          Add Class
        </button>
      </div>

      {/* Classes grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {classes.map(cls => (
          <div key={cls.class_name} className="card hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">{cls.class_name}</h3>
                <p className="text-sm text-gray-500">{cls.grade}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center">
                <Users size={18} className="text-primary-600" />
              </div>
            </div>

            <div className="space-y-3">
              {/* Student count */}
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                  <Users size={14} className="text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">{cls.student_count} Students</p>
                </div>
              </div>

              {/* Teacher */}
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center">
                  <GraduationCap size={14} className="text-green-600" />
                </div>
                <div>
                  {cls.teacher_name ? (
                    <p className="text-sm font-medium text-gray-700">{cls.teacher_name}</p>
                  ) : (
                    <p className="text-sm text-gray-400 italic">No teacher assigned</p>
                  )}
                </div>
              </div>
            </div>

            <Link
              href={`/dashboard/school-admin/classes/${encodeURIComponent(cls.class_name)}`}
              className="mt-4 flex items-center justify-between pt-4 border-t text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              View Students
              <ChevronRight size={16} />
            </Link>
          </div>
        ))}

        {classes.length === 0 && (
          <div className="col-span-full card text-center py-12">
            <Users size={32} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">No classes yet. Add students to create classes automatically.</p>
          </div>
        )}
      </div>

      {/* Add Class Modal */}
      {showAddModal && (
        <AddClassModal
          schoolId={schoolId}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => { setShowAddModal(false); fetchClasses(); }}
        />
      )}
    </div>
  );
}

function AddClassModal({ schoolId, onClose, onSuccess }: {
  schoolId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [className, setClassName] = useState('');
  const [grade, setGrade] = useState('');
  const [teacherEmail, setTeacherEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const supabase = createClient();

    // If teacher email provided, assign them
    if (teacherEmail) {
      const { data: teacher } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('email', teacherEmail)
        .single();

      if (teacher) {
        await supabase.from('teacher_classes').upsert({
          teacher_user_id: teacher.id,
          school_id: schoolId,
          class_name: className,
          grade,
        }, { onConflict: 'teacher_user_id,school_id,class_name' });
      } else {
        toast.error('Teacher not found. Add them as staff first.');
        setLoading(false);
        return;
      }
    }

    toast.success(`Class "${className}" created`);
    setLoading(false);
    onSuccess();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-md p-6">
        <h2 className="text-xl font-bold mb-4">Add New Class</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Class Name</label>
            <input
              type="text"
              value={className}
              onChange={(e) => setClassName(e.target.value)}
              className="input"
              placeholder="e.g. JSS 1A"
              required
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
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Assign Teacher (optional)</label>
            <input
              type="email"
              value={teacherEmail}
              onChange={(e) => setTeacherEmail(e.target.value)}
              className="input"
              placeholder="teacher@email.com"
            />
            <p className="text-xs text-gray-400 mt-1">Teacher must already be added as staff</p>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn-primary flex-1">
              {loading ? 'Creating...' : 'Create Class'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

