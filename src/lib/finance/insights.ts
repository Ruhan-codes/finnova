import type { Transaction } from "./types";
import type { Analytics } from "./analytics";
import { inr, localDateKey } from "./format";

// ---------- Daily breakdown ----------
export type DayBreakdown = {
  date: string;
  total: number;
  count: number;
  merchants: { merchant: string; amount: number; share: number; count: number }[];
  categories: { category: string; amount: number; share: number }[];
  status: "normal" | "warning" | "high" | "unusual" | "none";
  statusLabel: string;
  vsAverage: number; // percentage diff vs typical weekday spending (-100..+X)
  insight: string;
  recommendation: string;
};

export function buildDayBreakdown(
  dayKey: string,
  txs: Transaction[],
  a: Analytics,
): DayBreakdown {
  const dayTxs = txs.filter(
    (t) => t.amount < 0 && localDateKey(t.date) === dayKey,
  );
  const total = dayTxs.reduce((s, t) => s + -t.amount, 0);
  const merchMap = new Map<string, { amount: number; count: number }>();
  const catMap = new Map<string, number>();
  for (const t of dayTxs) {
    const m = merchMap.get(t.merchant) ?? { amount: 0, count: 0 };
    m.amount += -t.amount;
    m.count += 1;
    merchMap.set(t.merchant, m);
    catMap.set(t.category, (catMap.get(t.category) ?? 0) + -t.amount);
  }
  const merchants = [...merchMap.entries()]
    .sort((a, b) => b[1].amount - a[1].amount)
    .map(([merchant, v]) => ({
      merchant,
      amount: Math.round(v.amount),
      count: v.count,
      share: total ? Math.round((v.amount / total) * 100) : 0,
    }));
  const categories = [...catMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([category, amount]) => ({
      category,
      amount: Math.round(amount),
      share: total ? Math.round((amount / total) * 100) : 0,
    }));

  const [yy, mm, dd] = dayKey.split("-").map(Number);
  const d = new Date(yy, (mm ?? 1) - 1, dd ?? 1);
  const isWeekend = d.getDay() === 0 || d.getDay() === 6;
  const wkw = a.weekendVsWeekday;
  const typicalDaily = isWeekend
    ? wkw.weekend / Math.max(1, Math.round((a.monthCount * 30 * 2) / 7))
    : wkw.weekday / Math.max(1, Math.round((a.monthCount * 30 * 5) / 7));
  const baseline = typicalDaily > 0 ? typicalDaily : a.averages.dailySpend;
  const vsAverage = baseline > 0 ? Math.round(((total - baseline) / baseline) * 100) : 0;

  let status: DayBreakdown["status"] = "none";
  let statusLabel = "No Activity";
  if (total > 0) {
    if (vsAverage >= 120 || total >= 8000) {
      status = "unusual";
      statusLabel = "Unusual Transaction";
    } else if (vsAverage >= 50) {
      status = "high";
      statusLabel = "High Spending";
    } else if (vsAverage >= 20) {
      status = "warning";
      statusLabel = "Above Normal";
    } else {
      status = "normal";
      statusLabel = "Normal";
    }
  }

  let insight = "No transactions recorded for this day.";
  let recommendation = "Track daily to keep control of your budget.";
  if (total > 0) {
    if (vsAverage >= 20) {
      insight = `Your spending today was ${vsAverage}% higher than your typical ${isWeekend ? "weekend" : "weekday"} spend of ${inr(Math.round(baseline))}.`;
    } else if (vsAverage <= -20) {
      insight = `You spent ${Math.abs(vsAverage)}% less than your usual ${isWeekend ? "weekend" : "weekday"} day. Well controlled.`;
    } else {
      insight = `Spending stayed within your normal ${isWeekend ? "weekend" : "weekday"} range (~${inr(Math.round(baseline))}).`;
    }
    const top = merchants[0];
    if (top && top.share >= 50) {
      recommendation = `${top.merchant} took ${top.share}% of today's spend (${inr(top.amount)}). Cutting one similar order this week could free up ~${inr(Math.round(top.amount * 0.5))}.`;
    } else if (categories[0]?.category?.match(/food|swiggy|delivery|zomato/i)) {
      recommendation = `Reducing food delivery by ₹250 this weekend keeps your savings goal on track.`;
    } else if (vsAverage >= 50) {
      recommendation = `Try a no-spend day tomorrow to balance today's higher-than-usual spend.`;
    } else {
      recommendation = `Today's spend supports your goals. Keep it up.`;
    }
  }

  return {
    date: dayKey,
    total: Math.round(total),
    count: dayTxs.length,
    merchants,
    categories,
    status,
    statusLabel,
    vsAverage,
    insight,
    recommendation,
  };
}

