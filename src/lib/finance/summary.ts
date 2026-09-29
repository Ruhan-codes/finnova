import type { Transaction } from "./types";
import { inr } from "./format";

export type FinanceSummary = {
  totalTransactions: number;
  monthCount: number;
  totalIncome: number;
  totalSpent: number;
  net: number;
  avgMonthlySpend: number;
  topCategories: { category: string; amount: number; share: number }[];
  topMerchants: { merchant: string; amount: number; count: number }[];
  subscriptions: { merchant: string; amount: number }[];
  monthly: { month: string; income: number; spent: number }[];
  recentTransactions: {
    date: string;
    merchant: string;
    category: string;
    amount: number;
    method: string;
  }[];
  largestExpenses: {
    date: string;
    merchant: string;
    category: string;
    amount: number;
  }[];
};

export function buildFinanceSummary(txs: Transaction[]): FinanceSummary {
  const expenses = txs.filter((t) => t.amount < 0);
  const income = txs.filter((t) => t.amount > 0);
  const totalSpent = expenses.reduce((s, t) => s + -t.amount, 0);
  const totalIncome = income.reduce((s, t) => s + t.amount, 0);

  const cat = new Map<string, number>();
  const merch = new Map<string, { amount: number; count: number }>();
  const monthly = new Map<string, { income: number; spent: number }>();
  for (const t of txs) {
    const d = new Date(t.date);
    const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const mm = monthly.get(mk) ?? { income: 0, spent: 0 };
    if (t.amount < 0) {
      mm.spent += -t.amount;
      cat.set(t.category, (cat.get(t.category) ?? 0) + -t.amount);
      const m = merch.get(t.merchant) ?? { amount: 0, count: 0 };
      m.amount += -t.amount;
      m.count += 1;
      merch.set(t.merchant, m);
    } else {
      mm.income += t.amount;
    }
    monthly.set(mk, mm);
  }

  const monthCount = Math.max(1, monthly.size);
  const topCategories = [...cat.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([category, amount]) => ({
      category,
      amount: Math.round(amount),
      share: totalSpent ? Math.round((amount / totalSpent) * 100) : 0,
    }));

  const topMerchants = [...merch.entries()]
    .sort((a, b) => b[1].amount - a[1].amount)
    .slice(0, 10)
    .map(([merchant, v]) => ({ merchant, amount: Math.round(v.amount), count: v.count }));

  const subsMap = new Map<string, number>();
  for (const t of txs) {
    if (t.recurring && t.amount < 0) {
      subsMap.set(t.merchant, (subsMap.get(t.merchant) ?? 0) + -t.amount);
    }
  }
  const subscriptions = [...subsMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([merchant, amount]) => ({ merchant, amount: Math.round(amount) }));

  const monthlyArr = [...monthly.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, v]) => ({ month, income: Math.round(v.income), spent: Math.round(v.spent) }));

  const recent = [...txs]
    .sort((a, b) => +new Date(b.date) - +new Date(a.date))
    .slice(0, 15)
    .map((t) => ({
      date: t.date.slice(0, 10),
      merchant: t.merchant,
      category: t.category,
      amount: Math.round(t.amount),
      method: t.paymentMethod,
    }));

  const largest = [...expenses]
    .sort((a, b) => a.amount - b.amount)
    .slice(0, 10)
    .map((t) => ({
      date: t.date.slice(0, 10),
      merchant: t.merchant,
      category: t.category,
      amount: Math.round(t.amount),
    }));

  return {
    totalTransactions: txs.length,
    monthCount,
    totalIncome: Math.round(totalIncome),
    totalSpent: Math.round(totalSpent),
    net: Math.round(totalIncome - totalSpent),
    avgMonthlySpend: Math.round(totalSpent / monthCount),
    topCategories,
    topMerchants,
    subscriptions,
    monthly: monthlyArr,
    recentTransactions: recent,
    largestExpenses: largest,
  };
}

export function summaryToPrompt(s: FinanceSummary): string {
  if (!s.totalTransactions) {
    return "The user has not imported any transactions yet. Politely ask them to import a CSV or SMS export first.";
  }
  return `USER FINANCIAL DATA (currency: INR, formatted with ${inr(0).replace(/[\d.,]/g, "")}):

Overview:
- Transactions: ${s.totalTransactions} across ${s.monthCount} month(s)
- Total income: ${inr(s.totalIncome)} (avg ${inr(Math.round(s.totalIncome / s.monthCount))}/mo)
- Total spent: ${inr(s.totalSpent)} (avg ${inr(s.avgMonthlySpend)}/mo)
- Net: ${inr(s.net)}
- Savings rate: ${s.totalIncome ? Math.round(((s.totalIncome - s.totalSpent) / s.totalIncome) * 100) : 0}%

Monthly breakdown:
${s.monthly.map((m) => `- ${m.month}: income ${inr(m.income)}, spent ${inr(m.spent)}`).join("\n")}

Top categories by spend:
${s.topCategories.map((c, i) => `${i + 1}. ${c.category} — ${inr(c.amount)} (${c.share}%)`).join("\n")}

Top merchants:
${s.topMerchants.map((m, i) => `${i + 1}. ${m.merchant} — ${inr(m.amount)} across ${m.count} txns`).join("\n")}

Recurring subscriptions detected (${s.subscriptions.length}):
${s.subscriptions.length ? s.subscriptions.map((x) => `- ${x.merchant}: ${inr(x.amount)}`).join("\n") : "- none detected"}

Largest single expenses:
${s.largestExpenses.map((t) => `- ${t.date} ${t.merchant} (${t.category}): ${inr(t.amount)}`).join("\n")}

Recent transactions:
${s.recentTransactions.map((t) => `- ${t.date} ${t.merchant} (${t.category}) ${inr(t.amount)} via ${t.method}`).join("\n")}`;
}
