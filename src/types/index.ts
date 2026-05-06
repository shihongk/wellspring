export type Currency = 'USD' | 'SGD' | 'HKD';
export type TransactionType = 'BUY' | 'SELL';

export interface Holding {
  ticker: string;
  name: string;
  shares: number;
  avgCostLocal: number;
  currency: Currency;
}

export interface Transaction {
  id: string;
  date: string;           // YYYY-MM-DD
  ticker: string;
  type: TransactionType;
  shares: number;
  priceLocal: number;
  currency: Currency;
}

export interface CashAccount {
  account: string;
  currency: 'SGD';
  amount: number;
}

export interface CashPosition {
  accounts: CashAccount[];
  SGD: number; // total
}

export interface TargetAllocationRow {
  ticker: string;
  targetPct: number; // 0–100
}

export interface InvestmentScheduleRow {
  month: string;       // "Apr 2026" (MMM YYYY)
  ticker: string;
  name: string;
  plannedSGD: number;
}

export interface PlanPageData {
  targetAllocations: TargetAllocationRow[];
  schedule: InvestmentScheduleRow[];
  cashSGD: number;
}

export interface FxRates {
  USDSGD: number;
  HKDSGD: number;
}

export interface PortfolioHolding extends Holding {
  currentPriceLocal: number | null;
  currentPriceSGD: number | null;
  totalValueSGD: number | null;
  costBasisSGD: number;
  unrealizedGainSGD: number | null;
  unrealizedGainPct: number | null;
  allocationPct: number | null;
}

export interface PortfolioSnapshot {
  pricesStale: boolean;
  pricesFetchedAt: string | null;
  fxRates: FxRates;
  totalValueSGD: number | null;
  holdings: PortfolioHolding[];
  cash: {
    SGD: number;
    allocationPct: number | null;
  };
}

export interface PortfolioHistoryEntry {
  date: string;         // YYYY-MM-DD
  totalValueSGD: number;
  fxUSDSGD: number;
  fxHKDSGD: number;
  recordedAt: string;   // ISO 8601 UTC
}

export interface ExpenseTransaction {
  id: string;
  date: string;           // YYYY-MM-DD (transaction date)
  postDate: string;       // YYYY-MM-DD (same as date if only one date col)
  description: string;
  amount: number;         // always positive
  direction: 'debit' | 'credit';
  balance: number | null; // null for credit cards
  account: string;        // e.g. "UOB Preferred Visa"
  category: string;
  sourceFile: string;
  excluded?: boolean;
  oneOff?: boolean;
}

export interface ExpenseRule {
  merchant: string; // case-insensitive substring match
  category: string;
}

export interface ExpenseProjectionOverride {
  month: string;      // YYYY-MM
  category: string;
  amount: number;
}

export interface InflationSettings {
  expenseInflationRate: number;
  incomeGrowthRate: number;
}

export type ProjectionMode = 'rolling' | 'annual' | 'semiannual' | 'latest' | 'fixed';

export interface CategoryProjectionSetting {
  mode: ProjectionMode;
  fixedAmount?: number;
}

export interface CpfBalance {
  date: string;   // YYYY-MM-DD (as of date)
  oa: number;
  sa: number;
  ma: number;
}

export interface RetirementOneOff {
  id: string;
  year: number;
  description: string;
  amountSGD: number;
  inTodaysPrices?: boolean;
}

export interface CpfProjectionYear {
  year: number;
  age: number;
  oa: number;
  sa: number;           // 0 after age 55
  ma: number;
  ra: number;           // created at 55
  totalCpf: number;
  monthlyContribEmployee: number;
  monthlyContribEmployer: number;
  cpfLifeMonthlyPayout: number | null;   // non-null from payout start age
  brsWithdrawal: number;                 // cash withdrawn at age 55 (OA above BRS); 0 all other years
}

export interface RetirementProjectionYear {
  year: number;
  age: number;
  investments: number;         // total portfolio value SGD
  cpf: CpfProjectionYear;
  cashReserve: number;
  netWorth: number;
  netMonthlyCashFlow: number;
  oneOffExpenses: number;      // total one-offs in this year
}

export interface RetirementSettings {
  dob: string;                                    // 'YYYY-MM'
  retirementAge: number;                          // default 65
  payoutStartAge: number;                         // default 65, max 70
  tickerReturns: Record<string, number>;          // ticker → annual % e.g. { 'BRK-B': 8 }
  grossMonthlySalaryOverride: number | null;      // null = derived from expense projections
  inflationRate: number;                          // annual % for today's-prices one-offs, default 2.5
}

export interface CpfTransaction {
  date: string;     // YYYY-MM-DD
  code: string;     // e.g. CON, HSE, INT, MSL, CSL, MED, DPS, HPS
  ref: string;      // employer ref label e.g. 'JUL 2025A' for CON rows; '' for others
  oaChange: number; // signed — negative means deduction from OA
  saChange: number;
  maChange: number;
}