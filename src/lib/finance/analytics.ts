import type { Transaction, Anomaly, Alert } from "./types";
import { inr } from "./format";

export type CategoryBreakdown = { category: string; amount: number; share: number };
export type MerchantBreakdown = { merchant: string; amount: number; count: number };
export type MonthlyPoint = { month: string; label: string; income: number; expenses: number; savings: number };
export type WeeklyPoint = { week: string; expenses: number };
export type Subscription = { merchant: string; amount: number; count: number };
export type Insight = { title: string; detail: string; tone: "info" | "success" | "warning" | "danger" };
export type HealthBreakdown = {
  score: number;
  label: string;
  explanation: string;
  savingsRatio: number;
  expenseRatio: number;
  disciplineScore: number;
  emergencyMonths: number;
};

export type Analytics = {
  hasData: boolean;
  totalTransactions: number;
  monthCount: number;
  currentMonth: { income: number; expenses: number; savings: number; budgetSuggested: number; budgetRemaining: number };
  totals: { income: number; expenses: number; savings: number; net: number };
  averages: { monthlySpend: number; monthlyIncome: number; dailySpend: number };
  categories: CategoryBreakdown[];
  merchants: MerchantBreakdown[];
  monthly: MonthlyPoint[];
  weekly: WeeklyPoint[];
  weekendVsWeekday: { weekend: number; weekday: number; weekendShare: number };
  subscriptions: Subscription[];
  recent: Transaction[];
  largest: Transaction[];
  forecastNextMonth: number;
  cashFlow: number;
  health: HealthBreakdown;
  insights: Insight[];
  anomalies: Anomaly[];
  alerts: Alert[];
};

const EMPTY_HEALTH: HealthBreakdown = {
  score: 0,
  label: "No data",
  explanation: "Import your transactions to unlock a personalized financial health score.",
  savingsRatio: 0,
  expenseRatio: 0,
  disciplineScore: 0,
  emergencyMonths: 0,
};

export const EMPTY_ANALYTICS: Analytics = {
  hasData: false,
  totalTransactions: 0,
  monthCount: 0,
  currentMonth: { income: 0, expenses: 0, savings: 0, budgetSuggested: 0, budgetRemaining: 0 },
  totals: { income: 0, expenses: 0, savings: 0, net: 0 },
  averages: { monthlySpend: 0, monthlyIncome: 0, dailySpend: 0 },
  categories: [],
  merchants: [],
  monthly: [],
  weekly: [],
  weekendVsWeekday: { weekend: 0, weekday: 0, weekendShare: 0 },
  subscriptions: [],
  recent: [],
  largest: [],
  forecastNextMonth: 0,
  cashFlow: 0,
  health: EMPTY_HEALTH,
  insights: [],
  anomalies: [],
  alerts: [],
};

