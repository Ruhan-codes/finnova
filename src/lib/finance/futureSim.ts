// AI Financial Future Simulator — projection engine.
// Turns a single financial decision into two comparable futures.
import type { Analytics } from "./analytics";
import type { Transaction } from "./types";
import { detectMoneyLeaks } from "./insights";
import { scoreLeaks, computeLeakScore } from "./leakScore";
import { SMARTSAVE_GOAL, type SmartSaveState } from "./smartsave";

export type ScenarioKind = "reduce" | "save" | "cancel" | "purchase" | "emi" | "custom";

export type Scenario = {
  id: string;
  emoji: string;
  title: string;
  tagline: string;
  question: string;
  kind: ScenarioKind;
  /** category matcher for "reduce" scenarios */
  match?: string;
  reducePct?: number;
  dailySave?: number;
  /** merchant matcher for "cancel" */
  cancelMatch?: string;
  fallbackMonthly?: number;
  /** one-time purchase cost */
  cost?: number;
  /** EMI monthly outflow + tenure */
  emiMonthly?: number;
  emiMonths?: number;
};

export const SCENARIOS: Scenario[] = [
  { id: "phone", emoji: "📱", title: "Buy a New Phone", tagline: "₹65,000 one-time", question: "Can I buy this phone without breaking my goals?", kind: "purchase", cost: 65_000 },
  { id: "bike", emoji: "🚲", title: "Buy a Bike", tagline: "Bring the goal closer", question: "Should I buy the bike now or wait?", kind: "purchase", cost: SMARTSAVE_GOAL.target },
  { id: "vacation", emoji: "🏖", title: "Plan a Vacation", tagline: "₹45,000 trip", question: "Can I afford this vacation?", kind: "purchase", cost: 45_000 },
  { id: "food", emoji: "🍔", title: "Reduce Food Delivery", tagline: "Cut 40% of orders", question: "What if I order in less often?", kind: "reduce", match: "food|swiggy|zomato|delivery|restaurant|dining", reducePct: 40 },
  { id: "shopping", emoji: "🛒", title: "Reduce Shopping", tagline: "Cut 25% of impulse buys", question: "What if I shop more intentionally?", kind: "reduce", match: "shopping|amazon|flipkart|myntra|ajio", reducePct: 25 },
  { id: "coffee", emoji: "☕", title: "Reduce Coffee Purchases", tagline: "Half the café runs", question: "Do my coffee runs actually matter?", kind: "reduce", match: "coffee|cafe|starbucks|chai|barista", reducePct: 50 },
  { id: "netflix", emoji: "📺", title: "Cancel Netflix", tagline: "Drop one subscription", question: "Is this subscription worth keeping?", kind: "cancel", cancelMatch: "netflix", fallbackMonthly: 649 },
  { id: "emi", emoji: "💳", title: "Buy on EMI", tagline: "₹4,500 × 12 months", question: "Is buying this on EMI a good decision?", kind: "emi", emiMonthly: 4_500, emiMonths: 12 },
  { id: "daily200", emoji: "💰", title: "Save ₹200 Every Day", tagline: "Micro-saving habit", question: "What happens if I save ₹200 daily?", kind: "save", dailySave: 200 },
  { id: "custom", emoji: "➕", title: "Custom Scenario", tagline: "Describe your own decision", question: "Simulate my own decision", kind: "custom" },
];

export type FutureSnapshot = {
  monthlySavings: number;
  annualSavings: number;
  healthScore: number;
  leakScore: number;
  goalDate: Date;
  goalMonths: number;
  goalCompletionPct: number;
};

export type TimelineNode = { label: string; sub: string; highlight?: boolean };

export type Strategy = {
  id: "current" | "balanced" | "aggressive";
  name: string;
  difficulty: "None" | "Easy" | "Moderate" | "Demanding";
  description: string;
  snapshot: FutureSnapshot;
  monthlyDelta: number;
};

export type FutureProjection = {
  scenario: Scenario;
  customText?: string;
  monthlySaving: number;
  annualSaving: number;
  oneTimeCost: number;
  current: FutureSnapshot;
  projected: FutureSnapshot;
  daysEarlier: number;
  currentTimeline: TimelineNode[];
  projectedTimeline: TimelineNode[];
  benefits: string[];
  tradeOffs: string[];
  confidence: number;
  confidenceBasis: string;
  strategies: Strategy[];
  headline: string;
  reasoning: string[];
};

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

function categoryMonthly(a: Analytics, pattern: string): number {
  const re = new RegExp(pattern, "i");
  const total = a.categories
    .filter((c) => re.test(c.category))
    .reduce((s, c) => s + c.amount, 0);
  const merch = a.merchants.filter((m) => re.test(m.merchant)).reduce((s, m) => s + m.amount, 0);
  return Math.round(Math.max(total, merch) / Math.max(1, a.monthCount));
}

