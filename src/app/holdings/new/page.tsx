import { HoldingForm } from '@/components/holding-form';
import { upsertHoldingAction } from '@/app/lib/actions';

export default function NewHoldingPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Add Holding</h1>
      <HoldingForm action={upsertHoldingAction} />
    </div>
  );
}
