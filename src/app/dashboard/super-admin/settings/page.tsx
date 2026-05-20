'use client';

import { Settings } from 'lucide-react';

export default function SuperAdminSettingsPage() {
  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Platform Settings</h1>
      <p className="text-gray-500 mb-8">Global configuration for MyEduRide</p>
      <div className="card text-center py-16">
        <Settings size={48} className="mx-auto text-gray-300 mb-4" />
        <p className="text-gray-500">Platform settings coming soon</p>
      </div>
    </div>
  );
}