function baseMonthlySavings(a: Analytics): number {
  const diff = a.averages.monthlyIncome - a.averages.monthlySpend;
  if (diff > 0) return Math.round(diff);
  return Math.round(Math.max(1500, a.averages.monthlySpend * 0.08));
}

export function monthName(d: Date) {
  return d.toLocaleDateString("en-IN", { month: "long" });
}
export function fullDate(d: Date) {
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}

function buildSnapshot(
  a: Analytics,
  smart: SmartSaveState,
  baseLeakScore: number,
  monthlyRate: number,
  savedNow: number,
  leakReduction: number,
  healthBoost: number,
): FutureSnapshot {
  const remaining = Math.max(0, SMARTSAVE_GOAL.target - savedNow);
  const months = remaining <= 0 ? 0 : remaining / Math.max(500, monthlyRate);
  const goalDate = new Date();
  goalDate.setDate(goalDate.getDate() + Math.round(months * 30.44));
  return {
    monthlySavings: Math.round(monthlyRate),
    annualSavings: Math.round(monthlyRate * 12),
    healthScore: clamp(Math.round(a.health.score + healthBoost), 0, 100),
    leakScore: clamp(Math.round(baseLeakScore + leakReduction), 0, 100),
    goalDate,
    goalMonths: Math.round(months * 10) / 10,
    goalCompletionPct: clamp(Math.round((savedNow / SMARTSAVE_GOAL.target) * 100), 0, 100),
  };
}

function timeline(goalDate: Date, highlight: boolean): TimelineNode[] {
  const now = new Date();
  const m1 = new Date(now); m1.setMonth(m1.getMonth() + 3);
  const m2 = new Date(now); m2.setMonth(m2.getMonth() + 6);
  return [
    { label: "Today", sub: fullDate(now) },
    { label: monthName(m1), sub: `${m1.getFullYear()}` },
    { label: monthName(m2), sub: `${m2.getFullYear()}` },
    { label: "Goal reached", sub: fullDate(goalDate), highlight },
  ];
}