const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const monthLabel = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
};
const weekKey = (d: Date) => {
  const onejan = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((+d - +onejan) / 86400000 + onejan.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, "0")}`;
};

function detectAnomalies(txs: Transaction[]): Anomaly[] {
  const byMerchant = new Map<string, number[]>();
  for (const t of txs) {
    if (t.amount >= 0) continue;
    const arr = byMerchant.get(t.merchant) ?? [];
    arr.push(-t.amount);
    byMerchant.set(t.merchant, arr);
  }
  const out: Anomaly[] = [];
  const now = Date.now();
  const recentTx = [...txs].sort((a, b) => +new Date(b.date) - +new Date(a.date));
  for (const t of recentTx) {
    if (t.amount >= 0) continue;
    if (now - +new Date(t.date) > 30 * 86400000) continue;
    const hist = byMerchant.get(t.merchant) ?? [];
    if (hist.length < 3) continue;
    const mean = hist.reduce((s, v) => s + v, 0) / hist.length;
    const actual = -t.amount;
    if (actual < mean * 1.6 || actual - mean < 400) continue;
    const deviation = Math.round(((actual - mean) / mean) * 100);
    const risk: Anomaly["risk"] = deviation > 200 ? "High" : deviation > 100 ? "Medium" : "Low";
    out.push({
      id: `an_${t.id}`,
      merchant: t.merchant,
      expected: Math.round(mean),
      actual: Math.round(actual),
      deviation,
      confidence: Math.min(98, 70 + Math.round(deviation / 5)),
      risk,
      reason: `Amount is ${(actual / mean).toFixed(1)}× your typical ${t.merchant} spend.`,
      date: t.date,
    });
    if (out.length >= 12) break;
  }
  return out;
}

function buildAlerts(anomalies: Anomaly[], subs: Subscription[]): Alert[] {
  const alerts: Alert[] = anomalies.slice(0, 8).map((a) => ({
    id: `al_${a.id}`,
    title: a.risk === "High" ? "Unusual Spending Detected" : "Spending Above Normal",
    message: `${a.merchant}: ${a.reason}`,
    risk: a.risk,
    status: "Pending",
    date: a.date,
    merchant: a.merchant,
    expected: a.expected,
    actual: a.actual,
  }));
  if (subs.length >= 3) {
    alerts.push({
      id: "al_subs",
      title: "Subscription Load",
      message: `You have ${subs.length} recurring subscriptions costing ~${inr(subs.reduce((s, x) => s + x.amount, 0))}. Consider trimming unused ones.`,
      risk: "Medium",
      status: "Pending",
      date: new Date().toISOString(),
    });
  }
  return alerts;
}

function buildInsights(a: {
  categories: CategoryBreakdown[];
  merchants: MerchantBreakdown[];
  monthly: MonthlyPoint[];
  weekend: number;
  weekday: number;
  subs: Subscription[];
  income: number;
  spent: number;
}): Insight[] {
  const out: Insight[] = [];
  const { categories, monthly, weekend, weekday, subs, income, spent } = a;

  if (categories[0]) {
    out.push({
      title: `${categories[0].category} is your biggest spend`,
      detail: `${categories[0].share}% of your total expenses (${inr(categories[0].amount)}).`,
      tone: categories[0].share > 35 ? "warning" : "info",
    });
  }
  const totalWkWd = weekend + weekday;
  if (totalWkWd > 0) {
    const share = Math.round((weekend / totalWkWd) * 100);
    if (share > 30) {
      out.push({
        title: `Weekend spending is high`,
        detail: `You spend ${share}% of your total on weekends — roughly ${inr(weekend)}.`,
        tone: "warning",
      });
    }
  }
  if (monthly.length >= 2) {
    const last = monthly[monthly.length - 1];
    const prev = monthly[monthly.length - 2];
    if (prev.expenses > 0) {
      const diff = Math.round(((last.expenses - prev.expenses) / prev.expenses) * 100);
      if (Math.abs(diff) >= 5) {
        out.push({
          title: diff > 0 ? `Expenses up ${diff}% this month` : `Expenses down ${-diff}% this month`,
          detail: `${last.label}: ${inr(last.expenses)} vs ${prev.label}: ${inr(prev.expenses)}.`,
          tone: diff > 0 ? "danger" : "success",
        });
      }
    }
  }
  if (subs.length) {
    const total = subs.reduce((s, x) => s + x.amount, 0);
    out.push({
      title: `You could save ~${inr(Math.round(total * 0.4))} / month`,
      detail: `${subs.length} recurring subscriptions cost ${inr(total)}. Cancelling a few could free up cash.`,
      tone: "success",
    });
  }
  if (income > 0) {
    const savingsRate = Math.round(((income - spent) / income) * 100);
    out.push({
      title: savingsRate >= 20 ? `Strong savings rate: ${savingsRate}%` : `Savings rate: ${savingsRate}%`,
      detail:
        savingsRate >= 20
          ? `You're keeping ${inr(income - spent)} on average — well above the 20% healthy benchmark.`
          : `Aim for at least 20% savings. Trim the top 1–2 expense categories to get there.`,
      tone: savingsRate >= 20 ? "success" : "warning",
    });
  }
  return out;
}

