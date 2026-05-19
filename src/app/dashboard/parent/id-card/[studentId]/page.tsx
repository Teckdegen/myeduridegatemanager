'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Student, School, SchoolClass } from '@/lib/types';
import { ArrowLeft, Download, CreditCard } from 'lucide-react';
import Link from 'next/link';
import QRCode from 'qrcode';

export default function StudentIdCardPage() {
  const params = useParams();
  const studentId = params.studentId as string;
  const [student, setStudent] = useState<Student | null>(null);
  const [school, setSchool] = useState<School | null>(null);
  const [className, setClassName] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStudent();
  }, [studentId]);

  const fetchStudent = async () => {
    const supabase = createClient();

    const { data } = await supabase
      .from('students')
      .select('*, school:schools(*), class:school_classes(name, grade)')
      .eq('id', studentId)
      .single();

    if (data) {
      setStudent(data);
      setSchool((data as any).school);
      setClassName((data as any).class?.name || '');

      // Generate QR code
      const qr = await QRCode.toDataURL(data.qr_code_data, {
        width: 200,
        margin: 1,
        color: { dark: '#000000', light: '#ffffff' },
      });
      setQrDataUrl(qr);
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-primary-600">Loading ID card...</div>
      </div>
    );
  }

  if (!student || !school) return null;

  const schoolColor = school.primary_color || '#1B4D3E';

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-md mx-auto">
        <Link href="/dashboard/parent" className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft size={16} />
          Back to Dashboard
        </Link>

        {/* Digital ID Card */}
        <div className="rounded-2xl overflow-hidden shadow-xl bg-white" id="id-card">
          {/* Header */}
          <div className="p-5 text-center text-white" style={{ backgroundColor: schoolColor }}>
            {school.logo_url && (
              <img src={school.logo_url} alt={school.name} className="h-10 mx-auto mb-2 object-contain" />
            )}
            <h2 className="font-bold text-lg">{school.name}</h2>
            <p className="text-xs opacity-80 mt-0.5">STUDENT IDENTITY CARD</p>
          </div>

          {/* Body */}
          <div className="p-6">
            <div className="flex gap-5">
              {/* Photo */}
              <div className="shrink-0">
                {student.photo_url ? (
                  <img
                    src={student.photo_url}
                    alt={student.first_name}
                    className="w-24 h-28 rounded-xl object-cover border-2"
                    style={{ borderColor: schoolColor }}
                  />
                ) : (
                  <div
                    className="w-24 h-28 rounded-xl flex items-center justify-center text-white text-2xl font-bold"
                    style={{ backgroundColor: schoolColor }}
                  >
                    {student.first_name[0]}{student.last_name[0]}
                  </div>
                )}
              </div>

              {/* Details */}
              <div className="flex-1 space-y-2">
                <div>
                  <p className="text-xs text-gray-400 uppercase">Name</p>
                  <p className="font-bold text-gray-900">{student.first_name} {student.last_name}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase">Student ID</p>
                  <p className="font-mono text-sm text-gray-700">{student.student_id_number}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase">Class</p>
                  <p className="text-sm text-gray-700">{className}</p>
                </div>
              </div>
            </div>

            {/* QR Code */}
            <div className="mt-6 flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400">Academic Year</p>
                <p className="text-sm font-medium text-gray-700">{new Date().getFullYear()}/{new Date().getFullYear() + 1}</p>
              </div>
              {qrDataUrl && (
                <img src={qrDataUrl} alt="QR Code" className="w-20 h-20" />
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="px-5 py-3 text-center text-xs text-white" style={{ backgroundColor: schoolColor }}>
            MyEduRide — The Student Safety Platform
          </div>
        </div>

        {/* Actions */}
        <div className="mt-4 flex gap-3">
          <button
            onClick={() => window.print()}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-white border font-medium text-sm hover:bg-gray-50"
          >
            <CreditCard size={16} />
            Print Card
          </button>
          <button
            onClick={async () => {
              const { jsPDF } = await import('jspdf');
              const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [85.6, 54] });
              doc.setFillColor(schoolColor);
              doc.rect(0, 0, 85.6, 12, 'F');
              doc.setTextColor(255, 255, 255);
              doc.setFontSize(7);
              doc.setFont('helvetica', 'bold');
              doc.text(school.name, 42.8, 5, { align: 'center' });
              doc.setFontSize(5);
              doc.text('STUDENT IDENTITY CARD', 42.8, 9, { align: 'center' });
              doc.setTextColor(30, 30, 30);
              doc.setFontSize(9);
              doc.text(`${student.first_name} ${student.last_name}`, 26, 18);
              doc.setFontSize(6);
              doc.setTextColor(80, 80, 80);
              doc.text(`ID: ${student.student_id_number}`, 26, 23);
              doc.text(`Class: ${className}`, 26, 27);
              if (qrDataUrl) doc.addImage(qrDataUrl, 'PNG', 64, 15, 18, 18);
              doc.setFillColor(schoolColor);
              doc.rect(0, 48, 85.6, 6, 'F');
              doc.setTextColor(255, 255, 255);
              doc.setFontSize(4.5);
              doc.text('MyEduRide | The Student Safety Platform', 42.8, 51.5, { align: 'center' });
              doc.save(`${student.first_name}_${student.last_name}_ID.pdf`);
            }}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-primary-600 text-white font-medium text-sm hover:bg-primary-700"
          >
            <Download size={16} />
            Download PDF
          </button>
        </div>
      </div>
    </div>
  );
}
