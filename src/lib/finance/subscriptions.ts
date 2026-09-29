import type { Transaction } from "./types";

export type SubscriptionFrequency = "Monthly" | "Quarterly" | "Yearly" | "Weekly" | "Irregular";

export type SubscriptionDetail = {
  merchant: string;
  category: string;
  monthlyAmount: number;
  annualCost: number;
  lastAmount: number;
  firstAmount: number;
  priceChange: number; // last - first
  count: number;
  firstDate: string;
  lastDate: string;
  nextExpected: string;
  frequency: SubscriptionFrequency;
  paymentMethod: string;
  confidence: number; // 0-100
  reason: string;
  monthsActive: number;
  usageGapDays: number;
};

const KNOWN = [
  "netflix", "spotify", "amazon prime", "prime video", "act fibernet", "act ",
  "jio", "airtel", "vi ", "vodafone", "gym", "cult",
  "google one", "google storage", "apple", "icloud", "swiggy one", "swiggy hd",
  "zomato gold", "zomato pro", "hotstar", "sonyliv", "sony liv", "zee5",
  "youtube", "linkedin", "notion", "chatgpt", "openai", "adobe", "figma",
  "microsoft", "dropbox", "canva", "grammarly", "audible", "kindle",
];

function isKnown(name: string): boolean {
  const n = name.toLowerCase();
  return KNOWN.some((k) => n.includes(k));
}

