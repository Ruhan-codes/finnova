// Behavioural intelligence engine for the Money Leak Detector.
// Clusters raw transactions into HABITS (not merchants), ranks them by
// priority, extracts spending patterns, and turns everything into
// coaching-friendly copy.

import type { Transaction } from "./types";
import type { Analytics } from "./analytics";
import { inr } from "./format";

export type HabitId =
  | "food_delivery"
  | "coffee"
  | "entertainment_subs"
  | "shopping_impulse"
  | "weekend_spending"
  | "late_night_spending"
  | "micro_purchases"
  | "cab_rides"
  | "duplicate_recharge"
  | "subscription_overlap";

export type HabitPriority = "critical" | "high" | "medium" | "low";

export type Habit = {
  id: HabitId;
  title: string;
  emoji: string;
  category: "necessary" | "emotional" | "waste" | "lifestyle";
  reason: string; // short "why this is a leak"
  narrative: string; // 1 sentence behavioural insight
  merchants: string[]; // merged merchant list
  monthlyCount: number;
  monthlyAmount: number;
  monthlySaving: number;
  annualSaving: number;
  priority: HabitPriority;
  stars: 1 | 2 | 3 | 4 | 5;
  impact: number; // 0..100, share of leak-worthy spend
  spendShare: number; // % of monthly spend
  action: {
    label: string;
    description: string;
  };
};

export type BehaviourPatterns = {
  mostExpensiveWeekday: { day: string; amount: number } | null;
  mostEmotionalWindow: string | null;
  peakShoppingHour: number | null;
  peakFoodDay: string | null;
  impulseScore: number; // 0..100
  recurringScore: number; // 0..100
  lifestyleInflationPct: number; // vs last month
};

export type HiddenDiscovery = {
  id: string;
  title: string;
  detail: string;
  tone: "warn" | "info" | "danger";
};

export type BehaviourTimeline = {
  last: { leakScore: number; health: number; saving: number };
  current: { leakScore: number; health: number; saving: number };
  projected: { leakScore: number; health: number; saving: number };
};

export type LeakTrend = "improving" | "worsening" | "steady";

export type LeakScoreReport = {
  score: number;
  band: "Airtight" | "Mostly sealed" | "Moderate" | "Leaking" | "Heavy leak";
  meaning: string;
  trend: LeakTrend;
  trendDelta: number; // absolute leak-score change vs last month
};

export type BehaviourReport = {
  habits: Habit[];
  patterns: BehaviourPatterns;
  discoveries: HiddenDiscovery[];
  timeline: BehaviourTimeline;
  leakScore: LeakScoreReport;
  totals: {
    monthlySaving: number;
    annualSaving: number;
    monthlySpend: number;
  };
};

const WEEKDAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const HABIT_META: Record<HabitId, Pick<Habit, "title" | "emoji" | "category" | "action">> = {
  food_delivery: {
    title: "Food Delivery Habit",
    emoji: "🍔",
    category: "emotional",
    action: { label: "Cook 2 dinners at home", description: "Reduce delivery orders by roughly 40%." },
  },
  coffee: {
    title: "Coffee Ritual",
    emoji: "☕",
    category: "emotional",
    action: { label: "Brew at home 3 mornings", description: "Halve your monthly cafe spend." },
  },
  entertainment_subs: {
    title: "Entertainment Subscriptions",
    emoji: "📺",
    category: "waste",
    action: { label: "Cancel the unused OTT", description: "You're actively using only one platform." },
  },
  shopping_impulse: {
    title: "Impulse Shopping",
    emoji: "🛍️",
    category: "emotional",
    action: { label: "Apply the 48-hour rule", description: "Delay non-essentials by 48 hours before checkout." },
  },
  weekend_spending: {
    title: "Weekend Splurge",
    emoji: "🎉",
    category: "lifestyle",
    action: { label: "Plan one low-spend weekend", description: "Cap discretionary weekend spend once a month." },
  },
  late_night_spending: {
    title: "Late-Night Impulse",
    emoji: "🌙",
    category: "emotional",
    action: { label: "Set a 10 PM lock", description: "Move card storage off checkout after 10 PM." },
  },
  micro_purchases: {
    title: "Micro Purchases",
    emoji: "🪙",
    category: "waste",
    action: { label: "Bundle small buys", description: "Combine ₹100–250 purchases into one weekly run." },
  },
  cab_rides: {
    title: "Weekend Cab Usage",
    emoji: "🚕",
    category: "lifestyle",
    action: { label: "Batch cab rides", description: "Swap 1 weekend cab for public transit." },
  },
  duplicate_recharge: {
    title: "Duplicate Recharges",
    emoji: "📱",
    category: "waste",
    action: { label: "Drop the second plan", description: "Two active recharges detected on the same line." },
  },
  subscription_overlap: {
    title: "Subscription Overlap",
    emoji: "🔁",
    category: "waste",
    action: { label: "Trim overlapping plans", description: "Multiple subscriptions serve the same need." },
  },
};

