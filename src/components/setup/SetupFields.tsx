'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { SchoolCustomField, FieldType, EntityType } from '@/lib/types';
import { Plus, Trash2, ArrowRight, ArrowLeft, Info } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  schoolId: string;
  onComplete: () => void;
}

const FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'select', label: 'Dropdown' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'textarea', label: 'Long Text' },
];

const DEFAULT_STUDENT_FIELDS: Partial<SchoolCustomField>[] = [
  { field_name: 'date_of_birth', field_label: 'Date of Birth', field_type: 'date', is_required: false, sort_order: 0 },
  { field_name: 'gender', field_label: 'Gender', field_type: 'select', options: ['Male', 'Female'], is_required: true, sort_order: 1 },
  { field_name: 'parent_email', field_label: 'Parent Email', field_type: 'email', is_required: true, sort_order: 2 },
  { field_name: 'parent_name', field_label: 'Parent Full Name', field_type: 'text', is_required: true, sort_order: 3 },
  { field_name: 'parent_phone', field_label: 'Parent Phone', field_type: 'phone', is_required: false, sort_order: 4 },
  { field_name: 'relationship', field_label: 'Relationship', field_type: 'select', options: ['Mother', 'Father', 'Guardian'], is_required: true, sort_order: 5 },
];

const DEFAULT_TEACHER_FIELDS: Partial<SchoolCustomField>[] = [
  { field_name: 'phone', field_label: 'Phone Number', field_type: 'phone', is_required: false, sort_order: 0 },
  { field_name: 'subject', field_label: 'Subject', field_type: 'text', is_required: false, sort_order: 1 },
];