function median(nums: number[]): number {
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function inferFrequency(gapDays: number): SubscriptionFrequency {
  if (gapDays >= 5 && gapDays <= 10) return "Weekly";
  if (gapDays >= 25 && gapDays <= 35) return "Monthly";
  if (gapDays >= 85 && gapDays <= 100) return "Quarterly";
  if (gapDays >= 350 && gapDays <= 380) return "Yearly";
  return "Irregular";
}

function monthlyFrom(freq: SubscriptionFrequency, amount: number): number {
  switch (freq) {
    case "Weekly": return Math.round(amount * 4.33);
    case "Monthly": return Math.round(amount);
    case "Quarterly": return Math.round(amount / 3);
    case "Yearly": return Math.round(amount / 12);
    default: return Math.round(amount);
  }
}

export function detectSubscriptions(txs: Transaction[]): SubscriptionDetail[] {
  const byMerchant = new Map<string, Transaction[]>();
  for (const t of txs) {
    if (t.amount >= 0) continue;
    const list = byMerchant.get(t.merchant) ?? [];
    list.push(t);
    byMerchant.set(t.merchant, list);
  }

  const out: SubscriptionDetail[] = [];
  const now = Date.now();

  for (const [merchant, list] of byMerchant) {
    if (list.length < 2) continue;
    const sorted = [...list].sort((a, b) => +new Date(a.date) - +new Date(b.date));
    const amounts = sorted.map((t) => Math.abs(t.amount));
    const avg = amounts.reduce((s, v) => s + v, 0) / amounts.length;
    const variance = amounts.reduce((s, v) => s + (v - avg) ** 2, 0) / amounts.length;
    const cv = avg > 0 ? Math.sqrt(variance) / avg : 1;

    // Gaps between consecutive charges
    const gaps: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      gaps.push((+new Date(sorted[i].date) - +new Date(sorted[i - 1].date)) / 86400000);
    }
    const medGap = gaps.length ? median(gaps) : 30;
    const gapVar = gaps.length
      ? gaps.reduce((s, g) => s + (g - medGap) ** 2, 0) / gaps.length
      : 0;
    const gapCv = medGap > 0 ? Math.sqrt(gapVar) / medGap : 1;
    const freq = inferFrequency(medGap);

    const known = isKnown(merchant);
    const isRecurringFlag = sorted.some((t) => t.recurring);
    const stableAmount = cv < 0.15;
    const stableGap = gapCv < 0.3 && freq !== "Irregular";

    let confidence = 0;
    const reasons: string[] = [];
    if (known) { confidence += 35; reasons.push("known subscription service"); }
    if (isRecurringFlag) { confidence += 20; reasons.push("flagged recurring"); }
    if (stableAmount) { confidence += 25; reasons.push(`stable amount (±${Math.round(cv * 100)}%)`); }
    if (stableGap) { confidence += 20; reasons.push(`regular ${freq.toLowerCase()} cadence`); }
    if (sorted.length >= 3) confidence += 10;
    if (sorted.length >= 6) confidence += 5;
    confidence = Math.min(99, confidence);

    // Require some signal
    if (!(known || (stableAmount && (stableGap || sorted.length >= 3)))) continue;
    if (confidence < 45) continue;
    if (avg > 15000 && !known) continue;

    const last = sorted[sorted.length - 1];
    const first = sorted[0];
    const lastAmount = Math.abs(last.amount);
    const firstAmount = Math.abs(first.amount);
    const nextExpectedMs = +new Date(last.date) + medGap * 86400000;
    const usageGapDays = Math.round((now - +new Date(last.date)) / 86400000);
    const monthsActive = Math.max(
      1,
      Math.round((+new Date(last.date) - +new Date(first.date)) / (30.44 * 86400000)) + 1,
    );
    const monthlyAmount = monthlyFrom(freq, avg);

    // Payment method: most frequent
    const pmCount = new Map<string, number>();
    for (const t of sorted) pmCount.set(t.paymentMethod, (pmCount.get(t.paymentMethod) ?? 0) + 1);
    const paymentMethod = [...pmCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";

    out.push({
      merchant,
      category: last.category,
      monthlyAmount,
      annualCost: monthlyAmount * 12,
      lastAmount: Math.round(lastAmount),
      firstAmount: Math.round(firstAmount),
      priceChange: Math.round(lastAmount - firstAmount),
      count: sorted.length,
      firstDate: first.date,
      lastDate: last.date,
      nextExpected: new Date(nextExpectedMs).toISOString(),
      frequency: freq,
      paymentMethod,
      confidence,
      reason: reasons.join(" · "),
      monthsActive,
      usageGapDays,
    });
  }

  return out.sort((a, b) => b.monthlyAmount - a.monthlyAmount);
}

export type SubscriptionSummary = {
  count: number;
  monthlyTotal: number;
  annualTotal: number;
  byCategory: { category: string; monthly: number; share: number }[];
  entertainmentShare: number;
  potentialSavings: number;
};

const ENTERTAINMENT = /netflix|spotify|prime|hotstar|sony|zee5|youtube|apple tv|audible|kindle|zomato gold|swiggy one/i;
const OPTIONAL = /netflix|spotify|hotstar|sony|zee5|youtube|audible|kindle|zomato gold|swiggy one|canva|grammarly/i;

export function summarizeSubscriptions(subs: SubscriptionDetail[]): SubscriptionSummary {
  const monthlyTotal = subs.reduce((s, x) => s + x.monthlyAmount, 0);
  const catMap = new Map<string, number>();
  for (const s of subs) catMap.set(s.category, (catMap.get(s.category) ?? 0) + s.monthlyAmount);
  const byCategory = [...catMap.entries()]
    .map(([category, monthly]) => ({
      category,
      monthly,
      share: monthlyTotal ? Math.round((monthly / monthlyTotal) * 100) : 0,
    }))
    .sort((a, b) => b.monthly - a.monthly);
  const entMonthly = subs.filter((s) => ENTERTAINMENT.test(s.merchant)).reduce((s, x) => s + x.monthlyAmount, 0);
  const optionalMonthly = subs.filter((s) => OPTIONAL.test(s.merchant)).reduce((s, x) => s + x.monthlyAmount, 0);
  return {
    count: subs.length,
    monthlyTotal,
    annualTotal: monthlyTotal * 12,
    byCategory,
    entertainmentShare: monthlyTotal ? Math.round((entMonthly / monthlyTotal) * 100) : 0,
    potentialSavings: Math.round(optionalMonthly * 12 * 0.6),
  };
}

export function subscriptionInsights(s: SubscriptionDetail): string[] {
  const notes: string[] = [];
  if (s.monthsActive >= 2) notes.push(`You've paid ${s.merchant} continuously for ${s.monthsActive} month${s.monthsActive === 1 ? "" : "s"}.`);
  notes.push(`This subscription costs ₹${s.annualCost.toLocaleString("en-IN")} per year.`);
  if (s.priceChange > 0) notes.push(`Price increased by ₹${s.priceChange} since first charge.`);
  else if (s.priceChange < 0) notes.push(`Price decreased by ₹${Math.abs(s.priceChange)} since first charge.`);
  if (s.usageGapDays > 45) notes.push(`Last charge was ${s.usageGapDays} days ago — verify it's still active.`);
  if (ENTERTAINMENT.test(s.merchant)) notes.push(`Entertainment subscription — consider bundling.`);
  return notes;
}
