'use client';

import { CheckCircle, XCircle, Clock, Briefcase } from 'lucide-react';

interface MatchedStaff {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  photo_url: string | null;
  staff_id_number: string | null;
  role: string;
}

interface Props {
  staff: MatchedStaff;
  gateMode: 'arrival' | 'dismissal';
  onAccept: () => void;
  onReject: () => void;
  loading: boolean;
}

export function StaffVerificationCard({ staff, gateMode, onAccept, onReject, loading }: Props) {
  return (
    <div className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden mt-4">
      {/* Staff Info */}
      <div className="p-6">
        <div className="flex items-center gap-5">
          {staff.photo_url ? (
            <img
              src={staff.photo_url}
              alt={staff.full_name}
              className="w-20 h-20 rounded-2xl object-cover border-2 border-blue-500"
            />
          ) : (
            <div className="w-20 h-20 rounded-2xl bg-blue-600 flex items-center justify-center text-2xl font-bold text-white">
              {staff.full_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
            </div>
          )}
          <div>
            <h3 className="text-xl font-bold text-white">{staff.full_name}</h3>
            {staff.staff_id_number && (
              <p className="text-gray-400 text-sm mt-1">ID: {staff.staff_id_number}</p>
            )}
            <p className="text-gray-400 text-sm capitalize">{staff.role.replace('_', ' ')}</p>
          </div>
        </div>
      </div>

      {/* Mode indicator */}
      <div className="px-6 py-3 flex items-center gap-2 bg-blue-900/30">
        <Briefcase size={16} className="text-blue-400" />
        <span className="text-sm font-medium text-blue-400">
          STAFF {gateMode === 'arrival' ? 'CLOCK IN' : 'CLOCK OUT'}
        </span>
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
          disabled={loading}
          className="flex-1 flex items-center justify-center gap-2 py-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-colors disabled:opacity-50"
        >
          <CheckCircle size={20} />
          {loading ? 'Processing...' : gateMode === 'arrival' ? 'Clock In' : 'Clock Out'}
        </button>
      </div>
    </div>
  );
}
