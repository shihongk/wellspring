import { Currency, FxRates } from '@/types';

export function toSGD(amount: number, currency: Currency, fxRates: FxRates): number {
  if (currency === 'SGD') return amount;
  if (currency === 'USD') return amount * fxRates.USDSGD;
  if (currency === 'HKD') return amount * fxRates.HKDSGD;
  throw new Error(`Unsupported currency: ${currency}`);
}

export function formatSGD(value: number | null | undefined): string {
  if (value == null || isNaN(value)) {
    return '—';
  }
  return new Intl.NumberFormat('en-SG', {
    style: 'currency',
    currency: 'SGD',
  }).format(value);
}

// Format share quantities: integers with commas, decimals up to 4 dp (trailing zeros stripped)
export function formatShares(value: number): string {
  if (Number.isInteger(value)) {
    return new Intl.NumberFormat('en-SG').format(value);
  }
  // Up to 4 dp, strip trailing zeros
  const s = value.toFixed(4).replace(/\.?0+$/, '');
  const [int, dec] = s.split('.');
  return `${new Intl.NumberFormat('en-SG').format(Number(int))}.${dec}`;
}

// Format a YYYY-MM-DD string or ISO timestamp as "14 Apr 2026"
export function formatDate(value: string): string {
  const d = new Date(value);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

// Format an ISO timestamp as "14 Apr 2026, 10:32"
export function formatDateTime(value: string): string {
  const d = new Date(value);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    + ', '
    + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}
