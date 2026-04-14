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

export interface MonthlyPlanRow {
  ticker: string;
  targetSGD: number;
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
  plan: MonthlyPlanRow[];
}