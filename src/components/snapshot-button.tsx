'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { recordSnapshotAction } from '@/app/lib/actions';

type State = 'idle' | 'loading' | 'success' | 'skipped' | 'error';

export function SnapshotButton() {
  const [state, setState] = useState<State>('idle');

  async function handleClick() {
    setState('loading');
    try {
      const result = await recordSnapshotAction();
      if (result.recorded) {
        setState('success');
        setTimeout(() => setState('idle'), 3000);
      } else {
        setState('skipped');
        setTimeout(() => setState('idle'), 3000);
      }
    } catch {
      setState('error');
      setTimeout(() => setState('idle'), 5000);
    }
  }

  const labels: Record<State, string> = {
    idle: 'Record Snapshot',
    loading: 'Recording…',
    success: '✓ Recorded',
    skipped: 'Prices unavailable — skipped',
    error: 'Failed — try again',
  };

  const variants: Record<State, 'primary' | 'secondary' | 'danger'> = {
    idle: 'secondary',
    loading: 'secondary',
    success: 'secondary',
    skipped: 'secondary',
    error: 'danger',
  };

  return (
    <Button
      variant={variants[state]}
      onClick={handleClick}
      disabled={state === 'loading'}
      className={
        state === 'success' ? 'text-green-700 border-green-300 bg-green-50' :
        state === 'skipped' ? 'text-slate-500' : ''
      }
    >
      {labels[state]}
    </Button>
  );
}
