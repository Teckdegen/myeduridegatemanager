export default function OfflinePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="text-center">
        <div className="text-6xl mb-4">📡</div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">You're Offline</h1>
        <p className="text-gray-500 max-w-sm">
          Don't worry — the gate system still works offline. 
          Attendance will sync automatically when you're back online.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="btn-primary mt-6"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
