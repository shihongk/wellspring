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