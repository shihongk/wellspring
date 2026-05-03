import { ExpenseRule } from '@/types';
import { BUILT_IN_RULES } from '@/lib/constants';

export function categorize(description: string, userRules: ExpenseRule[]): string {
  const upper = description.toUpperCase();

  for (const rule of userRules) {
    if (upper.includes(rule.merchant.toUpperCase())) return rule.category;
  }

  for (const [merchant, category] of Object.entries(BUILT_IN_RULES)) {
    if (upper.includes(merchant.toUpperCase())) return category;
  }

  return 'Other';
}
