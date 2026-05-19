'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { SchoolClass } from '@/lib/types';
import { Plus, Trash2, GripVertical, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  schoolId: string;
  onComplete: () => void;
}

export function SetupClasses({ schoolId, onComplete }: Props) {
  const [classes, setClasses] = useState<Partial<SchoolClass>[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchExisting();
  }, []);

  const fetchExisting = async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('school_classes')
      .select('*')
      .eq('school_id', schoolId)
      .eq('is_active', true)
      .order('sort_order');

    if (data && data.length > 0) {
      setClasses(data);
    } else {
      // Start with one empty row
      setClasses([{ name: '', grade: '', section: '', sort_order: 0 }]);
    }
  };

  const addRow = () => {
    setClasses(prev => [...prev, { name: '', grade: '', section: '', sort_order: prev.length }]);
  };

  const removeRow = (idx: number) => {
    setClasses(prev => prev.filter((_, i) => i !== idx));
  };

  const updateRow = (idx: number, field: string, value: string) => {
    setClasses(prev => prev.map((c, i) => i === idx ? { ...c, [field]: value } : c));
  };

  const handleSave = async () => {
    const validClasses = classes.filter(c => c.name?.trim());
    if (validClasses.length === 0) {
      toast.error('Add at least one class');
      return;
    }

    setSaving(true);
    const supabase = createClient();

    // Delete existing and re-insert
    await supabase.from('school_classes').delete().eq('school_id', schoolId);

    const { error } = await supabase.from('school_classes').insert(
      validClasses.map((c, idx) => ({
        school_id: schoolId,
        name: c.name!.trim(),
        grade: c.grade?.trim() || c.name!.trim(),
        section: c.section?.trim() || null,
        sort_order: idx,
        is_active: true,
      }))
    );

    if (error) {
      toast.error('Failed to save classes');
      setSaving(false);
      return;
    }

    toast.success(`${validClasses.length} classes saved`);
    setSaving(false);
    onComplete();
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900">Define Your Classes</h2>
        <p className="text-sm text-gray-500 mt-1">
          Add all the classes in your school. Students and teachers will be assigned to these classes.
          Use whatever naming convention your school uses.
        </p>
      </div>

      <div className="card">
        {/* Header */}
        <div className="grid grid-cols-12 gap-3 mb-3 px-2">
          <div className="col-span-1" />
          <div className="col-span-4">
            <label className="text-xs font-medium text-gray-500 uppercase">Class Name</label>
          </div>
          <div className="col-span-3">
            <label className="text-xs font-medium text-gray-500 uppercase">Grade / Level</label>
          </div>
          <div className="col-span-3">
            <label className="text-xs font-medium text-gray-500 uppercase">Section (optional)</label>
          </div>
          <div className="col-span-1" />
        </div>

        {/* Rows */}
        <div className="space-y-2">
          {classes.map((cls, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-3 items-center px-2">
              <div className="col-span-1 flex justify-center">
                <GripVertical size={16} className="text-gray-300" />
              </div>
              <div className="col-span-4">
                <input
                  type="text"
                  value={cls.name || ''}
                  onChange={(e) => updateRow(idx, 'name', e.target.value)}
                  className="input text-sm"
                  placeholder="e.g. JSS 1A, Year 3 Blue"
                />
              </div>
              <div className="col-span-3">
                <input
                  type="text"
                  value={cls.grade || ''}
                  onChange={(e) => updateRow(idx, 'grade', e.target.value)}
                  className="input text-sm"
                  placeholder="e.g. Grade 7"
                />
              </div>
              <div className="col-span-3">
                <input
                  type="text"
                  value={cls.section || ''}
                  onChange={(e) => updateRow(idx, 'section', e.target.value)}
                  className="input text-sm"
                  placeholder="e.g. A, Blue"
                />
              </div>
              <div className="col-span-1 flex justify-center">
                {classes.length > 1 && (
                  <button onClick={() => removeRow(idx)} className="text-gray-400 hover:text-red-500">
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Add button */}
        <button
          onClick={addRow}
          className="mt-4 flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700 font-medium px-2"
        >
          <Plus size={16} />
          Add Another Class
        </button>
      </div>

      {/* Continue */}
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
