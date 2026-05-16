import YahooFinance from 'yahoo-finance2';
import { FxRates } from '@/types';
import { EQUITY_TICKERS, FX_SYMBOLS, FALLBACK_FX_RATES } from '@/lib/constants';
import { getFxRates, writeFxRates } from '@/lib/google-sheets';

export interface PricesAndFx {
  fxRates: FxRates;
  prices: Record<string, { price: number | null; currency: string }>;
  stale: boolean;
  fetchedAt: string | null;
}

export async function fetchPricesAndFx(): Promise<PricesAndFx> {
  const yf = new YahooFinance();
  const allSymbols = [...EQUITY_TICKERS, ...FX_SYMBOLS];
  const results = await Promise.allSettled(allSymbols.map(sym => yf.quote(sym)));
  
  const prices: PricesAndFx['prices'] = {};
  let liveUsdSgd: number | null = null;
  let liveHkdSgd: number | null = null;
  let anyPricesFailed = false;

  results.forEach((res, i) => {
    const symbol = allSymbols[i];
    if (res.status === 'fulfilled' && res.value && res.value.regularMarketPrice != null) {
      if (symbol === 'USDSGD=X') liveUsdSgd = res.value.regularMarketPrice;
      else if (symbol === 'HKDSGD=X') liveHkdSgd = res.value.regularMarketPrice;
      else prices[symbol] = { price: res.value.regularMarketPrice, currency: res.value.currency || 'USD' };
    } else {
      if ((EQUITY_TICKERS as readonly string[]).includes(symbol)) {
        prices[symbol] = { price: null, currency: 'USD' }; // Fallback currency type
        anyPricesFailed = true;
      }
    }
  });

  let fxRates: FxRates;
  let stale = anyPricesFailed;
  const liveFxSuccess = liveUsdSgd !== null && liveHkdSgd !== null;

  if (liveFxSuccess) {
    fxRates = { USDSGD: liveUsdSgd!, HKDSGD: liveHkdSgd! };
    // Fire-and-forget background write
    writeFxRates(fxRates).catch(() => {});
  } else {
    stale = true;
    fxRates = await getFxRates().catch(() => null) || FALLBACK_FX_RATES;
  }

  return { fxRates, prices, stale, fetchedAt: stale ? null : new Date().toISOString() };
}

// Returns prices and FX for the first available trading day on or after `date` (YYYY-MM-DD).
// Returns null if any equity price or either FX rate could not be fetched.
export async function fetchHistoricalPricesAndFx(date: string): Promise<PricesAndFx | null> {
  const yf = new YahooFinance();
  const allSymbols = [...EQUITY_TICKERS, ...FX_SYMBOLS];

  // Query a 10-day window to span holidays and market-specific closures
  const start = new Date(date + 'T00:00:00Z');
  const end = new Date(start.getTime() + 10 * 24 * 60 * 60 * 1000);
  const period2 = end.toISOString().slice(0, 10);

  const results = await Promise.allSettled(
    allSymbols.map(sym => yf.historical(sym, { period1: date, period2, interval: '1d' }))
  );

  const prices: PricesAndFx['prices'] = {};
  let usdSgd: number | null = null;
  let hkdSgd: number | null = null;

  results.forEach((res, i) => {
    const symbol = allSymbols[i];
    if (res.status === 'fulfilled' && res.value && res.value.length > 0) {
      const close = res.value[0].close;
      if (symbol === 'USDSGD=X') usdSgd = close;
      else if (symbol === 'HKDSGD=X') hkdSgd = close;
      else prices[symbol] = { price: close, currency: '' }; // currency resolved from holdings by caller
    }
  });

  const allEquityFetched = (EQUITY_TICKERS as readonly string[]).every(t => prices[t]?.price != null);
  if (!allEquityFetched || usdSgd === null || hkdSgd === null) return null;

  return {
    fxRates: { USDSGD: usdSgd, HKDSGD: hkdSgd },
    prices,
    stale: false,
    fetchedAt: date,
  };
}