export function simulateFuture(
  txs: Transaction[],
  a: Analytics,
  smart: SmartSaveState,
  scenario: Scenario,
  intensity = 1,
  customText?: string,
): FutureProjection {
  const leaks = scoreLeaks(detectMoneyLeaks(txs, a).leaks, a);
  const baseLeakScore = computeLeakScore(leaks, a).score;
  const base = baseMonthlySavings(a);
  const savedNow = smart.savedAmount;

  let monthlySaving = 0;
  let oneTimeCost = 0;
  const benefits: string[] = [];
  const tradeOffs: string[] = [];
  const reasoning: string[] = [];
  let headline = "";

  const topLeak = leaks[0];
  const recoverable = leaks.reduce((s, l) => s + l.potentialMonthlySaving, 0);

  switch (scenario.kind) {
    case "reduce": {
      const cat = categoryMonthly(a, scenario.match ?? "");
      const pct = Math.round((scenario.reducePct ?? 30) * intensity);
      monthlySaving = Math.round((cat * Math.min(90, pct)) / 100);
      if (monthlySaving <= 0) monthlySaving = Math.round(Math.min(2500, a.averages.monthlySpend * 0.05) * intensity);
      headline = `Cutting ${scenario.title.replace(/^Reduce\s+/i, "").toLowerCase()} by ${Math.min(90, pct)}%`;
      reasoning.push(`You spend about ₹${cat.toLocaleString("en-IN")} a month in this category across ${a.totalTransactions} analysed transactions.`);
      reasoning.push(`Trimming ${Math.min(90, pct)}% of it frees ₹${monthlySaving.toLocaleString("en-IN")} every month without touching fixed bills.`);
      tradeOffs.push(`Fewer ${scenario.title.replace(/^Reduce\s+/i, "").toLowerCase()} — roughly ${Math.max(1, Math.round((pct / 100) * 8))} fewer occasions a month.`);
      tradeOffs.push("A small lifestyle adjustment in the first 3 weeks while the habit settles.");
      break;
    }
    case "save": {
      const daily = Math.round((scenario.dailySave ?? 200) * intensity);
      monthlySaving = daily * 30;
      headline = `Setting aside ₹${daily} every single day`;
      reasoning.push(`₹${daily}/day is ${Math.round((monthlySaving / Math.max(1, a.averages.monthlySpend)) * 100)}% of your average monthly spend of ₹${Math.round(a.averages.monthlySpend).toLocaleString("en-IN")}.`);
      reasoning.push(`Automating it on payday means the money leaves before discretionary spending starts.`);
      tradeOffs.push("Tighter day-to-day cash — keep a ₹5,000 buffer to avoid dipping back in.");
      tradeOffs.push("Requires daily consistency, not a one-time decision.");
      break;
    }
    case "cancel": {
      const re = new RegExp(scenario.cancelMatch ?? "", "i");
      const sub = a.subscriptions.find((s) => re.test(s.merchant));
      monthlySaving = Math.round(sub?.amount ?? scenario.fallbackMonthly ?? 500);
      headline = `Cancelling ${sub?.merchant ?? scenario.title.replace(/^Cancel\s+/i, "")}`;
      reasoning.push(sub
        ? `${sub.merchant} bills ₹${Math.round(sub.amount).toLocaleString("en-IN")} every month in your history — a fixed, recurring outflow.`
        : `No matching recurring charge was found in your data, so this uses a typical ₹${monthlySaving} plan price.`);
      reasoning.push(`Recurring charges compound: ₹${monthlySaving.toLocaleString("en-IN")}/mo is ₹${(monthlySaving * 12).toLocaleString("en-IN")} a year of guaranteed savings.`);
      tradeOffs.push("You lose the content library — consider a shared or ad-tier plan instead.");
      break;
    }
    case "purchase": {
      oneTimeCost = Math.round((scenario.cost ?? 0));
      monthlySaving = Math.round(Math.min(recoverable, base * 0.5) * intensity);
      headline = `Funding a ₹${oneTimeCost.toLocaleString("en-IN")} purchase`;
      reasoning.push(`A ₹${oneTimeCost.toLocaleString("en-IN")} purchase equals ${Math.ceil(oneTimeCost / Math.max(1, base))} months of your current ₹${base.toLocaleString("en-IN")}/mo savings capacity.`);
      reasoning.push(topLeak
        ? `To absorb it without derailing your goal, redirect the ₹${topLeak.potentialMonthlySaving.toLocaleString("en-IN")}/mo recoverable from ${topLeak.merchant} plus other detected leaks.`
        : `Your spending has no large recoverable leaks, so this purchase comes straight out of goal savings.`);
      tradeOffs.push(`Your savings goal moves back unless you offset ₹${monthlySaving.toLocaleString("en-IN")}/mo.`);
      tradeOffs.push("Emergency buffer thins for the next few months.");
      break;
    }
    case "emi": {
      const emi = Math.round((scenario.emiMonthly ?? 4500));
      const months = scenario.emiMonths ?? 12;
      monthlySaving = -emi;
      oneTimeCost = 0;
      headline = `Committing to ₹${emi.toLocaleString("en-IN")} × ${months} months`;
      reasoning.push(`An EMI is a fixed obligation: ₹${(emi * months).toLocaleString("en-IN")} locked over ${months} months regardless of how your income moves.`);
      reasoning.push(`That is ${Math.round((emi / Math.max(1, base)) * 100)}% of your current monthly savings capacity of ₹${base.toLocaleString("en-IN")}.`);
      tradeOffs.push("Reduced flexibility — the payment continues even in a bad month.");
      tradeOffs.push("Goal timeline stretches while the EMI runs.");
      break;
    }
    default: {
      monthlySaving = Math.round(Math.max(1000, recoverable * 0.5) * intensity);
      headline = customText?.trim() ? customText.trim() : "Your custom decision";
      reasoning.push(`Modelled against your ₹${Math.round(a.averages.monthlySpend).toLocaleString("en-IN")}/mo average spend and ${a.totalTransactions} analysed transactions.`);
      reasoning.push(topLeak ? `Your largest recoverable habit right now is ${topLeak.merchant} at ₹${topLeak.potentialMonthlySaving.toLocaleString("en-IN")}/mo.` : `No dominant leak detected — savings come from broad discipline.`);
      tradeOffs.push("Estimates widen for scenarios outside your recorded history.");
      break;
    }
  }

  const projectedRate = Math.max(500, base + monthlySaving);
  const savedAfterPurchase = Math.max(0, savedNow - oneTimeCost);

  const leakReduction = clamp(Math.round((Math.max(0, monthlySaving) / Math.max(1, a.averages.monthlySpend)) * 120), monthlySaving < 0 ? -10 : 0, 30);
  const healthBoost = clamp(Math.round((monthlySaving / Math.max(1, a.averages.monthlyIncome || a.averages.monthlySpend)) * 60), -15, 20);

  const current = buildSnapshot(a, smart, baseLeakScore, base, savedNow, 0, 0);
  const projected = buildSnapshot(a, smart, baseLeakScore, projectedRate, savedAfterPurchase, leakReduction, healthBoost);

  const daysEarlier = Math.round((+current.goalDate - +projected.goalDate) / 86_400_000);

  if (monthlySaving > 0) {
    benefits.push(`Save ₹${Math.round(monthlySaving).toLocaleString("en-IN")} every month`);
    benefits.push(`₹${Math.round(monthlySaving * 12).toLocaleString("en-IN")} extra per year`);
  }
  if (daysEarlier > 0) benefits.push(`${SMARTSAVE_GOAL.name} goal arrives ${daysEarlier} day${daysEarlier === 1 ? "" : "s"} earlier`);
  if (projected.healthScore > current.healthScore) benefits.push(`Financial Health improves ${current.healthScore} → ${projected.healthScore}`);
  if (projected.leakScore > current.leakScore) benefits.push(`Money Leak Score improves ${current.leakScore} → ${projected.leakScore}`);
  if (benefits.length === 0) benefits.push("Keeps the purchase within a planned, tracked budget");
  if (daysEarlier < 0) tradeOffs.push(`${SMARTSAVE_GOAL.name} goal slips by ${Math.abs(daysEarlier)} day${Math.abs(daysEarlier) === 1 ? "" : "s"}`);

  const confidence = clamp(
    Math.round(58 + Math.min(26, a.totalTransactions * 0.18) + Math.min(12, a.monthCount * 4) + (scenario.kind === "custom" ? -8 : 0)),
    55,
    97,
  );

  const strategies: Strategy[] = [
    {
      id: "current",
      name: "Current Lifestyle",
      difficulty: "None",
      description: "Change nothing. Your habits continue exactly as your history shows.",
      monthlyDelta: 0,
      snapshot: current,
    },
    {
      id: "balanced",
      name: "Balanced Saver",
      difficulty: monthlySaving < 0 ? "Moderate" : "Easy",
      description: "Apply this decision at a comfortable 60% intensity alongside your top leak fix.",
      monthlyDelta: Math.round(monthlySaving * 0.6),
      snapshot: buildSnapshot(a, smart, baseLeakScore, Math.max(500, base + monthlySaving * 0.6), savedAfterPurchase, Math.round(leakReduction * 0.6), Math.round(healthBoost * 0.6)),
    },
    {
      id: "aggressive",
      name: "Aggressive Saver",
      difficulty: "Demanding",
      description: "Full commitment plus trimming every detected leak in your spending.",
      monthlyDelta: Math.round(monthlySaving + recoverable * 0.5),
      snapshot: buildSnapshot(a, smart, baseLeakScore, Math.max(500, base + monthlySaving + recoverable * 0.5), savedAfterPurchase, clamp(leakReduction + 15, -10, 40), clamp(healthBoost + 6, -15, 25)),
    },
  ];

  return {
    scenario,
    customText,
    monthlySaving: Math.round(monthlySaving),
    annualSaving: Math.round(monthlySaving * 12),
    oneTimeCost,
    current,
    projected,
    daysEarlier,
    currentTimeline: timeline(current.goalDate, false),
    projectedTimeline: timeline(projected.goalDate, true),
    benefits,
    tradeOffs,
    confidence,
    confidenceBasis: `${a.totalTransactions} historical transactions across ${Math.max(1, a.monthCount)} month${a.monthCount === 1 ? "" : "s"}`,
    strategies,
    headline,
    reasoning,
  };
}