const FOOD_RX = /swiggy|zomato|ubereats|dunzo|dominos|pizza|kfc|mcdonald|biryani|dosa/i;
const COFFEE_RX = /starbucks|coffee|cafe|barista|blue tokai|third wave|chaayos/i;
const OTT_RX = /netflix|prime|hotstar|disney|sonyliv|zee5|jiocinema|apple tv|spotify|youtube/i;
const SHOPPING_RX = /amazon|flipkart|myntra|ajio|nykaa|meesho|zara|h&m|shein/i;
const CAB_RX = /uber|ola|rapido|meru|bluesmart/i;
const RECHARGE_RX = /jio|airtel|vi recharge|vodafone|bsnl recharge|recharge/i;

function bucketize(txs: Transaction[]) {
  const buckets: Record<string, Transaction[]> = {
    food: [],
    coffee: [],
    ott: [],
    shopping: [],
    cab: [],
    recharge: [],
    other: [],
  };
  for (const t of txs) {
    if (t.amount >= 0) continue;
    const m = t.merchant;
    if (FOOD_RX.test(m)) buckets.food.push(t);
    else if (COFFEE_RX.test(m)) buckets.coffee.push(t);
    else if (OTT_RX.test(m)) buckets.ott.push(t);
    else if (SHOPPING_RX.test(m)) buckets.shopping.push(t);
    else if (CAB_RX.test(m)) buckets.cab.push(t);
    else if (RECHARGE_RX.test(m)) buckets.recharge.push(t);
    else buckets.other.push(t);
  }
  return buckets;
}

function priorityFor(impact: number): { priority: HabitPriority; stars: Habit["stars"] } {
  if (impact >= 65) return { priority: "critical", stars: 5 };
  if (impact >= 45) return { priority: "high", stars: 4 };
  if (impact >= 25) return { priority: "medium", stars: 3 };
  if (impact >= 12) return { priority: "medium", stars: 2 };
  return { priority: "low", stars: 1 };
}

function mkHabit(
  id: HabitId,
  merchants: string[],
  monthlyCount: number,
  monthlyAmount: number,
  savingPct: number,
  reason: string,
  narrative: string,
  monthlySpend: number,
): Habit {
  const meta = HABIT_META[id];
  const monthlySaving = Math.max(0, Math.round(monthlyAmount * savingPct));
  const spendShare = monthlySpend > 0 ? Math.min(100, Math.round((monthlyAmount / monthlySpend) * 100)) : 0;
  const impact = monthlySpend > 0 ? Math.min(100, Math.round((monthlySaving / monthlySpend) * 300)) : 0;
  const { priority, stars } = priorityFor(impact);
  return {
    id,
    title: meta.title,
    emoji: meta.emoji,
    category: meta.category,
    reason,
    narrative,
    merchants: Array.from(new Set(merchants)).slice(0, 6),
    monthlyCount: Math.round(monthlyCount),
    monthlyAmount: Math.round(monthlyAmount),
    monthlySaving,
    annualSaving: monthlySaving * 12,
    priority,
    stars,
    impact,
    spendShare,
    action: meta.action,
  };
}

