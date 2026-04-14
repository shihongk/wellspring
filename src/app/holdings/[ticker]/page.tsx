import { notFound } from 'next/navigation';
import { getHoldings } from '@/lib/google-sheets';
import { HoldingForm } from '@/components/holding-form';
import { upsertHoldingAction } from '@/app/lib/actions';

export const dynamic = 'force-dynamic';

export default async function EditHoldingPage({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await params;
  const holdings = await getHoldings();
  const holding = holdings.find((h) => h.ticker === ticker);

  if (!holding) notFound();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Edit Holding — {ticker}</h1>
      <HoldingForm holding={holding} action={upsertHoldingAction} />
    </div>
  );
}
