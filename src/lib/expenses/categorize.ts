import { ExpenseRule, ExpenseTransaction } from '@/types';
import { BUILT_IN_RULES, BUILT_IN_STRUCTURED_RULES } from '@/lib/constants';

const AMOUNT_EPSILON = 0.005;

const BUILT_IN_RULES_LIST: ExpenseRule[] = Object.entries(BUILT_IN_RULES)
  .map(([merchant, category]) => ({ merchant, category }));

export function ruleMatches(tx: ExpenseTransaction, rule: ExpenseRule): boolean {
  if (!tx.description.toUpperCase().includes(rule.merchant.toUpperCase())) return false;
  if (rule.account !== undefined && rule.account !== tx.account) return false;
  if (rule.amount !== undefined && Math.abs(tx.amount - rule.amount) > AMOUNT_EPSILON) return false;
  if (rule.direction !== undefined && rule.direction !== tx.direction) return false;
  return true;
}

function firstCategoryMatch(tx: ExpenseTransaction, ruleSets: ExpenseRule[][]): string | undefined {
  for (const rules of ruleSets) {
    const hit = rules.find(rule => rule.category && ruleMatches(tx, rule));
    if (hit) return hit.category;
  }
  return undefined;
}

export function applyRules(tx: ExpenseTransaction, userRules: ExpenseRule[]): { category: string; excluded: boolean } {
  const category = firstCategoryMatch(tx, [userRules, BUILT_IN_RULES_LIST, BUILT_IN_STRUCTURED_RULES]) ?? 'Other';
  const excluded = [userRules, BUILT_IN_STRUCTURED_RULES]
    .some(rules => rules.some(rule => rule.exclude && ruleMatches(tx, rule)));

  return { category, excluded };
}
