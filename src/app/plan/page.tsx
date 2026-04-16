export const dynamic = 'force-dynamic';

import { getTargetAllocations, getInvestmentSchedule, getCash, getHoldings } from '@/lib/google-sheets';
import { fetchPricesAndFx } from '@/lib/yahoo-finance';
import { computePortfolioSnapshot } from '@/lib/portfolio';
import { saveTargetAllocationsAction, saveScheduleAction } from '@/app/lib/actions';
import { AllocationEditor } from '@/components/allocation-editor';
import { ScheduleViewer } from '@/components/schedule-viewer';
import { PlanSnapshot } from '@/components/plan-snapshot';

export default async function PlanPage() {
  const [allocResult, scheduleResult, cashResult, pricesResult, holdingsResult] = await Promise.allSettled([
    getTargetAllocations(),
    getInvestmentSchedule(),
    getCash(),
    fetchPricesAndFx(),
    getHoldings(),
  ]);

  const allocations = allocResult.status === 'fulfilled' ? allocResult.value : null;
  const schedule = scheduleResult.status === 'fulfilled' ? scheduleResult.value : null;
  const cash = cashResult.status === 'fulfilled' ? cashResult.value : null;
  const pricesAndFx = pricesResult.status === 'fulfilled' ? pricesResult.value : null;
  const holdings = holdingsResult.status === 'fulfilled' ? holdingsResult.value : null;

  const snapshot = cash && pricesAndFx && holdings
    ? computePortfolioSnapshot(holdings, pricesAndFx.prices, pricesAndFx.fxRates, cash, pricesAndFx.stale, pricesAndFx.fetchedAt)
    : null;

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Plan</h1>

      {/* Current portfolio reference */}
      {snapshot && allocations && (
        <PlanSnapshot snapshot={snapshot} targetAllocations={allocations} />
      )}

      {/* Target allocation editor + schedule side by side when wide enough */}
      <div className="grid grid-cols-1 xl:grid-cols-[380px_1fr] gap-6 items-start">
        <section>
          {allocations !== null && cash !== null ? (
            <AllocationEditor
              initialAllocations={allocations}
              cashSGD={cash.SGD}
              action={saveTargetAllocationsAction}
            />
          ) : (
            <div className="rounded-xl border bg-white shadow-sm p-4 text-sm text-loss">
              Failed to load target allocations:{' '}
              {allocResult.status === 'rejected' ? String(allocResult.reason) : 'cash data unavailable'}
            </div>
          )}
        </section>

        <section>
          {schedule !== null && pricesAndFx !== null ? (
            <ScheduleViewer
              schedule={schedule}
              prices={pricesAndFx.prices}
              pricesStale={pricesAndFx.stale}
              pricesFetchedAt={pricesAndFx.fetchedAt}
              fxRates={pricesAndFx.fxRates}
              action={saveScheduleAction}
            />
          ) : (
            <div className="rounded-xl border bg-white shadow-sm p-4 text-sm text-loss">
              Failed to load investment schedule:{' '}
              {scheduleResult.status === 'rejected' ? String(scheduleResult.reason) : 'prices unavailable'}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
