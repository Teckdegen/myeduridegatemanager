'use client';

import type { Student } from '@/lib/types';
import { CheckCircle, XCircle, AlertTriangle, UserCheck, Clock } from 'lucide-react';

interface Props {
  student: Student;
  gateMode: 'arrival' | 'dismissal';
  dismissalApproved?: boolean;
  dismissalTeacher?: string;
  onAccept: () => void;
  onReject: () => void;
  loading: boolean;
}

export function StudentVerificationCard({
  student,
  gateMode,
  dismissalApproved = false,
  dismissalTeacher = '',
  onAccept,
  onReject,
  loading,
}: Props) {
  const canRelease = gateMode === 'arrival' || (gateMode === 'dismissal' && dismissalApproved);

  return (
    <div className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden mt-4">
      {/* Student Info */}
      <div className="p-6">
        <div className="flex items-center gap-5">
          {student.photo_url ? (
            <img
              src={student.photo_url}
              alt={`${student.first_name} ${student.last_name}`}
              className="w-20 h-20 rounded-2xl object-cover border-2 border-primary-500"
            />
          ) : (
            <div className="w-20 h-20 rounded-2xl bg-gray-600 flex items-center justify-center text-2xl font-bold text-white">
              {student.first_name[0]}{student.last_name[0]}
            </div>
          )}
          <div>
            <h3 className="text-xl font-bold text-white">
              {student.first_name} {student.last_name}
            </h3>
            <p className="text-gray-400 text-sm mt-1">ID: {student.student_id_number}</p>
            <p className="text-gray-400 text-sm">{(student as any).class?.name || ''}</p>
          </div>
        </div>
      </div>

      {/* Mode indicator */}
      <div className={`px-6 py-3 flex items-center gap-2 ${
        gateMode === 'arrival' ? 'bg-green-900/30' : 'bg-orange-900/30'
      }`}>
        {gateMode === 'arrival' ? (
          <>
            <UserCheck size={16} className="text-green-400" />
            <span className="text-sm font-medium text-green-400">STUDENT ARRIVING</span>
          </>
        ) : (
          <>
            {dismissalApproved ? (
              <>
                <CheckCircle size={16} className="text-green-400" />
                <span className="text-sm font-medium text-green-400">
                  DISMISSAL APPROVED by {dismissalTeacher}
                </span>
              </>
            ) : (
              <>
                <AlertTriangle size={16} className="text-red-400" />
                <span className="text-sm font-medium text-red-400">
                  NOT APPROVED FOR DISMISSAL
                </span>
              </>
            )}
          </>
        )}
      </div>

      {/* Timestamp */}
      <div className="px-6 py-3 flex items-center gap-2 text-gray-400 border-t border-gray-700">
        <Clock size={14} />
        <span className="text-sm">
          {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          {' — '}
          {new Date().toLocaleDateString()}
        </span>
      </div>

      {/* Action buttons */}
      <div className="p-6 pt-3 flex gap-3">
        <button
          onClick={onReject}
          disabled={loading}
          className="flex-1 flex items-center justify-center gap-2 py-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold transition-colors disabled:opacity-50"
        >
          <XCircle size={20} />
          Reject
        </button>
        <button
          onClick={onAccept}
          disabled={loading || !canRelease}
          className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-xl font-semibold transition-colors disabled:opacity-50 ${
            canRelease
              ? 'bg-green-600 hover:bg-green-700 text-white'
              : 'bg-gray-600 text-gray-400 cursor-not-allowed'
          }`}
        >
          <CheckCircle size={20} />
          {loading ? 'Processing...' : canRelease ? 'Accept' : 'Not Approved'}
        </button>
      </div>

      {/* Warning for unapproved dismissal */}
      {gateMode === 'dismissal' && !dismissalApproved && (
        <div className="px-6 pb-4">
          <div className="p-3 rounded-lg bg-red-900/20 border border-red-800/30">
            <p className="text-xs text-red-300">
              This student has not been approved for dismissal by their teacher. 
              Contact the class teacher before releasing.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
