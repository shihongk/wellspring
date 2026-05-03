import { createHash } from 'crypto';

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function generateId(
  date: string,
  description: string,
  amount: number,
  account: string,
): string {
  const key = `${date}|${description}|${amount}|${account}`;
  return createHash('sha256').update(key).digest('hex').slice(0, 16);
}

export function parseAmount(raw: string): number {
  let s = raw.trim();
  // strip CR suffix
  if (s.toUpperCase().endsWith('CR')) s = s.slice(0, -2).trim();
  // strip parentheses
  if (s.startsWith('(') && s.endsWith(')')) s = s.slice(1, -1);
  // strip commas
  s = s.replace(/,/g, '');
  return parseFloat(s);
}

export function parseDDMMM(raw: string, year: number): string {
  const parts = raw.trim().split(/\s+/);
  const day = parseInt(parts[0], 10);
  const month = MONTHS[parts[1].toLowerCase()];
  if (!month) throw new Error(`Unknown month: ${parts[1]}`);
  return `${year}-${pad(month)}-${pad(day)}`;
}

export function parseDDMMMYYYY(raw: string): string {
  // e.g. '19Mar2026'
  const match = raw.trim().match(/^(\d{2})([A-Za-z]{3})(\d{4})$/);
  if (!match) throw new Error(`Cannot parse date: ${raw}`);
  const day = parseInt(match[1], 10);
  const month = MONTHS[match[2].toLowerCase()];
  const year = parseInt(match[3], 10);
  if (!month) throw new Error(`Unknown month: ${match[2]}`);
  return `${year}-${pad(month)}-${pad(day)}`;
}

export function inferYear(txMonth: number, stmtEndMonth: number, stmtEndYear: number): number {
  return txMonth > stmtEndMonth ? stmtEndYear - 1 : stmtEndYear;
}

export function directionFromDelta(balance: number, prevBalance: number): 'debit' | 'credit' {
  return balance <= prevBalance ? 'debit' : 'credit';
}

export function isCreditFromSuffix(raw: string): boolean {
  return raw.trim().toUpperCase().endsWith('CR');
}

export function isCreditFromParens(raw: string): boolean {
  const s = raw.trim();
  return s.startsWith('(') && s.endsWith(')');
}