// ---------- Monthly AI summary ----------
export type MonthlySummary = {
  totalSpend: number;
  totalIncome: number;
  savings: number;
  highestCategory: { category: string; amount: number } | null;
  lowestCategory: { category: string; amount: number } | null;
  noSpendDays: number;
  trendPct: number; // vs previous month
  anomalyCount: number;
  daysWithinBudget: number;
  narrative: string[];
};

export function buildMonthlySummary(txs: Transaction[], year: number, month: number, a: Analytics): MonthlySummary {
  const monthTxs = txs.filter((t) => {
    const d = new Date(t.date);
    return d.getFullYear() === year && d.getMonth() === month;
  });
  const expenses = monthTxs.filter((t) => t.amount < 0);
  const income = monthTxs.filter((t) => t.amount > 0);
  const totalSpend = Math.round(expenses.reduce((s, t) => s + -t.amount, 0));
  const totalIncome = Math.round(income.reduce((s, t) => s + t.amount, 0));

  const catMap = new Map<string, number>();
  for (const t of expenses) catMap.set(t.category, (catMap.get(t.category) ?? 0) + -t.amount);
  const cats = [...catMap.entries()].sort((a, b) => b[1] - a[1]);
  const highestCategory = cats[0] ? { category: cats[0][0], amount: Math.round(cats[0][1]) } : null;
  const lowestCategory = cats.length ? { category: cats[cats.length - 1][0], amount: Math.round(cats[cats.length - 1][1]) } : null;

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const spendByDay = new Map<string, number>();
  for (const t of expenses) {
    const k = localDateKey(t.date);
    spendByDay.set(k, (spendByDay.get(k) ?? 0) + -t.amount);
  }
  let noSpendDays = 0;
  let daysWithinBudget = 0;
  const dailyBudget = a.averages.dailySpend > 0 ? a.averages.dailySpend * 1.2 : 2000;
  const today = new Date();
  for (let d = 1; d <= daysInMonth; d++) {
    const dt = new Date(year, month, d);
    if (dt > today) continue;
    const key = localDateKey(dt);
    const v = spendByDay.get(key) ?? 0;
    if (v === 0) noSpendDays++;
    if (v <= dailyBudget) daysWithinBudget++;
  }

  const prevKey = `${month === 0 ? year - 1 : year}-${String(month === 0 ? 12 : month).padStart(2, "0")}`;
  const prev = a.monthly.find((m) => m.month === prevKey);
  const trendPct = prev && prev.expenses > 0 ? Math.round(((totalSpend - prev.expenses) / prev.expenses) * 100) : 0;

  const anomalyCount = a.anomalies.filter((an) => {
    const d = new Date(an.date);
    return d.getFullYear() === year && d.getMonth() === month;
  }).length;

  const narrative: string[] = [];
  if (prev && prev.expenses > 0) {
    narrative.push(
      trendPct < 0
        ? `You spent ${Math.abs(trendPct)}% less than last month.`
        : trendPct > 0
        ? `You spent ${trendPct}% more than last month.`
        : `Spending was steady versus last month.`,
    );
  }
  // Per-category deltas
  if (prev) {
    const prevMonthTxs = txs.filter((t) => {
      const d = new Date(t.date);
      const pk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      return t.amount < 0 && pk === prev.month;
    });
    const prevCat = new Map<string, number>();
    for (const t of prevMonthTxs) prevCat.set(t.category, (prevCat.get(t.category) ?? 0) + -t.amount);
    const deltas: { cat: string; pct: number }[] = [];
    for (const [cat, amt] of catMap.entries()) {
      const p = prevCat.get(cat) ?? 0;
      if (p >= 500) {
        const pct = Math.round(((amt - p) / p) * 100);
        if (Math.abs(pct) >= 10) deltas.push({ cat, pct });
      }
    }
    deltas.sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct));
    for (const d of deltas.slice(0, 3)) {
      narrative.push(
        d.pct > 0
          ? `${d.cat} increased by ${d.pct}%.`
          : `${d.cat} spending reduced by ${Math.abs(d.pct)}%.`,
      );
    }
  }
  if (anomalyCount > 0) narrative.push(`${anomalyCount} unusual transaction${anomalyCount === 1 ? "" : "s"} were detected.`);
  narrative.push(`You stayed within your recommended budget on ${daysWithinBudget} day${daysWithinBudget === 1 ? "" : "s"}.`);

  return {
    totalSpend,
    totalIncome,
    savings: totalIncome - totalSpend,
    highestCategory,
    lowestCategory,
    noSpendDays,
    trendPct,
    anomalyCount,
    daysWithinBudget,
    narrative,
  };
}

