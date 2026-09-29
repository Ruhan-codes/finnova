// Local challenge tracker — persists 7-day challenge progress in localStorage.
import { useEffect, useSyncExternalStore } from "react";

export type ChallengeState = {
  id: string; // habit id
  title: string;
  startedAt: string; // ISO
  completedDays: number[]; // day indices 0..6
};

type Store = Record<string, ChallengeState>;

const KEY = "finguard.challenges.v1";

let state: Store = {};
let hydrated = false;
const listeners = new Set<() => void>();

function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) state = JSON.parse(raw) as Store;
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

export const challenges = {
  get(): Store {
    hydrate();
    return state;
  },
  start(id: string, title: string) {
    hydrate();
    state = { ...state, [id]: { id, title, startedAt: new Date().toISOString(), completedDays: [] } };
    persist();
    emit();
  },
  toggleDay(id: string, day: number) {
    hydrate();
    const c = state[id];
    if (!c) return;
    const has = c.completedDays.includes(day);
    const completedDays = has ? c.completedDays.filter((d) => d !== day) : [...c.completedDays, day].sort();
    state = { ...state, [id]: { ...c, completedDays } };
    persist();
    emit();
  },
  quit(id: string) {
    hydrate();
    const { [id]: _drop, ...rest } = state;
    state = rest;
    persist();
    emit();
  },
  subscribe(cb: () => void) {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },
};

export function useChallenges(): Store {
  const snap = useSyncExternalStore(
    (cb) => challenges.subscribe(cb),
    () => challenges.get(),
    () => ({}),
  );
  useEffect(() => {
    hydrate();
    emit();
  }, []);
  return snap;
}

// Badges — derived from completed challenges.
export type Badge = { id: string; label: string; tier: "bronze" | "silver" | "gold"; earned: boolean; hint: string };

export function computeBadges(store: Store): Badge[] {
  const done = Object.values(store).filter((c) => c.completedDays.length >= 5);
  const inProgress = Object.values(store).length;
  const totalDays = Object.values(store).reduce((s, c) => s + c.completedDays.length, 0);
  return [
    { id: "starter", label: "Leak Hunter", tier: "bronze", earned: inProgress >= 1, hint: "Start your first challenge" },
    { id: "food", label: "No-Delivery 5", tier: "silver", earned: !!store["food_delivery"] && store["food_delivery"].completedDays.length >= 5, hint: "Finish 5 days of the delivery challenge" },
    { id: "cleaner", label: "Subscription Cleaner", tier: "silver", earned: !!store["entertainment_subs"] && store["entertainment_subs"].completedDays.length >= 5, hint: "Clean up entertainment subs" },
    { id: "impulse", label: "Impulse Control", tier: "silver", earned: !!store["late_night_spending"] && store["late_night_spending"].completedDays.length >= 5, hint: "Beat the 10 PM habit for 5 days" },
    { id: "weekend", label: "Weekend Saver", tier: "silver", earned: !!store["weekend_spending"] && store["weekend_spending"].completedDays.length >= 5, hint: "Complete a low-spend weekend" },
    { id: "gold", label: "Monthly Saver", tier: "gold", earned: done.length >= 2 || totalDays >= 14, hint: "Finish two 7-day challenges" },
  ];
}
