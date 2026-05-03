import { Currency } from '@/types';

export const EQUITY_TICKERS = ['BRK-B', 'JK8.SI', '2823.HK', '2838.HK', 'TSM'] as const;
export const ALL_TICKERS = [...EQUITY_TICKERS, 'CASH'] as const;
export const FX_SYMBOLS = ['USDSGD=X', 'HKDSGD=X'] as const;

export const TICKER_NAME: Record<string, string> = {
  'BRK-B':   'Berkshire Hathaway Inc.',
  'JK8.SI':  'UOBAM FTSE China A50 Index ETF',
  '2823.HK': 'iShares FTSE A50 China Index ETF',
  '2838.HK': 'Hang Seng FTSE China 50 Index ETF',
  'TSM':     'Taiwan Semiconductor Manufacturing',
  'CASH':    'Cash (SGD)',
};

export const TICKER_CURRENCY: Record<string, Currency> = {
  'BRK-B': 'USD',
  'JK8.SI': 'SGD',
  '2823.HK': 'HKD',
  '2838.HK': 'HKD',
  'TSM': 'USD',
  'CASH': 'SGD',
};

export const SHEET_NAMES = {
  HOLDINGS: 'Holdings',
  CASH: 'Cash',
  TRANSACTIONS: 'Transactions',
  TARGET_ALLOCATION: 'TargetAllocation',
  INVESTMENT_SCHEDULE: 'InvestmentSchedule',
  FX_RATES: 'FxRates',
  PORTFOLIO_HISTORY: 'PortfolioHistory',
  EXPENSES: 'Expenses',
  EXPENSE_RULES: 'ExpenseRules',
} as const;

export const FALLBACK_FX_RATES = {
  USDSGD: 1.34,
  HKDSGD: 0.17,
} as const;

export const EXPENSE_CATEGORIES = [
  // Spending (alphabetical)
  'Bank Charges',
  'Books & Stationery',
  'Entertainment',
  'Fees & Charges',
  'Food & Drink',
  'Groceries',
  'Healthcare',
  'Home Improvement',
  'Investment',
  'Mortgage',
  'Shopping',
  'Subscriptions',
  'Tax',
  'Transport',
  'Travel',
  'Utilities',
  // Income (alphabetical)
  'Income',
  'Interest',
  'Other Income',
  'Salary',
  // Meta (alphabetical)
  'Other',
  'Transfer',
] as const;

export const BUILT_IN_RULES: Record<string, string> = {
  // Transport — specific before general
  'GRAB FOOD': 'Food & Drink',
  'GRAB MART': 'Groceries',
  'GRAB': 'Transport',
  'COMFORT': 'Transport',
  'GOJEK': 'Transport',
  'TRANSIT LINK': 'Transport',
  'EZLINK': 'Transport',
  'SBS TRANSIT': 'Transport',
  'SMRT': 'Transport',
  // Groceries — specific before general
  'NTUC PHARMACY': 'Healthcare',
  'UNITY PHARMACY': 'Healthcare',
  'NTUC': 'Groceries',
  'FAIRPRICE': 'Groceries',
  'COLD STORAGE': 'Groceries',
  'GIANT': 'Groceries',
  'SHENG SIONG': 'Groceries',
  'PRIME SUPERMARKET': 'Groceries',
  // Food & Drink
  'MCDONALD': 'Food & Drink',
  'KFC': 'Food & Drink',
  'BURGER KING': 'Food & Drink',
  'SUBWAY': 'Food & Drink',
  'PIZZA HUT': 'Food & Drink',
  'DOMINO': 'Food & Drink',
  'STARBUCKS': 'Food & Drink',
  'TOAST BOX': 'Food & Drink',
  'YA KUN': 'Food & Drink',
  'KOPITIAM': 'Food & Drink',
  'KOUFU': 'Food & Drink',
  'FOOD JUNCTION': 'Food & Drink',
  'OLD CHANG KEE': 'Food & Drink',
  'BENGAWAN': 'Food & Drink',
  'FOODPANDA': 'Food & Drink',
  'DELIVEROO': 'Food & Drink',
  // Healthcare
  'POLYCLINIC': 'Healthcare',
  'DENTAL': 'Healthcare',
  'OPTICAL': 'Healthcare',
  'GUARDIAN': 'Healthcare',
  'WATSONS': 'Healthcare',
  'PARKWAY': 'Healthcare',
  'RAFFLES MEDICAL': 'Healthcare',
  // Entertainment
  'CINEMA': 'Entertainment',
  'CATHAY': 'Entertainment',
  'GOLDEN VILLAGE': 'Entertainment',
  'GV ': 'Entertainment',
  'SHAW': 'Entertainment',
  // Travel
  'SINGAPORE AIRLINES': 'Travel',
  'SCOOT': 'Travel',
  'JETSTAR': 'Travel',
  'AIR ASIA': 'Travel',
  'AIRASIA': 'Travel',
  'AGODA': 'Travel',
  'BOOKING.COM': 'Travel',
  'AIRBNB': 'Travel',
  'KLOOK': 'Travel',
  // Shopping — specific before general
  'AMAZON PRIME': 'Subscriptions',
  'AMAZON': 'Shopping',
  'LAZADA': 'Shopping',
  'SHOPEE': 'Shopping',
  'ZALORA': 'Shopping',
  'IKEA': 'Shopping',
  'MUJI': 'Shopping',
  'UNIQLO': 'Shopping',
  'ZARA': 'Shopping',
  'COURTS': 'Shopping',
  'HARVEY NORMAN': 'Shopping',
  'CHALLENGER': 'Shopping',
  // Subscriptions
  'SPOTIFY': 'Subscriptions',
  'NETFLIX': 'Subscriptions',
  'DISNEY': 'Subscriptions',
  'APPLE.COM': 'Subscriptions',
  'ICLOUD': 'Subscriptions',
  'GOOGLE': 'Subscriptions',
  'MICROSOFT': 'Subscriptions',
  'DROPBOX': 'Subscriptions',
  'GITHUB': 'Subscriptions',
  'OPENAI': 'Subscriptions',
  'ANTHROPIC': 'Subscriptions',
  // Investment
  'TIGER BROKERS': 'Investment',
  'MOOMOO': 'Investment',
  'INTERACTIVE BROKERS': 'Investment',
  'IBKR': 'Investment',
  'POEMS': 'Investment',
  'SAXO': 'Investment',
  'ENDOWUS': 'Investment',
  'SYFE': 'Investment',
  'STASHAWAY': 'Investment',
  'UOBKH': 'Investment',
  // Utilities
  'SINGTEL': 'Utilities',
  'STARHUB': 'Utilities',
  'CIRCLES': 'Utilities',
  'M1': 'Utilities',
  'SP GROUP': 'Utilities',
  'SP SERVICES': 'Utilities',
  // Transfers / payments
  'GIRO PAYMENT': 'Transfer',
  'FAST PAYMENT': 'Transfer',
  'PAYNOW': 'Transfer',
  'TRANSFER': 'Transfer',
  // Income
  'INWARD CREDIT': 'Other Income',
  'SALARY': 'Salary',
  'CREDIT INTEREST': 'Interest',
  'BONUS INTEREST': 'Interest',
  // Bank charges
  'CCY CONVERSION FEE': 'Bank Charges',
  'SERVICE FEE': 'Bank Charges',
  'ANNUAL FEE': 'Bank Charges',
  'INTEREST CHARGE': 'Bank Charges',
};