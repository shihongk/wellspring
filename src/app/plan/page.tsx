export const dynamic = 'force-dynamic';

import { getMonthlyPlan } from '@/lib/google-sheets';
import { updatePlanAction } from '@/app/lib/actions';
import { PlanForm } from '@/components/plan-form';

export default async function PlanPage() {
  const plan = await getMonthlyPlan();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Monthly Investment Plan</h1>
      <PlanForm plan={plan} action={updatePlanAction} />
    </div>
  );
}