function computeHealth(input: {
  income: number;
  spent: number;
  monthly: MonthlyPoint[];
  subs: Subscription[];
  monthCount: number;
}): HealthBreakdown {
  const { income, spent, monthly, subs, monthCount } = input;
  const savingsRatio = income > 0 ? Math.max(0, (income - spent) / income) : 0;
  const expenseRatio = income > 0 ? Math.min(1.5, spent / income) : 1;
  // Discipline: lower std-dev in monthly spend = better
  const spends = monthly.map((m) => m.expenses).filter((v) => v > 0);
  const mean = spends.length ? spends.reduce((s, v) => s + v, 0) / spends.length : 0;
  const variance = spends.length ? spends.reduce((s, v) => s + (v - mean) ** 2, 0) / spends.length : 0;
  const stdev = Math.sqrt(variance);
  const cv = mean > 0 ? stdev / mean : 1; // coefficient of variation
  const disciplineScore = Math.max(0, Math.min(1, 1 - cv));
  const emergencyMonths = spent > 0 ? Math.max(0, (income - spent) * monthCount) / (spent / Math.max(1, monthCount)) : 0;
  const subsLoad = income > 0 ? Math.min(0.3, subs.reduce((s, x) => s + x.amount, 0) / (income * monthCount)) : 0;

  const raw =
    savingsRatio * 45 +
    (1 - Math.min(1, expenseRatio)) * 25 +
    disciplineScore * 15 +
    Math.min(1, emergencyMonths / 3) * 10 +
    (1 - subsLoad / 0.3) * 5;
  const score = Math.max(0, Math.min(100, Math.round(raw)));
  const label = score >= 85 ? "Excellent" : score >= 70 ? "Healthy" : score >= 55 ? "Fair" : score >= 40 ? "Needs Work" : "At Risk";
  const explanation =
    `Savings rate ${Math.round(savingsRatio * 100)}%, expense ratio ${Math.round(expenseRatio * 100)}%, ` +
    `spending discipline ${Math.round(disciplineScore * 100)}%, emergency runway ~${emergencyMonths.toFixed(1)} months.`;
  return {
    score,
    label,
    explanation,
    savingsRatio,
    expenseRatio,
    disciplineScore,
    emergencyMonths,
  };
}