// ---------- Budget Coach ----------
export type CoachCategory = {
  name: string;
  allocated: number;
  spent: number;
  remaining: number;
  pct: number;
  status: "on_track" | "near_limit" | "exceeded";
  advice: string;
};
export type BudgetCoach = {
  income: number;
  savingsGoal: number;
  categories: CoachCategory[];
  headline: string;
};

export function buildBudgetCoach(a: Analytics, income: number, savingsGoal: number): BudgetCoach {
  if (!a.hasData) {
    return { income, savingsGoal, categories: [], headline: "Import transactions to activate your AI Budget Coach." };
  }
  const spendable = Math.max(0, income - savingsGoal);
  const totalCat = a.categories.reduce((s, c) => s + c.amount, 0) || 1;
  const categories: CoachCategory[] = a.categories.slice(0, 8).map((c) => {
    const share = c.amount / totalCat;
    const allocated = Math.round(spendable * share);
    const spent = Math.round(c.amount / a.monthCount);
    const remaining = allocated - spent;
    const pct = allocated ? Math.min(150, Math.round((spent / allocated) * 100)) : 0;
    let status: CoachCategory["status"] = "on_track";
    if (pct >= 100) status = "exceeded";
    else if (pct >= 80) status = "near_limit";
    let advice = `You're on track for ${c.category}. ${inr(remaining)} still available this month.`;
    if (status === "near_limit") advice = `Reduce ${c.category} by ${inr(Math.round(allocated * 0.1))} this month to stay on track with your savings goal.`;
    if (status === "exceeded") advice = `${c.category} is over budget by ${inr(Math.abs(remaining))}. Skip 1–2 discretionary purchases this week to recover.`;
    return { name: c.category, allocated, spent, remaining, pct, status, advice };
  });

  // Headline recommendation
  const overs = categories.filter((c) => c.status !== "on_track").slice(0, 2);
  let headline: string;
  if (overs.length >= 2) {
    const totalCut = overs.reduce((s, c) => s + Math.max(0, c.spent - c.allocated * 0.9), 0);
    const annual = Math.round(totalCut * 12);
    headline = `Reducing ${overs[0].name} by ${inr(Math.round(overs[0].spent * 0.2))} and ${overs[1].name} by ${inr(Math.round(overs[1].spent * 0.2))} could increase your yearly savings by approximately ${inr(annual + 5000)}.`;
  } else if (overs.length === 1) {
    headline = `Trimming ${overs[0].name} by ${inr(Math.round(overs[0].spent * 0.2))} monthly would keep every goal on schedule.`;
  } else {
    headline = `Great work — every category is within budget. Consider raising your savings goal by ${inr(Math.round(income * 0.05))} this month.`;
  }
  return { income, savingsGoal, categories, headline };
}

