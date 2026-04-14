import { Card } from '@/components/ui/card';

export default function DashboardLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>

      {/* Portfolio summary skeleton */}
      <Card>
        <div className="flex justify-between items-start">
          <div className="space-y-2">
            <div className="h-4 bg-gray-200 rounded w-40" />
            <div className="h-10 bg-gray-200 rounded w-56" />
            <div className="h-3 bg-gray-200 rounded w-32" />
          </div>
          <div className="flex gap-2">
            <div className="h-6 bg-gray-200 rounded-full w-24" />
            <div className="h-6 bg-gray-200 rounded-full w-24" />
          </div>
        </div>
      </Card>

      {/* Holdings table skeleton */}
      <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
        <div className="h-10 bg-gray-100 border-b" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-14 border-b flex items-center px-4 gap-4">
            <div className="h-4 bg-gray-200 rounded w-full" />
          </div>
        ))}
      </div>

      {/* Chart + plan skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <div className="h-4 bg-gray-200 rounded w-24 mb-4" />
          <div className="h-40 bg-gray-100 rounded" />
        </Card>
        <Card>
          <div className="h-4 bg-gray-200 rounded w-32 mb-4" />
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-8 bg-gray-100 rounded" />
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