export function computeAnalytics(txs: Transaction[]): Analytics {
  if (!txs.length) return EMPTY_ANALYTICS;

  const now = new Date();
  const curKey = monthKey(now);

  const expenses = txs.filter((t) => t.amount < 0);
  const income = txs.filter((t) => t.amount > 0);
  const totalSpent = expenses.reduce((s, t) => s + -t.amount, 0);
  const totalIncome = income.reduce((s, t) => s + t.amount, 0);

  const catMap = new Map<string, number>();
  const merchMap = new Map<string, { amount: number; count: number }>();
  const monthlyMap = new Map<string, { income: number; expenses: number }>();
  const weeklyMap = new Map<string, number>();
  let weekend = 0;
  let weekday = 0;
  const merchantCounts = new Map<string, { count: number; amounts: number[] }>();

  for (const t of txs) {
    const d = new Date(t.date);
    const mk = monthKey(d);
    const wk = weekKey(d);
    const mrow = monthlyMap.get(mk) ?? { income: 0, expenses: 0 };
    if (t.amount < 0) {
      mrow.expenses += -t.amount;
      catMap.set(t.category, (catMap.get(t.category) ?? 0) + -t.amount);
      const m = merchMap.get(t.merchant) ?? { amount: 0, count: 0 };
      m.amount += -t.amount;
      m.count += 1;
      merchMap.set(t.merchant, m);
      weeklyMap.set(wk, (weeklyMap.get(wk) ?? 0) + -t.amount);
      const dow = d.getDay();
      if (dow === 0 || dow === 6) weekend += -t.amount;
      else weekday += -t.amount;
      const mc = merchantCounts.get(t.merchant) ?? { count: 0, amounts: [] };
      mc.count += 1;
      mc.amounts.push(-t.amount);
      merchantCounts.set(t.merchant, mc);
    } else {
      mrow.income += t.amount;
    }
    monthlyMap.set(mk, mrow);
  }

  const monthly: MonthlyPoint[] = [...monthlyMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([m, v]) => ({
      month: m,
      label: monthLabel(m),
      income: Math.round(v.income),
      expenses: Math.round(v.expenses),
      savings: Math.round(v.income - v.expenses),
    }));

  const weekly: WeeklyPoint[] = [...weeklyMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-8)
    .map(([week, expenses]) => ({ week: week.split("-W")[1] ? `W${week.split("-W")[1]}` : week, expenses: Math.round(expenses) }));

  const categories: CategoryBreakdown[] = [...catMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([category, amount]) => ({
      category,
      amount: Math.round(amount),
      share: totalSpent ? Math.round((amount / totalSpent) * 100) : 0,
    }));

  const merchants: MerchantBreakdown[] = [...merchMap.entries()]
    .sort((a, b) => b[1].amount - a[1].amount)
    .slice(0, 12)
    .map(([merchant, v]) => ({ merchant, amount: Math.round(v.amount), count: v.count }));

  // Subscriptions: from flag OR auto-detect (>=3 charges, low variance)
  const subsAuto = new Map<string, Subscription>();
  for (const [merchant, mc] of merchantCounts.entries()) {
    if (mc.count < 3) continue;
    const avg = mc.amounts.reduce((s, v) => s + v, 0) / mc.amounts.length;
    const variance = mc.amounts.reduce((s, v) => s + (v - avg) ** 2, 0) / mc.amounts.length;
    const cv = avg > 0 ? Math.sqrt(variance) / avg : 1;
    if (cv < 0.2 && avg < 5000) {
      subsAuto.set(merchant, { merchant, amount: Math.round(avg), count: mc.count });
    }
  }
  for (const t of txs) {
    if (t.recurring && t.amount < 0 && !subsAuto.has(t.merchant)) {
      const mc = merchantCounts.get(t.merchant);
      const amt = mc ? mc.amounts.reduce((s, v) => s + v, 0) / mc.amounts.length : -t.amount;
      subsAuto.set(t.merchant, { merchant: t.merchant, amount: Math.round(amt), count: mc?.count ?? 1 });
    }
  }
  const subscriptions = [...subsAuto.values()].sort((a, b) => b.amount - a.amount);

  const monthCount = Math.max(1, monthly.length);
  const avgMonthlySpend = Math.round(totalSpent / monthCount);
  const avgMonthlyIncome = Math.round(totalIncome / monthCount);
  const dayCount = Math.max(1, new Set(txs.map((t) => t.date.slice(0, 10))).size);
  const dailySpend = Math.round(totalSpent / dayCount);

  const curMonth = monthlyMap.get(curKey) ?? { income: 0, expenses: 0 };
  const budgetSuggested = Math.max(avgMonthlyIncome * 0.8, avgMonthlySpend);
  const currentMonth = {
    income: Math.round(curMonth.income),
    expenses: Math.round(curMonth.expenses),
    savings: Math.round(curMonth.income - curMonth.expenses),
    budgetSuggested: Math.round(budgetSuggested),
    budgetRemaining: Math.round(Math.max(0, budgetSuggested - curMonth.expenses)),
  };

  const recent = [...txs].sort((a, b) => +new Date(b.date) - +new Date(a.date)).slice(0, 8);
  const largest = [...expenses].sort((a, b) => a.amount - b.amount).slice(0, 8);

  // Forecast: linear regression over last months
  const forecastNextMonth = (() => {
    if (monthly.length < 2) return avgMonthlySpend;
    const xs = monthly.map((_, i) => i);
    const ys = monthly.map((m) => m.expenses);
    const n = xs.length;
    const meanX = xs.reduce((s, v) => s + v, 0) / n;
    const meanY = ys.reduce((s, v) => s + v, 0) / n;
    let num = 0, den = 0;
    for (let i = 0; i < n; i++) {
      num += (xs[i] - meanX) * (ys[i] - meanY);
      den += (xs[i] - meanX) ** 2;
    }
    const slope = den ? num / den : 0;
    const intercept = meanY - slope * meanX;
    return Math.max(0, Math.round(slope * n + intercept));
  })();

  const health = computeHealth({ income: totalIncome, spent: totalSpent, monthly, subs: subscriptions, monthCount });
  const anomalies = detectAnomalies(txs);
  const alerts = buildAlerts(anomalies, subscriptions);
  const insights = buildInsights({
    categories,
    merchants,
    monthly,
    weekend,
    weekday,
    subs: subscriptions,
    income: totalIncome,
    spent: totalSpent,
  });

  return {
    hasData: true,
    totalTransactions: txs.length,
    monthCount,
    currentMonth,
    totals: {
      income: Math.round(totalIncome),
      expenses: Math.round(totalSpent),
      savings: Math.round(totalIncome - totalSpent),
      net: Math.round(totalIncome - totalSpent),
    },
    averages: { monthlySpend: avgMonthlySpend, monthlyIncome: avgMonthlyIncome, dailySpend },
    categories,
    merchants,
    monthly,
    weekly,
    weekendVsWeekday: {
      weekend: Math.round(weekend),
      weekday: Math.round(weekday),
      weekendShare: weekend + weekday ? Math.round((weekend / (weekend + weekday)) * 100) : 0,
    },
    subscriptions,
    recent,
    largest,
    forecastNextMonth,
    cashFlow: Math.round(totalIncome - totalSpent),
    health,
    insights,
    anomalies,
    alerts,
  };
}