function buildHabits(txs: Transaction[], a: Analytics): Habit[] {
  const monthCount = Math.max(1, a.monthCount);
  const monthlySpend = Math.max(1, a.averages.monthlySpend || a.currentMonth.expenses || 1);
  const b = bucketize(txs);
  const habits: Habit[] = [];

  // Food Delivery
  if (b.food.length >= 3) {
    const monthlyCount = b.food.length / monthCount;
    const monthlyAmount = b.food.reduce((s, t) => s + -t.amount, 0) / monthCount;
    habits.push(
      mkHabit(
        "food_delivery",
        b.food.map((t) => t.merchant),
        monthlyCount,
        monthlyAmount,
        0.4,
        `${Math.round(monthlyCount)} orders per month`,
        `You ordered food ${Math.round(monthlyCount)} times this month — average users order ~6.`,
        monthlySpend,
      ),
    );
  }

  // Coffee
  if (b.coffee.length >= 3) {
    const monthlyCount = b.coffee.length / monthCount;
    const monthlyAmount = b.coffee.reduce((s, t) => s + -t.amount, 0) / monthCount;
    const merchantSet = new Map<string, number>();
    for (const t of b.coffee) merchantSet.set(t.merchant, (merchantSet.get(t.merchant) ?? 0) + 1);
    const top = [...merchantSet.entries()].sort((a, b) => b[1] - a[1])[0];
    habits.push(
      mkHabit(
        "coffee",
        [...merchantSet.keys()],
        monthlyCount,
        monthlyAmount,
        0.5,
        `${Math.round(monthlyCount)} cafe visits per month`,
        top
          ? `Visited ${top[0]} ${top[1]} times this month — brewing 3 mornings a week saves half.`
          : `${Math.round(monthlyCount)} cafe visits per month.`,
        monthlySpend,
      ),
    );
  }

  // Entertainment Subs / Overlap
  const ottMerchants = new Set(b.ott.map((t) => t.merchant));
  if (ottMerchants.size >= 2) {
    const monthlyAmount = b.ott.reduce((s, t) => s + -t.amount, 0) / monthCount;
    habits.push(
      mkHabit(
        "entertainment_subs",
        [...ottMerchants],
        ottMerchants.size,
        monthlyAmount,
        1 - 1 / ottMerchants.size, // keep 1, cancel rest
        `${ottMerchants.size} streaming subscriptions active`,
        `You're paying for ${ottMerchants.size} streaming platforms but most people actively use one.`,
        monthlySpend,
      ),
    );
  } else {
    // Subscription overlap in analytics.subscriptions
    if (a.subscriptions.length >= 4) {
      const monthlyAmount = a.subscriptions.reduce((s, x) => s + x.amount, 0);
      habits.push(
        mkHabit(
          "subscription_overlap",
          a.subscriptions.map((s) => s.merchant),
          a.subscriptions.length,
          monthlyAmount,
          0.35,
          `${a.subscriptions.length} recurring subscriptions`,
          `You have ${a.subscriptions.length} recurring plans overlapping across categories.`,
          monthlySpend,
        ),
      );
    }
  }

  // Duplicate recharges
  if (b.recharge.length >= 2) {
    const uniqDays = new Set(b.recharge.map((t) => t.date.slice(0, 10))).size;
    if (b.recharge.length - uniqDays >= 1 || b.recharge.length >= 3) {
      const monthlyAmount = b.recharge.reduce((s, t) => s + -t.amount, 0) / monthCount;
      habits.push(
        mkHabit(
          "duplicate_recharge",
          b.recharge.map((t) => t.merchant),
          b.recharge.length / monthCount,
          monthlyAmount,
          0.5,
          `${b.recharge.length} recharges detected`,
          `Two overlapping recharge plans detected on the same line.`,
          monthlySpend,
        ),
      );
    }
  }

  // Impulse shopping
  if (b.shopping.length >= 2) {
    const monthlyAmount = b.shopping.reduce((s, t) => s + -t.amount, 0) / monthCount;
    const late = b.shopping.filter((t) => {
      const h = new Date(t.date).getHours();
      return h >= 20 || h <= 3;
    });
    const lateShare = Math.round((late.length / b.shopping.length) * 100);
    habits.push(
      mkHabit(
        "shopping_impulse",
        b.shopping.map((t) => t.merchant),
        b.shopping.length / monthCount,
        monthlyAmount,
        0.3,
        `${b.shopping.length} shopping orders`,
        lateShare >= 40
          ? `${lateShare}% of your shopping happened after 8 PM — a classic impulse window.`
          : `${b.shopping.length} shopping orders across ${new Set(b.shopping.map((t) => t.merchant)).size} sites.`,
        monthlySpend,
      ),
    );
  }

  // Late-night spending
  const night = txs.filter((t) => {
    if (t.amount >= 0) return false;
    const h = new Date(t.date).getHours();
    return h >= 22 || h <= 4;
  });
  if (night.length >= 5) {
    const monthlyAmount = night.reduce((s, t) => s + -t.amount, 0) / monthCount;
    habits.push(
      mkHabit(
        "late_night_spending",
        night.map((t) => t.merchant),
        night.length / monthCount,
        monthlyAmount,
        0.5,
        `${night.length} late-night transactions`,
        `${night.length} transactions happened between 10 PM and 4 AM this period.`,
        monthlySpend,
      ),
    );
  }

  // Weekend splurge
  const wk = a.weekendVsWeekday;
  if (wk.weekendShare >= 30) {
    const monthlyAmount = wk.weekend / monthCount;
    habits.push(
      mkHabit(
        "weekend_spending",
        [],
        0,
        monthlyAmount,
        0.2,
        `${wk.weekendShare}% of spend on weekends`,
        `${wk.weekendShare}% of your spending happens on weekends — mostly entertainment & food.`,
        monthlySpend,
      ),
    );
  }

  // Cab rides
  if (b.cab.length >= 4) {
    const monthlyAmount = b.cab.reduce((s, t) => s + -t.amount, 0) / monthCount;
    habits.push(
      mkHabit(
        "cab_rides",
        b.cab.map((t) => t.merchant),
        b.cab.length / monthCount,
        monthlyAmount,
        0.25,
        `${b.cab.length} cab rides`,
        `${b.cab.length} cab rides — swapping one weekend cab for transit trims this.`,
        monthlySpend,
      ),
    );
  }

  // Micro purchases (<₹250)
  const micros = txs.filter((t) => t.amount < 0 && -t.amount <= 250);
  if (micros.length >= 20) {
    const monthlyAmount = micros.reduce((s, t) => s + -t.amount, 0) / monthCount;
    habits.push(
      mkHabit(
        "micro_purchases",
        [],
        micros.length / monthCount,
        monthlyAmount,
        0.3,
        `${micros.length} purchases under ₹250`,
        `${micros.length} purchases under ₹250 quietly add up to ${inr(Math.round(monthlyAmount * monthCount))}.`,
        monthlySpend,
      ),
    );
  }

  return habits.sort((a, b) => b.impact - a.impact);
}