// ---------- Money leak detector ----------
export type MoneyLeak = {
  id: string;
  merchant: string;
  category: string;
  reason: string;
  type: "subscription" | "food_delivery" | "impulse" | "weekend" | "late_night" | "coffee" | "recurring";
  count: number;
  monthlyAmount: number;
  potentialMonthlySaving: number;
  potentialAnnualSaving: number;
  suggestion: string;
};

export function detectMoneyLeaks(txs: Transaction[], a: Analytics): { leaks: MoneyLeak[]; totalMonthlySaving: number; totalAnnualSaving: number; recommendation: string } {
  const leaks: MoneyLeak[] = [];
  const monthCount = Math.max(1, a.monthCount);
  const now = Date.now();

  // 1) Subscriptions
  for (const s of a.subscriptions) {
    leaks.push({
      id: `sub_${s.merchant}`,
      merchant: s.merchant,
      category: "Subscription",
      reason: "Recurring subscription",
      type: "subscription",
      count: s.count,
      monthlyAmount: s.amount,
      potentialMonthlySaving: s.amount, // cancelling recovers full amount
      potentialAnnualSaving: s.amount * 12,
      suggestion: `Review usage — cancel if unused in the last 30 days.`,
    });
  }

  // 2) Food delivery / high-frequency merchants (Swiggy, Zomato)
  const merchTxs = new Map<string, Transaction[]>();
  for (const t of txs) {
    if (t.amount >= 0) continue;
    const arr = merchTxs.get(t.merchant) ?? [];
    arr.push(t);
    merchTxs.set(t.merchant, arr);
  }
  for (const [merchant, arr] of merchTxs.entries()) {
    const monthly = arr.length / monthCount;
    const monthlyAmount = arr.reduce((s, t) => s + -t.amount, 0) / monthCount;
    if (/swiggy|zomato|ubereats|dunzo|food/i.test(merchant) && monthly >= 4) {
      leaks.push({
        id: `food_${merchant}`,
        merchant,
        category: "Food Delivery",
        reason: `${Math.round(monthly)} orders per month`,
        type: "food_delivery",
        count: Math.round(monthly),
        monthlyAmount: Math.round(monthlyAmount),
        potentialMonthlySaving: Math.round(monthlyAmount * 0.4),
        potentialAnnualSaving: Math.round(monthlyAmount * 0.4 * 12),
        suggestion: "Cook 2 meals a week to cut orders by ~40%.",
      });
    }
    if (/starbucks|coffee|cafe|barista|blue tokai|third wave/i.test(merchant) && monthly >= 4) {
      leaks.push({
        id: `coffee_${merchant}`,
        merchant,
        category: "Coffee & Cafe",
        reason: `${Math.round(monthly)} visits per month`,
        type: "coffee",
        count: Math.round(monthly),
        monthlyAmount: Math.round(monthlyAmount),
        potentialMonthlySaving: Math.round(monthlyAmount * 0.5),
        potentialAnnualSaving: Math.round(monthlyAmount * 0.5 * 12),
        suggestion: "Brew at home 3 mornings a week to save half of this.",
      });
    }
  }

  // 3) Late-night spending (10 PM – 4 AM)
  const nightTxs = txs.filter((t) => {
    if (t.amount >= 0) return false;
    const h = new Date(t.date).getHours();
    return h >= 22 || h <= 4;
  });
  if (nightTxs.length >= 5) {
    const monthlyAmount = nightTxs.reduce((s, t) => s + -t.amount, 0) / monthCount;
    leaks.push({
      id: "leak_late_night",
      merchant: "Late-night spending",
      category: "Lifestyle",
      reason: `${nightTxs.length} late-night transactions`,
      type: "late_night",
      count: nightTxs.length,
      monthlyAmount: Math.round(monthlyAmount),
      potentialMonthlySaving: Math.round(monthlyAmount * 0.5),
      potentialAnnualSaving: Math.round(monthlyAmount * 0.5 * 12),
      suggestion: "Set a 10 PM spending lock — most impulse purchases happen after 10 PM.",
    });
  }

  // 4) Weekend overspending
  const wkw = a.weekendVsWeekday;
  if (wkw.weekendShare >= 35) {
    const monthlyAmount = wkw.weekend / monthCount;
    leaks.push({
      id: "leak_weekend",
      merchant: "Weekend spending",
      category: "Lifestyle",
      reason: `${wkw.weekendShare}% of your spend is on weekends`,
      type: "weekend",
      count: 0,
      monthlyAmount: Math.round(monthlyAmount),
      potentialMonthlySaving: Math.round(monthlyAmount * 0.2),
      potentialAnnualSaving: Math.round(monthlyAmount * 0.2 * 12),
      suggestion: "Plan one 'low-spend' weekend a month.",
    });
  }

  // 5) Impulse shopping (large one-off shopping merchants)
  for (const [merchant, arr] of merchTxs.entries()) {
    if (!/amazon|flipkart|myntra|ajio|nykaa|meesho|shopping/i.test(merchant)) continue;
    const monthly = arr.length / monthCount;
    if (monthly < 2) continue;
    const monthlyAmount = arr.reduce((s, t) => s + -t.amount, 0) / monthCount;
    const large = arr.filter((t) => -t.amount > 2500).length;
    if (large >= 2) {
      leaks.push({
        id: `impulse_${merchant}`,
        merchant,
        category: "Shopping",
        reason: `${large} high-value orders in ${monthCount} month(s)`,
        type: "impulse",
        count: arr.length,
        monthlyAmount: Math.round(monthlyAmount),
        potentialMonthlySaving: Math.round(monthlyAmount * 0.25),
        potentialAnnualSaving: Math.round(monthlyAmount * 0.25 * 12),
        suggestion: "Apply a 48-hour rule before high-value purchases.",
      });
    }
  }

  // Dedupe by id, keep top savings
  const uniq = new Map<string, MoneyLeak>();
  for (const l of leaks) if (!uniq.has(l.id)) uniq.set(l.id, l);
  const list = [...uniq.values()].sort((a, b) => b.potentialMonthlySaving - a.potentialMonthlySaving);

  const totalMonthlySaving = list.reduce((s, l) => s + l.potentialMonthlySaving, 0);
  const totalAnnualSaving = totalMonthlySaving * 12;
  const recommendation =
    list.length === 0
      ? "No significant money leaks detected. Your spending patterns look healthy."
      : `Cancelling one unused subscription and reducing food delivery by 20% can save approximately ${inr(Math.min(totalMonthlySaving, Math.round(totalMonthlySaving * 0.6)))} every month.`;

  return { leaks: list, totalMonthlySaving, totalAnnualSaving, recommendation };
}

