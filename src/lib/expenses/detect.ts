export type StatementType =
  | 'uob-deposit'
  | 'uob-credit'
  | 'citi-credit'
  | 'hsbc-credit-premier'
  | 'hsbc-credit-revolution'
  | 'hsbc-composite'
  | 'amex-credit'
  | 'unknown';

export function detectStatementType(filename: string, text: string): StatementType {
  if (text.includes('customer.service@uobgroup.com')) return 'uob-deposit';
  if (text.includes('card.centre@uobgroup.com')) return 'uob-credit';
  if (/Citibank\s*Singapore/i.test(text)) return 'citi-credit';
  if (/American\s+Express/i.test(text)) return 'amex-credit';

  const upper = text.toUpperCase();
  if (upper.includes('HSBC')) {
    if (upper.includes('COMPOSITE')) return 'hsbc-composite';
    if (upper.includes('REVOLUTION')) return 'hsbc-credit-revolution';
    return 'hsbc-credit-premier';
  }

  // Filename fallback for image PDFs (no text layer)
  const fn = filename.toUpperCase();
  if (fn.includes('REVOLUTION')) return 'hsbc-credit-revolution';
  if (fn.includes('COMPOSITE')) return 'hsbc-composite';
  if (fn.includes('HSBC')) return 'hsbc-credit-premier';

  return 'unknown';
}
