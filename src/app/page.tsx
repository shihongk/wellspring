import { notFound } from 'next/navigation';
import { getHoldings } from '@/lib/google-sheets';
import { upsertHoldingAction } from '@/app/lib/actions';
import { HoldingForm } from '@/components/holding-form';

export const dynamic = 'force-dynamic';

export default async function EditHoldingPage({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await params;
  const decodedTicker = decodeURIComponent(ticker);
  
  const holdings = await getHoldings();
  const holding = holdings.find((h) => h.ticker === decodedTicker);

  if (!holding) notFound();

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Edit Holding: {holding.ticker}</h1>
      <HoldingForm holding={holding} action={upsertHoldingAction} />
    </div>
  );
}