// ---------- Health strengths / weaknesses ----------
export type HealthDetail = {
  score: number;
  label: string;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
};

export function buildHealthDetail(a: Analytics): HealthDetail {
  const h = a.health;
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const suggestions: string[] = [];

  if (h.savingsRatio >= 0.2) strengths.push("Healthy savings rate");
  else weaknesses.push("Savings rate below 20%");

  if (h.disciplineScore >= 0.7) strengths.push("Consistent monthly spending");
  else weaknesses.push("Monthly spending varies too much");

  if (h.expenseRatio <= 0.75) strengths.push("Low expense-to-income ratio");
  else weaknesses.push("Expenses take up most of your income");

  if (a.subscriptions.length <= 3) strengths.push("Subscription load is under control");
  else weaknesses.push("Too many active subscriptions");

  if (a.weekendVsWeekday.weekendShare >= 35) weaknesses.push("Weekend spending is high");
  const foodCat = a.categories.find((c) => /food|swiggy|zomato/i.test(c.category));
  if (foodCat && foodCat.share >= 25) weaknesses.push("Food delivery frequency is above average");

  if (h.savingsRatio < 0.2) suggestions.push(`Aim for at least 20% savings — trim your top category by 10%.`);
  if (a.weekendVsWeekday.weekendShare >= 35) suggestions.push(`Plan one low-spend weekend per month.`);
  if (a.subscriptions.length > 3) suggestions.push(`Cancel one unused subscription to lift the score.`);
  if (foodCat && foodCat.share >= 25) suggestions.push(`Cut food delivery orders by 2 per week.`);
  if (suggestions.length === 0) suggestions.push(`Keep it up — you're already above the 85+ zone.`);

  return {
    score: h.score,
    label: h.label,
    strengths: strengths.length ? strengths : ["Getting started — import more data for deeper insight."],
    weaknesses,
    suggestions,
  };
}