/** Compact, model-friendly description of the simulation for the AI coach. */
export function projectionContext(p: FutureProjection, a: Analytics): string {
  return [
    `Decision: ${p.scenario.title}${p.customText ? ` — "${p.customText}"` : ""}`,
    `Headline: ${p.headline}`,
    `Monthly impact: ₹${p.monthlySaving} (${p.monthlySaving >= 0 ? "saving" : "extra outflow"}), annual ₹${p.annualSaving}`,
    p.oneTimeCost ? `One-time cost: ₹${p.oneTimeCost}` : "",
    `Current future -> savings ₹${p.current.monthlySavings}/mo, health ${p.current.healthScore}/100, leak score ${p.current.leakScore}/100, ${SMARTSAVE_GOAL.name} goal on ${fullDate(p.current.goalDate)}`,
    `Projected future -> savings ₹${p.projected.monthlySavings}/mo, health ${p.projected.healthScore}/100, leak score ${p.projected.leakScore}/100, ${SMARTSAVE_GOAL.name} goal on ${fullDate(p.projected.goalDate)} (${p.daysEarlier} days earlier)`,
    `User baseline: avg monthly spend ₹${Math.round(a.averages.monthlySpend)}, avg monthly income ₹${Math.round(a.averages.monthlyIncome)}, ${a.totalTransactions} transactions, top categories: ${a.categories.slice(0, 4).map((c) => `${c.category} ₹${Math.round(c.amount / Math.max(1, a.monthCount))}/mo`).join(", ")}`,
    `Detected trade-offs: ${p.tradeOffs.join("; ")}`,
    `AI confidence: ${p.confidence}% based on ${p.confidenceBasis}`,
  ].filter(Boolean).join("\n");
}