function buildPatterns(txs: Transaction[], a: Analytics): BehaviourPatterns {
  const expenses = txs.filter((t) => t.amount < 0);
  const byDow = new Array(7).fill(0) as number[];
  const byHour = new Array(24).fill(0) as number[];
  const foodByDow = new Array(7).fill(0) as number[];
  const shopByHour = new Array(24).fill(0) as number[];
  for (const t of expenses) {
    const d = new Date(t.date);
    byDow[d.getDay()] += -t.amount;
    byHour[d.getHours()] += -t.amount;
    if (FOOD_RX.test(t.merchant)) foodByDow[d.getDay()] += -t.amount;
    if (SHOPPING_RX.test(t.merchant)) shopByHour[d.getHours()] += -t.amount;
  }
  const dowIdx = byDow.indexOf(Math.max(...byDow));
  const hourIdx = shopByHour.some((v) => v > 0) ? shopByHour.indexOf(Math.max(...shopByHour)) : byHour.indexOf(Math.max(...byHour));
  const foodDow = foodByDow.some((v) => v > 0) ? foodByDow.indexOf(Math.max(...foodByDow)) : -1;
  const emotionalDow = byDow[5] + byDow[6] > byDow.slice(0, 5).reduce((s, v) => s + v, 0) / 5 ? "Saturday evening" : null;

  const nightSpend = byHour.slice(20).reduce((s, v) => s + v, 0) + byHour.slice(0, 4).reduce((s, v) => s + v, 0);
  const totalSpend = byHour.reduce((s, v) => s + v, 0) || 1;
  const impulseScore = Math.min(100, Math.round((nightSpend / totalSpend) * 220));
  const recurringScore = Math.min(100, Math.round((a.subscriptions.length / 6) * 100));
  const monthly = a.monthly;
  let lifestyleInflation = 0;
  if (monthly.length >= 2) {
    const last = monthly[monthly.length - 1];
    const prev = monthly[monthly.length - 2];
    if (prev.expenses > 0) lifestyleInflation = Math.round(((last.expenses - prev.expenses) / prev.expenses) * 100);
  }

  return {
    mostExpensiveWeekday: byDow[dowIdx] > 0 ? { day: WEEKDAY[dowIdx], amount: Math.round(byDow[dowIdx]) } : null,
    mostEmotionalWindow: emotionalDow,
    peakShoppingHour: byHour[hourIdx] > 0 ? hourIdx : null,
    peakFoodDay: foodDow >= 0 ? WEEKDAY[foodDow] : null,
    impulseScore,
    recurringScore,
    lifestyleInflationPct: lifestyleInflation,
  };
}

