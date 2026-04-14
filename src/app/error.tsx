'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Global error boundary caught:', error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 text-center p-8">
      <h2 className="text-xl font-semibold text-red-800">Something went wrong</h2>
      <p className="text-gray-600 text-sm max-w-md">{error.message || 'An unexpected error occurred.'}</p>
      <Button variant="danger" onClick={() => reset()}>Try again</Button>
    </div>
  );
}
