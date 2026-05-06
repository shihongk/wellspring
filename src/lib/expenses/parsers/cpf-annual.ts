import { CpfBalance, CpfTransaction } from '@/types';

const MONTHS: Record<string, string> = {
  JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06',
  JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12',
};

export function parseCpfAnnual(text: string): CpfBalance {
  const yearMatch = text.match(/Yearly Statement of Account for (\d{4})/);
  if (!yearMatch) throw new Error('Could not find statement year');
  const year = yearMatch[1];

  const balRegex = /(\d{2})\s*(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)BAL\$([\d,]+\.\d{2})\$([\d,]+\.\d{2})\$([\d,]+\.\d{2})/g;
  let last: RegExpExecArray | null = null;
  let m: RegExpExecArray | null;
  while ((m = balRegex.exec(text)) !== null) last = m;
  if (!last) throw new Error('Could not find closing balance row');

  const [, day, mon, oa, sa, ma] = last;
  return {
    date: `${year}-${MONTHS[mon]}-${day}`,
    oa: parseFloat(oa.replace(/,/g, '')),
    sa: parseFloat(sa.replace(/,/g, '')),
    ma: parseFloat(ma.replace(/,/g, '')),
  };
}

function parseSignedAmount(raw: string): number {
  const negative = raw.startsWith('-');
  return (negative ? -1 : 1) * parseFloat(raw.replace(/[-$,]/g, ''));
}

export function parseCpfTransactions(text: string): CpfTransaction[] {
  const yearMatch = text.match(/Yearly Statement of Account for (\d{4})/);
  if (!yearMatch) throw new Error('Could not find statement year');
  const year = yearMatch[1];

  const MON = 'JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC';
  const txRegex = new RegExp(
    `(\\d{2})\\s*(${MON})([A-Z]{2,10})((?:[A-Z]{3} \\d{4}[A-Z])?)` +
    `(-?\\$[\\d,]+\\.\\d{2})(-?\\$[\\d,]+\\.\\d{2})(-?\\$[\\d,]+\\.\\d{2})`,
    'g',
  );

  const results: CpfTransaction[] = [];
  let m: RegExpExecArray | null;
  while ((m = txRegex.exec(text)) !== null) {
    const [, day, mon, code, ref, rawOa, rawSa, rawMa] = m;
    if (code === 'BAL') continue;
    results.push({
      date: `${year}-${MONTHS[mon]}-${day}`,
      code,
      ref: ref.trim(),
      oaChange: parseSignedAmount(rawOa),
      saChange: parseSignedAmount(rawSa),
      maChange: parseSignedAmount(rawMa),
    });
  }
  return results;
}