function buildDiscoveries(txs: Transaction[], a: Analytics, p: BehaviourPatterns): HiddenDiscovery[] {
  const out: HiddenDiscovery[] = [];
  const wk = a.weekendVsWeekday;
  if (wk.weekendShare >= 30) {
    out.push({
      id: "d_weekend",
      title: `You spend ${wk.weekendShare}% more on weekends`,
      detail: `Weekends account for ${wk.weekendShare}% of monthly spend, mostly on entertainment and delivery.`,
      tone: "warn",
    });
  }
  const salaryDayCluster = (() => {
    const dayAmts = new Array(31).fill(0) as number[];
    for (const t of txs) {
      if (t.amount >= 0) continue;
      const day = new Date(t.date).getDate();
      dayAmts[day] += -t.amount;
    }
    const firstWeek = dayAmts.slice(1, 8).reduce((s, v) => s + v, 0);
    const rest = dayAmts.slice(8).reduce((s, v) => s + v, 0);
    return firstWeek > rest * 0.5 && firstWeek > 3000 ? firstWeek : 0;
  })();
  if (salaryDayCluster > 0) {
    out.push({
      id: "d_salary",
      title: "Spending spikes after payday",
      detail: `${inr(Math.round(salaryDayCluster))} was spent in the first week of the month — classic post-salary lifestyle inflation.`,
      tone: "info",
    });
  }
  if (p.peakShoppingHour !== null && p.peakShoppingHour >= 20) {
    out.push({
      id: "d_night_shop",
      title: `Shopping peaks at ${p.peakShoppingHour}:00`,
      detail: `Most shopping happens after ${p.peakShoppingHour}:00 — a well-known impulse-buying window.`,
      tone: "warn",
    });
  }
  if (p.peakFoodDay) {
    out.push({
      id: "d_food_day",
      title: `Food orders peak on ${p.peakFoodDay}`,
      detail: `${p.peakFoodDay} is your top food-delivery day. Prepping one meal that day cuts a recurring cost.`,
      tone: "info",
    });
  }
  if (p.lifestyleInflationPct >= 15) {
    out.push({
      id: "d_inflation",
      title: `Lifestyle inflation up ${p.lifestyleInflationPct}%`,
      detail: `Total spend rose ${p.lifestyleInflationPct}% vs last month even though nothing critical changed.`,
      tone: "danger",
    });
  }
  return out;
}

