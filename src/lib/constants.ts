import { Currency } from '@/types';

export const EQUITY_TICKERS = ['BRK-B', 'JK8.SI', '2823.HK', '2838.HK'] as const;
export const ALL_TICKERS = [...EQUITY_TICKERS, 'CASH'] as const;
export const FX_SYMBOLS = ['USDSGD=X', 'HKDSGD=X'] as const;

export const TICKER_NAME: Record<string, string> = {
  'BRK-B':   'Berkshire Hathaway Inc.',
  'JK8.SI':  'UOBAM FTSE China A50 Index ETF',
  '2823.HK': 'iShares FTSE A50 China Index ETF',
  '2838.HK': 'Hang Seng FTSE China 50 Index ETF',
  'CASH':    'Cash (SGD)',
};

export const TICKER_CURRENCY: Record<string, Currency> = {
  'BRK-B': 'USD',
  'JK8.SI': 'SGD',
  '2823.HK': 'HKD',
  '2838.HK': 'HKD',
  'CASH': 'SGD',
};

export const SHEET_NAMES = {
  HOLDINGS: 'Holdings',
  CASH: 'Cash',
  TRANSACTIONS: 'Transactions',
  MONTHLY_PLAN: 'MonthlyPlan',
  FX_RATES: 'FxRates',
} as const;

export const FALLBACK_FX_RATES = {
  USDSGD: 1.34,
  HKDSGD: 0.17,
} as const;