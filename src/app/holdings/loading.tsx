import { Card } from '@/components/ui/card';

export default function HoldingsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Holdings</h1>
        <div className="h-10 w-32 bg-gray-200 rounded-md" />
      </div>

      <Card className="overflow-hidden p-0">
        <div className="h-10 bg-gray-100 border-b w-full" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-14 bg-white border-b flex items-center px-4 gap-4">
            <div className="h-4 bg-gray-200 rounded w-full" />
          </div>
        ))}
      </Card>
    </div>
  );
}
