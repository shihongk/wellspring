'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function RefreshButton() {
  const router = useRouter();
  const [spinning, setSpinning] = useState(false);

  function handleRefresh() {
    setSpinning(true);
    router.refresh();
    setTimeout(() => setSpinning(false), 1500);
  }

  return (
    <button
      onClick={handleRefresh}
      disabled={spinning}
      title="Refresh prices"
      className="flex items-center gap-1.5 rounded-md border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-sm text-cyan-800 hover:bg-cyan-100 disabled:opacity-50 transition-colors"
    >
      <svg
        className={`w-4 h-4 ${spinning ? 'animate-spin' : ''}`}
        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
      {spinning ? 'Refreshing…' : 'Refresh prices'}
    </button>
  );
}