export function SetupFields({ schoolId, onComplete }: Props) {
  const [activeTab, setActiveTab] = useState<EntityType>('student');
  const [studentFields, setStudentFields] = useState<Partial<SchoolCustomField>[]>(DEFAULT_STUDENT_FIELDS);
  const [teacherFields, setTeacherFields] = useState<Partial<SchoolCustomField>[]>(DEFAULT_TEACHER_FIELDS);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchExisting();
  }, []);

  const fetchExisting = async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('school_custom_fields')
      .select('*')
      .eq('school_id', schoolId)
      .eq('is_active', true)
      .order('sort_order');

    if (data && data.length > 0) {
      setStudentFields(data.filter(f => f.entity_type === 'student'));
      setTeacherFields(data.filter(f => f.entity_type === 'teacher'));
    }
  };

  const getFields = () => activeTab === 'student' ? studentFields : teacherFields;
  const setFields = (fields: Partial<SchoolCustomField>[]) => {
    if (activeTab === 'student') setStudentFields(fields);
    else setTeacherFields(fields);
  };

  const addField = () => {
    const fields = getFields();
    setFields([...fields, {
      field_name: '',
      field_label: '',
      field_type: 'text',
      is_required: false,
      options: null,
      sort_order: fields.length,
    }]);
  };

  const removeField = (idx: number) => {
    setFields(getFields().filter((_, i) => i !== idx));
  };

  const updateField = (idx: number, key: string, value: any) => {
    setFields(getFields().map((f, i) => i === idx ? { ...f, [key]: value } : f));
  };

  const handleSave = async () => {
    setSaving(true);
    const supabase = createClient();

    // Delete existing
    await supabase.from('school_custom_fields').delete().eq('school_id', schoolId);

    // Insert all fields
    const allFields = [
      ...studentFields.filter(f => f.field_label?.trim()).map((f, idx) => ({
        school_id: schoolId,
        entity_type: 'student' as EntityType,
        field_name: f.field_name || f.field_label!.toLowerCase().replace(/\s+/g, '_'),
        field_label: f.field_label!.trim(),
        field_type: f.field_type || 'text',
        options: f.options && f.options.length > 0 ? f.options : null,
        is_required: f.is_required || false,
        placeholder: f.placeholder || null,
        sort_order: idx,
        is_active: true,
      })),
      ...teacherFields.filter(f => f.field_label?.trim()).map((f, idx) => ({
        school_id: schoolId,
        entity_type: 'teacher' as EntityType,
        field_name: f.field_name || f.field_label!.toLowerCase().replace(/\s+/g, '_'),
        field_label: f.field_label!.trim(),
        field_type: f.field_type || 'text',
        options: f.options && f.options.length > 0 ? f.options : null,
        is_required: f.is_required || false,
        placeholder: f.placeholder || null,
        sort_order: idx,
        is_active: true,
      })),
    ];

    const { error } = await supabase.from('school_custom_fields').insert(allFields);

    if (error) {
      toast.error('Failed to save fields');
      setSaving(false);
      return;
    }

    toast.success('Custom fields saved');
    setSaving(false);
    onComplete();
  };

  const fields = getFields();

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900">Define Data Fields</h2>
        <p className="text-sm text-gray-500 mt-1">
          Choose what information you want to collect when adding students and teachers.
          First name, last name, and email are always collected. Add any extra fields your school needs.
        </p>
      </div>

      {/* Info box */}
      <div className="mb-4 p-4 rounded-xl bg-blue-50 border border-blue-100 flex items-start gap-3">
        <Info size={18} className="text-blue-600 shrink-0 mt-0.5" />
        <p className="text-sm text-blue-800">
          We have pre-filled common fields. You can add, remove, or modify them to match your school's needs.
          For dropdown fields, separate options with commas.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-4">
        <button
          onClick={() => setActiveTab('student')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'student' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'
          }`}
        >
          Student Fields ({studentFields.length})
        </button>
        <button
          onClick={() => setActiveTab('teacher')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'teacher' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'
          }`}
        >
          Teacher Fields ({teacherFields.length})
        </button>
      </div>

      {/* Fields list */}
      <div className="card space-y-3">
        {fields.map((field, idx) => (
          <div key={idx} className="grid grid-cols-12 gap-3 items-start p-3 rounded-lg bg-gray-50">
            <div className="col-span-3">
              <label className="text-xs text-gray-500 mb-1 block">Label</label>
              <input
                type="text"
                value={field.field_label || ''}
                onChange={(e) => updateField(idx, 'field_label', e.target.value)}
                className="input text-sm"
                placeholder="e.g. Blood Type"
              />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-gray-500 mb-1 block">Type</label>
              <select
                value={field.field_type || 'text'}
                onChange={(e) => updateField(idx, 'field_type', e.target.value)}
                className="input text-sm"
              >
                {FIELD_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div className="col-span-4">
              {field.field_type === 'select' ? (
                <>
                  <label className="text-xs text-gray-500 mb-1 block">Options (comma separated)</label>
                  <input
                    type="text"
                    value={(field.options || []).join(', ')}
                    onChange={(e) => updateField(idx, 'options', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                    className="input text-sm"
                    placeholder="Option 1, Option 2, Option 3"
                  />
                </>
              ) : (
                <>
                  <label className="text-xs text-gray-500 mb-1 block">Placeholder</label>
                  <input
                    type="text"
                    value={field.placeholder || ''}
                    onChange={(e) => updateField(idx, 'placeholder', e.target.value)}
                    className="input text-sm"
                    placeholder="Hint text..."
                  />
                </>
              )}
            </div>
            <div className="col-span-2 flex items-end gap-2 pb-1">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={field.is_required || false}
                  onChange={(e) => updateField(idx, 'is_required', e.target.checked)}
                  className="rounded border-gray-300"
                />
                <span className="text-xs text-gray-600">Required</span>
              </label>
            </div>
            <div className="col-span-1 flex items-end justify-center pb-1">
              <button onClick={() => removeField(idx)} className="text-gray-400 hover:text-red-500">
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}

        <button
          onClick={addField}
          className="flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700 font-medium"
        >
          <Plus size={16} />
          Add Field
        </button>
      </div>

      {/* Navigation */}
      <div className="mt-6 flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-primary flex items-center gap-2 px-6 py-3"
        >
          {saving ? 'Saving...' : 'Save & Continue'}
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}
