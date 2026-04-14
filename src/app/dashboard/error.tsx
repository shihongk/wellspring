'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Dashboard error boundary caught:', error);
  }, [error]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
      <Card className="flex flex-col items-center justify-center p-12 space-y-4 text-center border-red-100 bg-red-50">
        <h2 className="text-lg font-semibold text-red-800">Unable to load portfolio data</h2>
        <p className="text-red-600 max-w-md text-sm">Google Sheets may be unreachable, or there was an issue fetching the data. Please check your credentials and connection.</p>
        <div className="pt-4"><Button variant="danger" onClick={() => reset()}>Retry Loading</Button></div>
      </Card>
    </div>
  );
}
