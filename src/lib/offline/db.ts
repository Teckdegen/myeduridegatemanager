import { openDB, type IDBPDatabase } from 'idb';

const DB_NAME = 'myeduride-offline';
const DB_VERSION = 1;

export interface OfflineAttendanceRecord {
  id: string;
  student_id: string;
  school_id: string;
  type: 'arrival' | 'departure';
  verification_method: 'face_recognition' | 'id_card_scan' | 'manual';
  timestamp: string;
  synced: boolean;
}

export interface CachedStudent {
  id: string;
  school_id: string;
  first_name: string;
  last_name: string;
  student_id_number: string;
  class_name: string;
  grade: string;
  photo_url: string | null;
  face_descriptor: number[] | null;
  qr_code_data: string;
}

export async function getDB(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Cached students for offline face recognition
      if (!db.objectStoreNames.contains('students')) {
        const studentStore = db.createObjectStore('students', { keyPath: 'id' });
        studentStore.createIndex('school_id', 'school_id');
        studentStore.createIndex('qr_code_data', 'qr_code_data');
        studentStore.createIndex('student_id_number', 'student_id_number');
      }

      // Offline attendance records (to sync later)
      if (!db.objectStoreNames.contains('attendance_queue')) {
        const attendanceStore = db.createObjectStore('attendance_queue', { keyPath: 'id' });
        attendanceStore.createIndex('synced', 'synced');
      }

      // Last sync timestamp
      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta', { keyPath: 'key' });
      }
    },
  });
}

// Cache students for offline use
export async function cacheStudents(students: CachedStudent[]) {
  const db = await getDB();
  const tx = db.transaction('students', 'readwrite');
  for (const student of students) {
    await tx.store.put(student);
  }
  await tx.done;

  // Update last sync time
  const metaTx = db.transaction('meta', 'readwrite');
  await metaTx.store.put({ key: 'lastStudentSync', value: new Date().toISOString() });
  await metaTx.done;
}

// Get cached students for a school
export async function getCachedStudents(schoolId: string): Promise<CachedStudent[]> {
  const db = await getDB();
  return db.getAllFromIndex('students', 'school_id', schoolId);
}

// Find student by QR code (offline)
export async function findStudentByQR(qrData: string): Promise<CachedStudent | undefined> {
  const db = await getDB();
  return db.getFromIndex('students', 'qr_code_data', qrData);
}

// Find student by ID number (offline)
export async function findStudentById(idNumber: string): Promise<CachedStudent | undefined> {
  const db = await getDB();
  return db.getFromIndex('students', 'student_id_number', idNumber);
}

// Queue attendance record for later sync
export async function queueAttendance(record: OfflineAttendanceRecord) {
  const db = await getDB();
  await db.put('attendance_queue', record);
}

// Get unsynced attendance records
export async function getUnsyncedAttendance(): Promise<OfflineAttendanceRecord[]> {
  const db = await getDB();
  return db.getAllFromIndex('attendance_queue', 'synced', 0 as any);
}

// Mark attendance as synced
export async function markSynced(id: string) {
  const db = await getDB();
  const record = await db.get('attendance_queue', id);
  if (record) {
    record.synced = true;
    await db.put('attendance_queue', record);
  }
}

// Sync all pending records when back online
export async function syncPendingAttendance() {
  const unsynced = await getUnsyncedAttendance();
  if (unsynced.length === 0) return { synced: 0 };

  try {
    const response = await fetch('/api/attendance/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ records: unsynced }),
    });

    if (response.ok) {
      for (const record of unsynced) {
        await markSynced(record.id);
      }
      return { synced: unsynced.length };
    }
  } catch {
    // Still offline, will retry later
  }

  return { synced: 0 };
}