// ---------- Decision Simulator ----------
export type SimulationInput = {
  reduceFoodPct?: number; // 0-100
  reduceShoppingPct?: number;
  cancelSubscriptions?: string[]; // merchant names
  dailySaving?: number;
};
export type SimulationResult = {
  monthlySavings: number;
  annualSavings: number;
  newHealthScore: number;
  goalDaysEarlier: number;
  breakdown: { label: string; monthly: number }[];
};

export function simulate(a: Analytics, input: SimulationInput): SimulationResult {
  let monthly = 0;
  const breakdown: { label: string; monthly: number }[] = [];
  if (input.reduceFoodPct && input.reduceFoodPct > 0) {
    const foodMonthly = a.categories.filter((c) => /food|swiggy|zomato/i.test(c.category)).reduce((s, c) => s + c.amount, 0) / Math.max(1, a.monthCount);
    const saved = Math.round((foodMonthly * input.reduceFoodPct) / 100);
    if (saved > 0) { monthly += saved; breakdown.push({ label: `Reduce food delivery by ${input.reduceFoodPct}%`, monthly: saved }); }
  }
  if (input.reduceShoppingPct && input.reduceShoppingPct > 0) {
    const shopMonthly = a.categories.filter((c) => /shopping|amazon|flipkart|myntra/i.test(c.category)).reduce((s, c) => s + c.amount, 0) / Math.max(1, a.monthCount);
    const saved = Math.round((shopMonthly * input.reduceShoppingPct) / 100);
    if (saved > 0) { monthly += saved; breakdown.push({ label: `Reduce shopping by ${input.reduceShoppingPct}%`, monthly: saved }); }
  }
  if (input.cancelSubscriptions?.length) {
    let subSaved = 0;
    for (const m of input.cancelSubscriptions) {
      const s = a.subscriptions.find((x) => x.merchant === m);
      if (s) subSaved += s.amount;
    }
    if (subSaved > 0) { monthly += subSaved; breakdown.push({ label: `Cancel ${input.cancelSubscriptions.length} subscription(s)`, monthly: subSaved }); }
  }
  if (input.dailySaving && input.dailySaving > 0) {
    const saved = input.dailySaving * 30;
    monthly += saved;
    breakdown.push({ label: `Save ₹${input.dailySaving}/day`, monthly: saved });
  }
  const annual = monthly * 12;

  // Health delta: assume savings ratio improves
  const income = a.averages.monthlyIncome || (a.averages.monthlySpend + monthly + 1000);
  const newSavingsRatio = Math.min(1, (a.averages.monthlyIncome - a.averages.monthlySpend + monthly) / Math.max(1, income));
  const scoreBoost = Math.round(Math.max(0, newSavingsRatio - a.health.savingsRatio) * 45);
  const newHealthScore = Math.min(100, a.health.score + scoreBoost);
  const goalDaysEarlier = Math.round((monthly / Math.max(500, a.averages.monthlySpend)) * 30);
  return { monthlySavings: monthly, annualSavings: annual, newHealthScore, goalDaysEarlier, breakdown };
}
