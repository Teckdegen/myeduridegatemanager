'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { SchoolClass, SchoolCustomField } from '@/lib/types';
import { Plus, Trash2, ArrowRight, UserPlus, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { DynamicFieldInput } from '@/components/shared/DynamicFieldInput';

interface Props {
  schoolId: string;
  onComplete: () => void;
}

interface TeacherEntry {
  email: string;
  full_name: string;
  class_id: string;
  custom_fields: Record<string, any>;
}

export function SetupTeachers({ schoolId, onComplete }: Props) {
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [customFields, setCustomFields] = useState<SchoolCustomField[]>([]);
  const [teachers, setTeachers] = useState<TeacherEntry[]>([{ email: '', full_name: '', class_id: '', custom_fields: {} }]);
  const [saving, setSaving] = useState(false);
  const [addedCount, setAddedCount] = useState(0);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const supabase = createClient();

    const { data: classData } = await supabase
      .from('school_classes')
      .select('*')
      .eq('school_id', schoolId)
      .eq('is_active', true)
      .order('sort_order');

    const { data: fieldData } = await supabase
      .from('school_custom_fields')
      .select('*')
      .eq('school_id', schoolId)
      .eq('entity_type', 'teacher')
      .eq('is_active', true)
      .order('sort_order');

    if (classData) setClasses(classData);
    if (fieldData) setCustomFields(fieldData);
  };

  const addRow = () => {
    setTeachers(prev => [...prev, { email: '', full_name: '', class_id: '', custom_fields: {} }]);
  };

  const removeRow = (idx: number) => {
    setTeachers(prev => prev.filter((_, i) => i !== idx));
  };

  const updateRow = (idx: number, key: string, value: any) => {
    setTeachers(prev => prev.map((t, i) => i === idx ? { ...t, [key]: value } : t));
  };

  const updateCustomField = (idx: number, fieldName: string, value: any) => {
    setTeachers(prev => prev.map((t, i) =>
      i === idx ? { ...t, custom_fields: { ...t.custom_fields, [fieldName]: value } } : t
    ));
  };

  const handleSave = async () => {
    const validTeachers = teachers.filter(t => t.email.trim() && t.full_name.trim());
    if (validTeachers.length === 0) {
      // Allow skipping
      onComplete();
      return;
    }

    setSaving(true);

    for (const teacher of validTeachers) {
      const response = await fetch('/api/staff/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: teacher.email,
          full_name: teacher.full_name,
          phone: teacher.custom_fields.phone || '',
          role: 'teacher',
          school_id: schoolId,
          class_id: teacher.class_id || null,
          custom_fields: teacher.custom_fields,
        }),
      });

      if (response.ok) {
        setAddedCount(prev => prev + 1);
      }
    }

    toast.success(`${validTeachers.length} teachers added`);
    setSaving(false);
    onComplete();
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900">Add Teachers</h2>
        <p className="text-sm text-gray-500 mt-1">
          Add your teachers and assign them to classes. They will receive an email invite to log in.
          You can skip this step and add teachers later.
        </p>
      </div>

      <div className="space-y-4">
        {teachers.map((teacher, idx) => (
          <div key={idx} className="card">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-700">Teacher {idx + 1}</span>
              {teachers.length > 1 && (
                <button onClick={() => removeRow(idx)} className="text-gray-400 hover:text-red-500">
                  <Trash2 size={16} />
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Full Name</label>
                <input
                  type="text"
                  value={teacher.full_name}
                  onChange={(e) => updateRow(idx, 'full_name', e.target.value)}
                  className="input text-sm"
                  placeholder="Teacher's full name"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                <input
                  type="email"
                  value={teacher.email}
                  onChange={(e) => updateRow(idx, 'email', e.target.value)}
                  className="input text-sm"
                  placeholder="teacher@email.com"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Assign to Class(es)</label>
                <select
                  value={teacher.class_id}
                  onChange={(e) => {
                    const selected = Array.from(e.target.selectedOptions, opt => opt.value);
                    updateRow(idx, 'class_id', selected.length === 1 ? selected[0] : selected.join(','));
                  }}
                  className="input text-sm"
                  multiple={false}
                >
                  <option value="">Select class...</option>
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 mt-1">You can assign more classes later</p>
              </div>

              {/* Custom fields */}
              {customFields.map(field => (
                <div key={field.id}>
                  <DynamicFieldInput
                    field={field}
                    value={teacher.custom_fields[field.field_name] || ''}
                    onChange={(value) => updateCustomField(idx, field.field_name, value)}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={addRow}
        className="mt-4 flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700 font-medium"
      >
        <Plus size={16} />
        Add Another Teacher
      </button>

      {/* Navigation */}
      <div className="mt-6 flex items-center justify-between">
        <button
          onClick={onComplete}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          Skip for now
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-primary flex items-center gap-2 px-6 py-3"
        >
          {saving ? 'Adding teachers...' : 'Save & Continue'}
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}
