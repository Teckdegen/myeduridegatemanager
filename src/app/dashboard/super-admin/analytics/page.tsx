'use client';

import { BarChart3 } from 'lucide-react';

export default function AnalyticsPage() {
  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Analytics</h1>
      <p className="text-gray-500 mb-8">Platform-wide analytics and insights</p>
      <div className="card text-center py-16">
        <BarChart3 size={48} className="mx-auto text-gray-300 mb-4" />
        <p className="text-gray-500">Analytics dashboard coming soon</p>
        <p className="text-sm text-gray-400 mt-1">Data will populate as schools start using the system</p>
      </div>
    </div>
  );
}
