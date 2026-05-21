import QRCode from 'qrcode';
import { imageUrlToDataUrl } from '@/lib/photo';

export type IdCardPerson = {
  kind: 'student' | 'staff';
  fullName: string;
  idNumber: string;
  qrData: string;
  photoUrl?: string | null;
  birth?: string;
  address?: string;
  className?: string;
  roleLabel?: string;
};

export type SchoolBranding = {
  name: string;
  address?: string | null;
  logoUrl?: string | null;
  primaryColor?: string | null;
};

const CARD_W = 85.6;
const CARD_H = 54;

function hexToRgb(hex: string): [number, number, number] {
  const h = (hex || '#1e3a8a').replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full.slice(0, 6), 16);
  if (Number.isNaN(n)) return [30, 58, 138];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function lighterRgb(rgb: [number, number, number], amount = 40): [number, number, number] {
  return [
    Math.min(255, rgb[0] + amount),
    Math.min(255, rgb[1] + amount),
    Math.min(255, rgb[2] + amount),
  ];
}

async function drawFront(
  doc: any,
  person: IdCardPerson,
  school: SchoolBranding,
  navy: [number, number, number],
  accent: [number, number, number]
) {
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, CARD_W, CARD_H, 'F');

  // Light geometric accents
  doc.setFillColor(245, 247, 250);
  doc.triangle(0, 0, 28, 0, 0, 22, 'F');
  doc.setFillColor(235, 240, 248);
  doc.triangle(CARD_W, CARD_H, CARD_W - 20, CARD_H, CARD_W, CARD_H - 16, 'F');

  // Top diagonal band
  doc.setFillColor(...accent);
  doc.triangle(0, 0, 36, 0, 0, 14, 'F');
  doc.setFillColor(...navy);
  doc.triangle(0, 0, 22, 0, 0, 10, 'F');

  // School header
  doc.setTextColor(...navy);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  const schoolName = (school.name || 'SCHOOL NAME').toUpperCase();
  doc.text(schoolName, CARD_W / 2, 7, { align: 'center', maxWidth: CARD_W - 10 });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5);
  doc.setTextColor(60, 60, 60);
  doc.text(school.address || 'Address of School', CARD_W / 2, 11, { align: 'center', maxWidth: CARD_W - 8 });

  // Card type banner
  const bannerLabel = person.kind === 'staff' ? 'STAFF CARD' : 'STUDENT CARD';
  doc.setFillColor(...navy);
  doc.roundedRect(3, 13, CARD_W - 6, 7, 1.5, 1.5, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text(bannerLabel, CARD_W / 2, 17.5, { align: 'center' });

  // Photo
  const photoX = 5;
  const photoY = 22;
  const photoW = 22;
  const photoH = 26;
  doc.setDrawColor(...accent);
  doc.setLineWidth(0.4);
  doc.roundedRect(photoX, photoY, photoW, photoH, 2, 2, 'S');

  const photoData = await imageUrlToDataUrl(person.photoUrl);
  if (photoData) {
    try {
      const fmt = photoData.includes('image/png') ? 'PNG' : 'JPEG';
      doc.addImage(photoData, fmt, photoX + 0.5, photoY + 0.5, photoW - 1, photoH - 1);
    } catch {
      doc.setFillColor(230, 235, 245);
      doc.roundedRect(photoX + 1, photoY + 1, photoW - 2, photoH - 2, 1.5, 1.5, 'F');
    }
  } else {
    doc.setFillColor(230, 235, 245);
    doc.roundedRect(photoX + 1, photoY + 1, photoW - 2, photoH - 2, 1.5, 1.5, 'F');
    doc.setTextColor(...navy);
    doc.setFontSize(6);
    doc.text('PHOTO', photoX + photoW / 2, photoY + photoH / 2, { align: 'center' });
  }

  // Details
  const tx = 30;
  let ty = 24;
  const line = (label: string, value: string) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.5);
    doc.setTextColor(...navy);
    doc.text(`${label} :`, tx, ty);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(40, 40, 40);
    doc.text(value || '—', tx + 18, ty, { maxWidth: 38 });
    ty += 5;
  };

  line('NAME', person.fullName.toUpperCase());
  line('BIRTH', person.birth || '—');
  line('ADDRESS', person.address || '—');
  line('ID NO', person.idNumber);
  if (person.kind === 'student' && person.className) {
    line('CLASS', person.className);
  }
  if (person.kind === 'staff' && person.roleLabel) {
    line('ROLE', person.roleLabel);
  }

  // QR code (primary scan payload)
  try {
    const qrDataUrl = await QRCode.toDataURL(person.qrData, {
      width: 200,
      margin: 1,
      color: { dark: '#1e3a8a', light: '#ffffff' },
    });
    doc.addImage(qrDataUrl, 'PNG', CARD_W - 24, 36, 20, 20);
    doc.setFontSize(4);
    doc.setTextColor(100, 100, 100);
    doc.text('SCAN QR', CARD_W - 14, 57, { align: 'center' });
  } catch {
    /* skip */
  }

  // MyEduRide mark
  doc.setFontSize(4);
  doc.setTextColor(...accent);
  doc.text('MyEduRide', CARD_W - 4, 4, { align: 'right' });
}

function drawBack(
  doc: any,
  school: SchoolBranding,
  kind: 'student' | 'staff',
  navy: [number, number, number],
  accent: [number, number, number]
) {
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, CARD_W, CARD_H, 'F');

  doc.setFillColor(245, 247, 250);
  doc.triangle(CARD_W, 0, CARD_W - 25, 0, CARD_W, 18, 'F');

  doc.setTextColor(...navy);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text((school.name || 'SCHOOL').toUpperCase(), CARD_W / 2, 8, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5);
  doc.setTextColor(60, 60, 60);
  doc.text(school.address || '', CARD_W / 2, 12, { align: 'center', maxWidth: CARD_W - 8 });

  // Signature box
  doc.setDrawColor(200, 210, 225);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(4, 16, 38, 22, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5);
  doc.setTextColor(...navy);
  doc.text('AUTHORISED SIGNATURE', 6, 20);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(...navy);
  doc.setFontSize(6);
  doc.text('Principal', 6, 34);

  // Return notice
  doc.roundedRect(46, 16, 36, 22, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(4.5);
  doc.setTextColor(30, 30, 30);
  const returnText = `If found, please return ID card to ${school.name || 'the school'}. Thank you.`;
  doc.text(returnText, 48, 22, { maxWidth: 32 });

  // Footer policy
  doc.setFillColor(...navy);
  doc.rect(0, 42, CARD_W, 12, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(4);
  const policy =
    kind === 'staff'
      ? 'Official proof of staff status. Must be carried on campus and when using school facilities.'
      : 'Official proof of student status. Must be carried at all times on campus and when using school facilities.';
  doc.text(policy, CARD_W / 2, 48, { align: 'center', maxWidth: CARD_W - 6 });
}

export async function generateIdCardsPdf(
  persons: IdCardPerson[],
  school: SchoolBranding,
  fileName?: string
): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: [CARD_W, CARD_H],
  });

  const navy = hexToRgb(school.primaryColor || '#1e3a8a');
  const accent = lighterRgb(navy, 50);

  for (let i = 0; i < persons.length; i++) {
    const person = persons[i];
    if (i > 0) doc.addPage();
    await drawFront(doc, person, school, navy, accent);

    doc.addPage();
    drawBack(doc, school, person.kind, navy, accent);
  }

  doc.save(fileName || `id_cards_${new Date().toISOString().split('T')[0]}.pdf`);
}
