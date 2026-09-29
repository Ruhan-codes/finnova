// SmartSave Journey — client-side behavioural savings engine.
// State persists to localStorage; keeps demo self-contained and instant.
import { useEffect, useSyncExternalStore } from "react";

export type SmartSaveState = {
  onboarded: boolean;
  streakDays: number;
  savedAmount: number;
  todaySpending: number;
  dailyBudget: number;
  monthlyPotential: number;
  journeyEnded: boolean;
  celebratedMilestones: number[]; // e.g. [7, 30, 50]
  lastPurchaseDelta: number; // days delay predicted from most recent overspend
};

export const SMARTSAVE_GOAL = {
  name: "Bike",
  emoji: "🚲",
  target: 120_000,
  months: 12,
};

const KEY = "finnova.smartsave.v1";

const DEFAULT_STATE: SmartSaveState = {
  onboarded: false,
  streakDays: 12,
  savedAmount: 46_000,
  todaySpending: 620,
  dailyBudget: 950,
  monthlyPotential: 10_000,
  journeyEnded: false,
  celebratedMilestones: [],
  lastPurchaseDelta: 0,
};

let state: SmartSaveState = DEFAULT_STATE;
const listeners = new Set<() => void>();
let hydrated = false;

function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) state = { ...DEFAULT_STATE, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
}

function persist() {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

function emit() {
  listeners.forEach((l) => l());
}

function setState(next: Partial<SmartSaveState>) {
  state = { ...state, ...next };
  persist();
  emit();
}

export const smartSave = {
  get() {
    hydrate();
    return state;
  },
  completeOnboarding() {
    setState({ onboarded: true });
  },
  addSpending(amount: number) {
    const newToday = state.todaySpending + amount;
    setState({ todaySpending: newToday });
    if (newToday > state.dailyBudget && !state.journeyEnded) {
      const over = newToday - state.dailyBudget;
      const delta = Math.max(1, Math.round(over / 12));
      setState({ lastPurchaseDelta: delta });
    }
  },
  endJourney() {
    setState({ journeyEnded: true });
  },
  resetToday() {
    setState({ todaySpending: 620, journeyEnded: false, lastPurchaseDelta: 0 });
  },
  celebrate(milestone: number) {
    if (state.celebratedMilestones.includes(milestone)) return;
    setState({ celebratedMilestones: [...state.celebratedMilestones, milestone] });
  },
  fullReset() {
    state = DEFAULT_STATE;
    persist();
    emit();
  },
  subscribe(cb: () => void) {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },
};

export function useSmartSave(): SmartSaveState {
  const snap = useSyncExternalStore(
    (cb) => smartSave.subscribe(cb),
    () => smartSave.get(),
    () => DEFAULT_STATE,
  );
  useEffect(() => {
    hydrate();
    emit();
  }, []);
  return snap;
}

// Derived helpers
export function estimatedPurchaseDate(state: SmartSaveState): Date {
  const remaining = SMARTSAVE_GOAL.target - state.savedAmount;
  const perMonth = state.monthlyPotential || 10_000;
  const monthsLeft = Math.max(0, remaining / perMonth);
  const d = new Date();
  d.setMonth(d.getMonth() + Math.ceil(monthsLeft));
  return d;
}

export function formatDate(d: Date): string {
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}

export function progressPct(state: SmartSaveState): number {
  return Math.min(100, Math.round((state.savedAmount / SMARTSAVE_GOAL.target) * 100));
}