function computeLeakScore(habits: Habit[], a: Analytics, prevSaving: number, curSaving: number): LeakScoreReport {
  const monthlySpend = Math.max(1, a.averages.monthlySpend || a.currentMonth.expenses || 1);
  const leakShare = habits.reduce((s, h) => s + h.monthlySaving, 0) / monthlySpend;
  const score = Math.max(0, Math.min(100, Math.round(100 - leakShare * 220)));
  const band: LeakScoreReport["band"] =
    score >= 85 ? "Airtight" : score >= 70 ? "Mostly sealed" : score >= 50 ? "Moderate" : score >= 30 ? "Leaking" : "Heavy leak";
  const meaning =
    score >= 85
      ? "Barely any recoverable waste — you're saving efficiently."
      : score >= 70
        ? "Mostly healthy with a few small habits worth trimming."
        : score >= 50
          ? "Your spending is generally healthy, but AI found recurring habits delaying your financial goals."
          : score >= 30
            ? "A meaningful slice of your spend is recoverable — start with the top habit below."
            : "A large share of your spend is avoidable. Fixing the top habit alone unlocks major savings.";

  // Trend from prev vs current potential saving; more saving today = worsening.
  const delta = Math.round(curSaving - prevSaving);
  const trend: LeakTrend = Math.abs(delta) < Math.max(300, prevSaving * 0.05) ? "steady" : delta < 0 ? "improving" : "worsening";
  const trendScoreDelta = prevSaving > 0 ? Math.round(((prevSaving - curSaving) / monthlySpend) * 220) : 0;
  return { score, band, meaning, trend, trendDelta: trendScoreDelta };
}

export function buildBehaviourReport(txs: Transaction[], a: Analytics): BehaviourReport {
  const monthCount = Math.max(1, a.monthCount);
  const habits = buildHabits(txs, a);
  const patterns = buildPatterns(txs, a);
  const discoveries = buildDiscoveries(txs, a, patterns);

  const monthlySaving = habits.reduce((s, h) => s + h.monthlySaving, 0);
  const annualSaving = monthlySaving * 12;
  const monthlySpend = a.averages.monthlySpend || a.currentMonth.expenses;

  // Last-month potential saving (rough): scale habits by last-vs-current spend ratio.
  const monthly = a.monthly;
  const cur = monthly[monthly.length - 1]?.expenses ?? monthlySpend;
  const prev = monthly[monthly.length - 2]?.expenses ?? cur;
  const prevSaving = cur > 0 ? Math.round(monthlySaving * (prev / cur)) : monthlySaving;
  const leakScore = computeLeakScore(habits, a, prevSaving, monthlySaving);

  const health = a.health.score;
  const healthProjected = Math.min(100, health + Math.round((monthlySaving / Math.max(1, a.averages.monthlyIncome)) * 45));
  const timeline: BehaviourTimeline = {
    last: { leakScore: Math.max(0, leakScore.score - leakScore.trendDelta), health, saving: prevSaving },
    current: { leakScore: leakScore.score, health, saving: monthlySaving },
    projected: {
      leakScore: Math.min(100, leakScore.score + Math.min(30, Math.round((monthlySaving / Math.max(1, monthlySpend)) * 60))),
      health: healthProjected,
      saving: Math.round(monthlySaving * 0.55),
    },
  };

  return {
    habits,
    patterns,
    discoveries,
    timeline,
    leakScore,
    totals: {
      monthlySaving,
      annualSaving,
      monthlySpend: monthlySpend * monthCount,
    },
  };
}

export function habitKey(id: HabitId): string {
  return `habit_${id}`;
}

