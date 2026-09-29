import type { Analytics } from "./analytics";
import type { MoneyLeak } from "./insights";

export type LeakSeverity = "critical" | "high" | "moderate" | "minor";

export type ScoredLeak = MoneyLeak & {
  severity: LeakSeverity;
  /** Share of monthly spending this leak represents (0-100). */
  spendShare: number;
  /** 0-100 impact weight used for ranking and for the overall leak score. */
  impact: number;
  group: "subscriptions" | "food" | "lifestyle" | "shopping";
};

export type LeakScore = {
  score: number; // 0-100, higher = healthier (fewer leaks)
  label: string;
  summary: string;
};

const GROUPS: Record<MoneyLeak["type"], ScoredLeak["group"]> = {
  subscription: "subscriptions",
  recurring: "subscriptions",
  food_delivery: "food",
  coffee: "food",
  late_night: "lifestyle",
  weekend: "lifestyle",
  impulse: "shopping",
};

export function scoreLeaks(leaks: MoneyLeak[], a: Analytics): ScoredLeak[] {
  const monthlySpend = Math.max(1, a.averages.monthlySpend || a.currentMonth.expenses || 1);
  return leaks
    .map((l) => {
      const spendShare = Math.min(100, Math.round((l.monthlyAmount / monthlySpend) * 100));
      const savingShare = (l.potentialMonthlySaving / monthlySpend) * 100;
      const impact = Math.max(1, Math.min(100, Math.round(savingShare * 4)));
      const severity: LeakSeverity =
        impact >= 60 ? "critical" : impact >= 35 ? "high" : impact >= 15 ? "moderate" : "minor";
      return { ...l, spendShare, impact, severity, group: GROUPS[l.type] ?? "lifestyle" };
    })
    .sort((x, y) => y.impact - x.impact);
}

export function computeLeakScore(leaks: ScoredLeak[], a: Analytics): LeakScore {
  const monthlySpend = Math.max(1, a.averages.monthlySpend || a.currentMonth.expenses || 1);
  const leakedShare = leaks.reduce((s, l) => s + l.potentialMonthlySaving, 0) / monthlySpend;
  const score = Math.max(0, Math.min(100, Math.round(100 - leakedShare * 220)));
  const label =
    score >= 85 ? "Airtight" : score >= 70 ? "Mostly sealed" : score >= 50 ? "Leaking" : "Heavily leaking";
  const summary =
    score >= 85
      ? "Barely any recoverable waste in your spending."
      : score >= 70
        ? "A few small leaks — easy wins available."
        : score >= 50
          ? "A meaningful slice of your spending is recoverable."
          : "A large share of your monthly spend is avoidable waste.";
  return { score, label, summary };
}