// @ts-nocheck
'use client';

import { useEffect, useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Student, School } from '@/lib/types';
import { ArrowLeft, Download, Printer, Search, CheckSquare, Square } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import QRCode from 'qrcode';

export default function IdCardsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [school, setSchool] = useState<School | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClass, setSelectedClass] = useState('all');
  const [classes, setClasses] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: role } = await supabase
      .from('user_school_roles')
      .select('school_id, school:schools(*)')
      .eq('user_id', user.id)
      .eq('role', 'school_admin')
      .single();

    if (!role) return;
    setSchool((role as any).school);

    const { data } = await supabase
      .from('students')
      .select('*')
      .eq('school_id', role.school_id)
      .eq('is_active', true)
      .order('class_name')
      .order('last_name');

    if (data) {
      setStudents(data);
      setClasses([...new Set(data.map(s => s.class_name))].sort());
    }
    setLoading(false);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === filteredStudents.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredStudents.map(s => s.id)));
    }
  };

  const filteredStudents = students.filter(s => {
    const matchesSearch = `${s.first_name} ${s.last_name}`.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesClass = selectedClass === 'all' || s.class_name === selectedClass;
    return matchesSearch && matchesClass;
  });

  const handleGenerateCards = async () => {
    if (selectedIds.size === 0) {
      toast.error('Select at least one student');
      return;
    }
    setGenerating(true);

    // Generate QR codes for selected students
    const selectedStudents = students.filter(s => selectedIds.has(s.id));

    // Dynamic import for PDF generation
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: [85.6, 54], // Standard ID card size (credit card)
    });

    for (let i = 0; i < selectedStudents.length; i++) {
      const student = selectedStudents[i];

      if (i > 0) doc.addPage();

      // Card background
      doc.setFillColor(255, 255, 255);
      doc.rect(0, 0, 85.6, 54, 'F');

      // Header bar
      doc.setFillColor(37, 99, 235); // primary-600
      doc.rect(0, 0, 85.6, 12, 'F');

      // School name
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.text(school?.name || 'School', 42.8, 5, { align: 'center' });
      doc.setFontSize(5);
      doc.setFont('helvetica', 'normal');
      doc.text('STUDENT IDENTITY CARD', 42.8, 9, { align: 'center' });

      // Student photo placeholder
      doc.setDrawColor(200, 200, 200);
      doc.setFillColor(240, 240, 240);
      doc.roundedRect(4, 15, 18, 22, 1, 1, 'FD');
      doc.setTextColor(150, 150, 150);
      doc.setFontSize(6);
      doc.text('PHOTO', 13, 27, { align: 'center' });

      // Student details
      doc.setTextColor(30, 30, 30);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text(`${student.first_name} ${student.last_name}`, 26, 18);

      doc.setFontSize(6);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(80, 80, 80);
      doc.text(`ID: ${student.student_id_number}`, 26, 23);
      doc.text(`Class: ${(student as any).class?.name || ''}`, 26, 27);
      doc.text(`Grade: ${(student as any).class?.grade || ''}`, 26, 31);
      if ((student as any).custom_fields?.date_of_birth) {
        doc.text(`DOB: ${(student as any).custom_fields.date_of_birth}`, 26, 35);
      }

      // QR Code
      try {
        const qrDataUrl = await QRCode.toDataURL(student.qr_code_data, {
          width: 100,
          margin: 0,
          color: { dark: '#000000', light: '#ffffff' },
        });
        doc.addImage(qrDataUrl, 'PNG', 64, 15, 18, 18);
      } catch {
        // QR generation failed, skip
      }

      // Footer
      doc.setFillColor(37, 99, 235);
      doc.rect(0, 48, 85.6, 6, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(4.5);
      doc.text('MyEduRide Gate Manager | If found, return to school', 42.8, 51.5, { align: 'center' });

      // Academic year
      const year = new Date().getFullYear();
      doc.setTextColor(100, 100, 100);
      doc.setFontSize(5);
      doc.text(`${year}/${year + 1}`, 76, 44);
    }

    // Save PDF
    doc.save(`id_cards_${new Date().toISOString().split('T')[0]}.pdf`);
    setGenerating(false);
    toast.success(`Generated ${selectedStudents.length} ID cards`);
  };

  const handlePrint = () => {
    handleGenerateCards(); // For now, generate PDF which user can print
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-primary-600">Loading...</div>
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
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Generate ID Cards</h1>
          <div className="flex gap-2">
            <button
              onClick={handlePrint}
              disabled={selectedIds.size === 0 || generating}
              className="flex items-center gap-1 px-3 py-2 text-sm border rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              <Printer size={16} />
              Print
            </button>
            <button
              onClick={handleGenerateCards}
              disabled={selectedIds.size === 0 || generating}
              className="btn-primary flex items-center gap-1 text-sm"
            >
              <Download size={16} />
              {generating ? 'Generating...' : `Download PDF (${selectedIds.size})`}
            </button>
          </div>
        </div>
      </header>

      <main className="p-4 max-w-4xl mx-auto">
        {/* Filters */}
        <div className="flex gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search students..."
              className="input pl-10"
            />
          </div>
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="input w-48"
          >
            <option value="all">All Classes</option>
            {classes.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {/* Select all */}
        <div className="flex items-center gap-2 mb-3">
          <button onClick={selectAll} className="flex items-center gap-2 text-sm text-primary-600 hover:underline">
            {selectedIds.size === filteredStudents.length ? <CheckSquare size={16} /> : <Square size={16} />}
            {selectedIds.size === filteredStudents.length ? 'Deselect All' : 'Select All'}
          </button>
          <span className="text-sm text-gray-500">({selectedIds.size} selected)</span>
        </div>

        {/* Student grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredStudents.map(student => (
            <div
              key={student.id}
              onClick={() => toggleSelect(student.id)}
              className={`card cursor-pointer flex items-center gap-3 py-3 transition-colors ${
                selectedIds.has(student.id) ? 'border-primary-500 bg-primary-50' : 'hover:border-gray-300'
              }`}
            >
              {selectedIds.has(student.id) ? (
                <CheckSquare size={18} className="text-primary-600 shrink-0" />
              ) : (
                <Square size={18} className="text-gray-300 shrink-0" />
              )}
              <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 text-xs font-bold shrink-0">
                {student.first_name[0]}{student.last_name[0]}
              </div>
              <div className="min-w-0">
                <p className="font-medium text-sm truncate">{student.first_name} {student.last_name}</p>
                <p className="text-xs text-gray-500">{(student as any).class?.name || ''}</p>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Hidden print area */}
      <div ref={printRef} className="hidden" />
    </div>
  );
}