// 7-day challenge templates keyed by habit.
export function buildChallenge(habit: Habit): { title: string; days: string[]; reward: string } {
  const daily = Math.max(50, Math.round(habit.monthlySaving / 30));
  const base: Record<HabitId, { title: string; days: string[] }> = {
    food_delivery: {
      title: "5-Day No-Delivery Challenge",
      days: [
        "Meal-prep 3 lunches for the week",
        "No delivery today — cook one favorite meal",
        "Pack lunch, eat out only if a friend joins",
        "Cook a 20-minute dinner tonight",
        "No delivery — try a new home recipe",
        "Optional: allow one weekend order",
        "Reflect on how much you saved",
      ],
    },
    coffee: {
      title: "No-Cafe Week",
      days: [
        "Brew coffee at home today",
        "Bring a thermos to work",
        "Skip the cafe run — invest ₹200 instead",
        "Try a new home brewing method",
        "One cafe visit allowed as a treat",
        "Home brew again",
        "Tally your saved cups",
      ],
    },
    entertainment_subs: {
      title: "Subscription Cleanup",
      days: [
        "List every active OTT plan",
        "Pick the one you actually use",
        "Cancel one you haven't opened in 30 days",
        "Set a shared plan with family",
        "Move billing to yearly for the keeper",
        "Set a reminder to review in 90 days",
        "Enjoy the reclaimed monthly budget",
      ],
    },
    shopping_impulse: {
      title: "Shopping Freeze",
      days: [
        "Empty your cart, wait 48 hours",
        "No non-essential purchase today",
        "Unsubscribe from 3 marketing emails",
        "Log every 'want' in a notes app",
        "Buy only if still needed after 48h",
        "Weekend rule: nothing over ₹1,000",
        "Review what you actually missed",
      ],
    },
    weekend_spending: {
      title: "Low-Spend Weekend",
      days: [
        "Plan Saturday around a free activity",
        "Cook one weekend meal at home",
        "Cap discretionary spend at ₹500",
        "Walk or transit instead of a cab",
        "No delivery on Sunday",
        "Track weekend total vs last one",
        "Celebrate savings with a small treat",
      ],
    },
    late_night_spending: {
      title: "10 PM Spending Lock",
      days: [
        "Remove saved cards from apps",
        "No purchases after 10 PM",
        "Add a bedtime alarm for phone-off",
        "Late-night urge? Note it, don't buy",
        "Screen-free hour before bed",
        "Weekend: same 10 PM rule",
        "Review saved impulse spend",
      ],
    },
    micro_purchases: {
      title: "Bundle-Buy Week",
      days: [
        "Batch small buys into one weekly run",
        "No sub-₹250 purchases today",
        "Carry a snack — skip kiosk stops",
        "Consolidate errands into one trip",
        "Use cash for small buys to feel it",
        "Track the count of skipped micros",
        "Move the saved amount to savings",
      ],
    },
    cab_rides: {
      title: "Transit-First Week",
      days: [
        "Pick one cab trip to swap for transit",
        "Walk the last kilometer",
        "Share a ride with a friend",
        "No solo cabs today",
        "Try a bike/scooter for a short trip",
        "Weekend: transit challenge",
        "Compare cab spend vs last week",
      ],
    },
    duplicate_recharge: {
      title: "Recharge Audit",
      days: [
        "List all active recharges",
        "Cancel the duplicate today",
        "Move to an annual plan if it saves",
        "Set autopay only on the keeper",
        "Note the freed monthly amount",
        "Redirect it to your goal",
        "Set a review reminder in 6 months",
      ],
    },
    subscription_overlap: {
      title: "Subscription Cleanup",
      days: [
        "List every recurring plan",
        "Rate each: essential / nice / unused",
        "Cancel one 'unused' today",
        "Downgrade one 'nice' to a lower tier",
        "Set annual review reminders",
        "Share family plans where possible",
        "Move saved amount to your goal",
      ],
    },
  };
  const b = base[habit.id];
  return {
    title: b.title,
    days: b.days,
    reward: `Save ~${inr(daily * 7)} in one week — ${inr(habit.annualSaving)} yearly.`,
  };
}
