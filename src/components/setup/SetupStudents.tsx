'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { SchoolClass, SchoolCustomField } from '@/lib/types';
import { ArrowRight, Upload, Users, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  schoolId: string;
  onComplete: () => void;
}

export function SetupStudents({ schoolId, onComplete }: Props) {
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [customFields, setCustomFields] = useState<SchoolCustomField[]>([]);
  const [method, setMethod] = useState<'manual' | 'csv' | null>(null);
  const [loading, setLoading] = useState(true);

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
      .eq('entity_type', 'student')
      .eq('is_active', true)
      .order('sort_order');

    if (classData) setClasses(classData);
    if (fieldData) setCustomFields(fieldData);
    setLoading(false);
  };

  if (loading) {
    return <div className="animate-pulse text-primary-600">Loading...</div>;
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900">Add Students</h2>
        <p className="text-sm text-gray-500 mt-1">
          You can add students now or do it later from your dashboard.
          Choose how you want to add them.
        </p>
      </div>

      {!method ? (
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => setMethod('csv')}
            className="card hover:border-primary-300 transition-colors text-center py-8"
          >
            <Upload size={32} className="mx-auto text-primary-600 mb-3" />
            <h3 className="font-semibold text-gray-900">Bulk Import (CSV)</h3>
            <p className="text-sm text-gray-500 mt-1">Upload a spreadsheet with all students</p>
          </button>
          <button
            onClick={() => setMethod('manual')}
            className="card hover:border-primary-300 transition-colors text-center py-8"
          >
            <Users size={32} className="mx-auto text-primary-600 mb-3" />
            <h3 className="font-semibold text-gray-900">Add Manually</h3>
            <p className="text-sm text-gray-500 mt-1">Add students one by one from the dashboard</p>
          </button>
        </div>
      ) : method === 'csv' ? (
        <CSVImporter schoolId={schoolId} classes={classes} customFields={customFields} />
      ) : null}

      {/* Navigation */}
      <div className="mt-8 flex items-center justify-between">
        {method && (
          <button onClick={() => setMethod(null)} className="text-sm text-gray-500 hover:text-gray-700">
            Back
          </button>
        )}
        <div className="ml-auto">
          <button
            onClick={onComplete}
            className="btn-primary flex items-center gap-2 px-6 py-3"
          >
            {method === 'manual' ? 'Finish Setup' : 'Complete Setup'}
            <CheckCircle size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ============ CSV IMPORTER ============
function CSVImporter({ schoolId, classes, customFields }: {
  schoolId: string;
  classes: SchoolClass[];
  customFields: SchoolCustomField[];
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string[][]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ imported: number; failed: number } | null>(null);

  const expectedHeaders = ['first_name', 'last_name', 'class', ...customFields.map(f => f.field_name)];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const rows = text.split('\n').map(row => row.split(',').map(cell => cell.trim()));
      setPreview(rows.slice(0, 6));
    };
    reader.readAsText(f);
  };

  const handleImport = async () => {
    if (!file) return;
    setImporting(true);
    setResult(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      const rows = text.split('\n').map(row => row.split(',').map(cell => cell.trim()));
      const headers = rows[0].map(h => h.toLowerCase().replace(/\s+/g, '_'));
      const dataRows = rows.slice(1).filter(row => row.length >= 3 && row[0]);

      const supabase = createClient();
      let imported = 0;
      let failed = 0;

      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        const record: Record<string, string> = {};
        headers.forEach((h, idx) => { record[h] = row[idx] || ''; });

        // Find class
        const className = record.class || record.class_name || '';
        const matchedClass = classes.find(c =>
          c.name.toLowerCase() === className.toLowerCase()
        );

        if (!matchedClass) {
          failed++;
          setProgress(Math.round(((i + 1) / dataRows.length) * 100));
          continue;
        }

        const studentIdNumber = `STU-${schoolId.slice(0, 4).toUpperCase()}-${Date.now().toString(36).toUpperCase()}${i}`;
        const qrCodeData = `MYEDURIDE:${studentIdNumber}`;

        // Build custom fields
        const customData: Record<string, any> = {};
        for (const field of customFields) {
          if (record[field.field_name]) {
            customData[field.field_name] = record[field.field_name];
          }
        }

        const { error } = await supabase.from('students').insert({
          school_id: schoolId,
          class_id: matchedClass.id,
          first_name: record.first_name || '',
          last_name: record.last_name || '',
          student_id_number: studentIdNumber,
          qr_code_data: qrCodeData,
          custom_fields: customData,
          is_active: true,
        });

        if (!error) {
          imported++;

          // Invite parent if email provided
          const parentEmail = customData.parent_email;
          if (parentEmail && parentEmail.includes('@')) {
            await fetch('/api/parents/invite', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                student_id: studentIdNumber,
                school_id: schoolId,
                parent_email: parentEmail,
                parent_name: customData.parent_name || 'Parent',
                parent_phone: customData.parent_phone || '',
                relationship: customData.relationship || 'parent',
              }),
            });
          }
        } else {
          failed++;
        }

        setProgress(Math.round(((i + 1) / dataRows.length) * 100));
      }

      setResult({ imported, failed });
      setImporting(false);
      toast.success(`Imported ${imported} students`);
    };
    reader.readAsText(file);
  };

  return (
    <div className="card">
      <h3 className="font-semibold mb-3">CSV Import</h3>

      {/* Expected format */}
      <div className="mb-4 p-3 bg-gray-50 rounded-lg">
        <p className="text-xs font-medium text-gray-600 mb-1">Expected CSV columns:</p>
        <code className="text-xs text-gray-500 break-all">
          {expectedHeaders.join(', ')}
        </code>
        <p className="text-xs text-gray-400 mt-2">
          The "class" column must match one of your defined class names exactly.
        </p>
      </div>

      {/* File input */}
      <input
        type="file"
        accept=".csv"
        onChange={handleFileChange}
        className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
      />

      {/* Preview */}
      {preview.length > 0 && (
        <div className="mt-4 overflow-x-auto">
          <p className="text-xs font-medium text-gray-600 mb-2">Preview:</p>
          <table className="text-xs w-full border rounded">
            <tbody>
              {preview.map((row, i) => (
                <tr key={i} className={i === 0 ? 'bg-gray-100 font-medium' : ''}>
                  {row.slice(0, 6).map((cell, j) => (
                    <td key={j} className="border px-2 py-1 max-w-[120px] truncate">{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Progress */}
      {importing && (
        <div className="mt-4">
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-primary-600 transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-xs text-gray-500 mt-1">{progress}% complete</p>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="mt-4 p-3 rounded-lg bg-green-50 border border-green-100">
          <p className="text-sm text-green-800 font-medium">
            Import complete: {result.imported} imported, {result.failed} failed
          </p>
        </div>
      )}

      {/* Import button */}
      {file && !result && (
        <button
          onClick={handleImport}
          disabled={importing}
          className="btn-primary mt-4"
        >
          {importing ? 'Importing...' : 'Start Import'}
        </button>
      )}
    </div>
  );
}
