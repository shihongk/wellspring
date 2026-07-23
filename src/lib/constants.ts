import { Currency, ExpenseRule } from '@/types';

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
  MARGIN: 'Margin',
  TRANSACTIONS: 'Transactions',
  TARGET_ALLOCATION: 'TargetAllocation',
  INVESTMENT_SCHEDULE: 'InvestmentSchedule',
  FX_RATES: 'FxRates',
  PORTFOLIO_HISTORY: 'PortfolioHistory',
  EXPENSES: 'Expenses',
  EXPENSE_RULES: 'ExpenseRules',
  EXPENSE_PROJECTIONS: 'ExpenseProjections',
  CPF_BALANCES: 'CpfBalances',
  RETIREMENT_ONE_OFFS: 'RetirementOneOffs',
  CPF_TRANSACTIONS: 'CpfTransactions',
} as const;

// CPF contribution rates by age bracket (from 1 Jan 2026)
// maxAge is exclusive upper bound (e.g. 55 means age < 55)
export const CPF_CONTRIBUTION_RATES: { maxAge: number; employer: number; employee: number; total: number }[] = [
  { maxAge: 55,  employer: 0.17,   employee: 0.20,   total: 0.37   },
  { maxAge: 60,  employer: 0.16,   employee: 0.18,   total: 0.34   },
  { maxAge: 65,  employer: 0.125,  employee: 0.125,  total: 0.25   },
  { maxAge: 70,  employer: 0.09,   employee: 0.075,  total: 0.165  },
  { maxAge: Infinity, employer: 0.075, employee: 0.05, total: 0.125 },
];

// CPF allocation rates by age bracket — fractions of gross monthly wage
// At age ≥55 SA contributions route to RA (handled in cpf engine, sa shown as 0 here)
export const CPF_ALLOCATION_RATES: { maxAge: number; oa: number; sa: number; ma: number }[] = [
  { maxAge: 35,       oa: 0.23,  sa: 0.06,  ma: 0.08   },
  { maxAge: 45,       oa: 0.21,  sa: 0.07,  ma: 0.09   },
  { maxAge: 50,       oa: 0.19,  sa: 0.08,  ma: 0.10   },
  { maxAge: 55,       oa: 0.15,  sa: 0.115, ma: 0.105  },
  { maxAge: 60,       oa: 0.12,  sa: 0,     ma: 0.105  },
  { maxAge: 65,       oa: 0.035, sa: 0,     ma: 0.105  },
  { maxAge: Infinity, oa: 0.01,  sa: 0,     ma: 0.105  },
];

export const CPF_INTEREST = {
  oa: 0.025,
  sa: 0.04,
  ma: 0.04,
  ra: 0.04,
  extraOnFirst60k: 0.01,  // extra 1% on first $60k combined (capped at $20k from OA)
} as const;

export const CPF_RETIREMENT_SUMS_2026 = {
  brs: 110200,
  frs: 220400,
  ers: 440800,
  growthRate: 0.035,
} as const;

export const CPF_LIFE_BASE_BRS_MONTHLY = 950;  // estimated monthly payout at 2026 BRS
export const CPF_LIFE_DEFERRAL_BONUS = 0.07;   // +7% per year deferred past 65

export const HDB_MONTHLY_OA = 1205;
export const HDB_LOAN_END_YEAR = 2048;
export const MA_BASE_ANNUAL_DEDUCTION = 818;
export const MA_DEDUCTION_BASE_YEAR = 2025;
export const MA_HEALTHCARE_INFLATION = 0.05;

export const FALLBACK_FX_RATES = {
  USDSGD: 1.34,
  HKDSGD: 0.17,
} as const;

export const EXPENSE_CATEGORIES = [
  // Spending (alphabetical)
  'Bank Charges',
  'Books & Stationery',
  'Electronics',
  'Entertainment',
  'Fees & Charges',
  'Food & Drink',
  'Groceries',
  'Healthcare',
  'Home Improvement',
  'Insurance',
  'Investment',
  'Mortgage',
  'Personal Care',
  'Shopping',
  'Sports',
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
  'NTUC INCOME': 'Insurance',
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
  // Electronics
  'COURTS': 'Electronics',
  'HARVEY NORMAN': 'Electronics',
  'CHALLENGER': 'Electronics',
  'GAIN CITY': 'Electronics',
  'BEST DENKI': 'Electronics',
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
  // Insurance
  'FWD': 'Insurance',
  'AIA': 'Insurance',
  'PRUDENTIAL': 'Insurance',
  'GREAT EASTERN': 'Insurance',
  'SINGLIFE': 'Insurance',
  'MSIG': 'Insurance',
  'ETIQA': 'Insurance',
  'TOKIO MARINE': 'Insurance',
  // Bank charges
  'CCY CONVERSION FEE': 'Bank Charges',
  'SERVICE FEE': 'Bank Charges',
  'ANNUAL FEE': 'Bank Charges',
  'INTEREST CHARGE': 'Bank Charges',
};

// Structured rules (match + action beyond a plain merchant→category substring).
export const BUILT_IN_STRUCTURED_RULES: ExpenseRule[] = [
  { merchant: 'GIRO PAYMENT', category: 'Transfer' },
  { merchant: 'AUTOPAY', category: 'Transfer' },
  { merchant: 'BILL PAYMENT', category: 'Transfer' },
  { merchant: 'PAYMENT RECEIVED', category: 'Transfer' }, // Amex "PAYMENT RECEIVED" wording
  { merchant: 'HIB-', amount: 1.00, exclude: true },      // HSBC $1 verification transfers
];