import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Flame, Target, TrendingUp, TrendingDown, Bike, CheckCircle2,
  Sparkles, RotateCcw, Play, AlertTriangle, Calendar,
} from "lucide-react";
import { GlassCard } from "@/components/finance/GlassCard";
import { useCurrentUser } from "@/lib/finance/auth";
import { inr } from "@/lib/finance/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/smartsave")({
  head: () => ({
    meta: [
      { title: "SmartSave Journey — FinGuard AI" },
      { name: "description", content: "Your AI-guided daily savings journey to reach your goal without lifestyle changes." },
      { property: "og:title", content: "SmartSave Journey — FinGuard AI" },
      { property: "og:description", content: "Personalised daily AI budget to help you buy your bike on time." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SmartSavePage,
});

// ---- Goal (fixed for prototype) ----
const GOAL = {
  name: "Buy Bike",
  targetAmount: 120000,
  months: 12,
  monthlySave: 10000,
  dailyBudget: 950,
  emoji: "🚲",
};

const STORAGE_KEY = "smartsave.journey.v1";

type JourneyState = {
  phase: "goal" | "analysis" | "journey";
  day: number;
  todaySpent: number;
  status: "active" | "ended";
  saved: number;
  history: { day: number; spent: number }[];
  estimatedDelayDays: number;
};

const DEFAULT_STATE: JourneyState = {
  phase: "goal",
  day: 12,
  todaySpent: 620,
  status: "active",
  saved: 46000,
  history: [],
  estimatedDelayDays: 0,
};

function loadState(): JourneyState {
  if (typeof window === "undefined") return DEFAULT_STATE;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    return { ...DEFAULT_STATE, ...JSON.parse(raw) };
  } catch { return DEFAULT_STATE; }
}
function saveState(s: JourneyState) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

function formatDate(d: Date) {
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });
}

function SmartSavePage() {
  const { user } = useCurrentUser();
  const [state, setState] = useState<JourneyState>(DEFAULT_STATE);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => { setState(loadState()); setHydrated(true); }, []);
  useEffect(() => { if (hydrated) saveState(state); }, [state, hydrated]);

  if (!hydrated) return <div className="p-6" />;

  if (state.phase === "goal") {
    return <GoalSetup onStart={() => setState((s) => ({ ...s, phase: "analysis" }))} />;
  }
  if (state.phase === "analysis") {
    return <AiAnalysis onDone={() => setState((s) => ({ ...s, phase: "journey" }))} />;
  }
  return <Journey state={state} setState={setState} userName={user?.firstName ?? "there"} />;
}

// ---------- Phase 1: Goal Setup ----------
function GoalSetup({ onStart }: { onStart: () => void }) {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl gradient-brand text-white">
          <Flame className="h-7 w-7" />
        </div>
        <h1 className="mt-4 text-2xl font-bold sm:text-3xl">Start your SmartSave Journey</h1>
        <p className="mt-2 text-sm text-muted-foreground">Set your goal and let AI craft a personalised daily budget.</p>
      </div>

      <GlassCard className="p-6 sm:p-8">
        <div className="space-y-5">
          <Field label="Goal">
            <div className="flex items-center gap-3 text-lg font-semibold">
              <span className="text-2xl">{GOAL.emoji}</span> {GOAL.name}
            </div>
          </Field>
          <Field label="Target Amount">
            <div className="text-2xl font-bold text-brand">{inr(GOAL.targetAmount)}</div>
          </Field>
          <Field label="Duration">
            <div className="text-lg font-semibold">{GOAL.months} Months</div>
          </Field>
        </div>
        <button
          onClick={onStart}
          className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-xl gradient-brand px-4 py-3 text-sm font-semibold text-white shadow-md transition hover:opacity-95"
        >
          <Sparkles className="h-4 w-4" /> Start SmartSave Journey
        </button>
      </GlassCard>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-1">{children}</div>
    </div>
  );
}

// ---------- Phase 2: AI Analysis ----------
function AiAnalysis({ onDone }: { onDone: () => void }) {
  const steps = [
    "Income detected",
    "Spending analysed",
    "Lifestyle evaluated",
    "Savings potential calculated",
  ];
  const [progress, setProgress] = useState(0);
  const [showResult, setShowResult] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setProgress((p) => (p < steps.length ? p + 1 : p)), 550);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (progress >= steps.length) {
      const t1 = setTimeout(() => setShowResult(true), 400);
      const t2 = setTimeout(onDone, 3000);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }
  }, [progress, onDone, steps.length]);

  return (
    <div className="mx-auto max-w-2xl">
      <GlassCard className="p-6 sm:p-8">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl gradient-brand text-white">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">AI Analysis</p>
            <h2 className="text-lg font-semibold">Analysing your financial habits…</h2>
          </div>
        </div>

        <ul className="mt-6 space-y-3">
          {steps.map((s, i) => (
            <motion.li
              key={s}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: i < progress ? 1 : 0.35, x: 0 }}
              transition={{ duration: 0.35 }}
              className="flex items-center gap-3 text-sm"
            >
              <CheckCircle2 className={cn("h-4 w-4", i < progress ? "text-emerald-500" : "text-muted-foreground/40")} />
              <span>{s}</span>
            </motion.li>
          ))}
        </ul>

        <AnimatePresence>
          {showResult && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 rounded-xl border bg-brand/5 p-4 text-sm"
            >
              <p>
                Based on your previous transaction history, you can comfortably save{" "}
                <span className="font-semibold text-brand">{inr(GOAL.monthlySave)}</span> every month without significantly changing your lifestyle.
              </p>
              <p className="mt-3">To achieve your Bike goal, your personalised AI daily budget is</p>
              <p className="mt-1 text-3xl font-bold text-brand">{inr(GOAL.dailyBudget)}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </GlassCard>
    </div>
  );
}

// ---------- Phase 3: Journey ----------
function Journey({
  state, setState, userName,
}: { state: JourneyState; setState: React.Dispatch<React.SetStateAction<JourneyState>>; userName: string }) {
  const [analysing, setAnalysing] = useState(false);

  const overspend = Math.max(0, state.todaySpent - GOAL.dailyBudget);
  const percent = Math.min(100, Math.round((state.saved / GOAL.targetAmount) * 100));
  const now = new Date();
  const est = new Date(now); est.setMonth(est.getMonth() + GOAL.months + Math.ceil(state.estimatedDelayDays / 30));
  est.setDate(est.getDate() + (state.estimatedDelayDays % 30));

  const hour = now.getHours();
  const greeting = hour < 12 ? "Good Morning" : hour < 18 ? "Good Afternoon" : "Good Evening";

  const runOverspend = () => {
    setAnalysing(true);
    setTimeout(() => {
      setAnalysing(false);
      setState((s) => ({
        ...s,
        todaySpent: 1040,
        status: "ended",
        estimatedDelayDays: 8,
      }));
    }, 1600);
  };
  const runSuccess = () => {
    setState((s) => ({
      ...s,
      day: s.day + 1,
      todaySpent: 620,
      saved: Math.min(GOAL.targetAmount, s.saved + GOAL.dailyBudget),
      status: "active",
      estimatedDelayDays: Math.max(0, s.estimatedDelayDays - 1),
    }));
  };
  const reset = () => setState(DEFAULT_STATE.phase === "goal"
    ? { ...DEFAULT_STATE, phase: "journey" }
    : DEFAULT_STATE);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Greeting */}
      <div>
        <h1 className="text-xl font-bold sm:text-2xl">{greeting} 👋</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Day {state.day} of your SmartSave Journey.
        </p>
        <p className="mt-1 text-sm">
          Stay within <span className="font-semibold">{inr(GOAL.dailyBudget)}</span> today and you'll be one day closer to owning your Bike.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Estimated Purchase: <span className="font-medium text-foreground">{formatDate(est)}</span>
        </p>
      </div>

      {/* Cards grid */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Goal Card */}
        <GlassCard className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand/15 text-brand">
                <Bike className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Bike Goal</p>
                <p className="text-lg font-semibold">{GOAL.name}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-brand">{percent}%</p>
            </div>
          </div>
          <div className="mt-4">
            <div className="flex items-end justify-between text-sm">
              <span className="font-semibold">{inr(state.saved)}</span>
              <span className="text-muted-foreground">of {inr(GOAL.targetAmount)}</span>
            </div>
            <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-secondary">
              <motion.div
                initial={false}
                animate={{ width: `${percent}%` }}
                transition={{ duration: 0.6 }}
                className={cn("h-full rounded-full", state.status === "ended" ? "bg-red-500" : "gradient-brand")}
              />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" /> Estimated Purchase: {formatDate(est)}
          </div>
        </GlassCard>

        {/* Journey Card */}
        <GlassCard className="p-5">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-amber-500/15 text-amber-500">
              <Flame className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">SmartSave Journey</p>
              <p className="text-lg font-semibold">{state.day} Days</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3 text-center">
            <div className="rounded-lg border p-2">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">AI Budget</p>
              <p className="mt-1 text-sm font-semibold">{inr(GOAL.dailyBudget)}</p>
            </div>
            <div className="rounded-lg border p-2">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Today's Spending</p>
              <p className={cn("mt-1 text-sm font-semibold", state.todaySpent > GOAL.dailyBudget ? "text-red-500" : "text-emerald-500")}>
                {inr(state.todaySpent)}
              </p>
            </div>
            <div className="rounded-lg border p-2">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Status</p>
              <p className="mt-1 text-sm font-semibold">
                {state.status === "active" ? "🟢 On Track" : "🔴 Ended"}
              </p>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Overspend analysing overlay */}
      <AnimatePresence>
        {analysing && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-xl border bg-card/60 p-4 text-sm backdrop-blur"
          >
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 animate-pulse text-brand" />
              Analysing purchase…
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Overspend insight */}
      {state.status === "ended" && !analysing && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <GlassCard className="border-red-500/30 p-5">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-red-500/15 text-red-500">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-red-500">SmartSave Insight</p>
                <p className="text-lg font-semibold">Journey Ended</p>
              </div>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <Stat label="Today's Spending" value={inr(state.todaySpent)} tone="danger" />
              <Stat label="AI Budget" value={inr(GOAL.dailyBudget)} />
              <Stat label="Exceeded by" value={inr(overspend)} tone="danger" icon={<TrendingUp className="h-3.5 w-3.5" />} />
            </div>
            <p className="mt-4 text-sm">
              If similar spending continues, your Bike purchase may be delayed by{" "}
              <span className="font-semibold text-red-500">{state.estimatedDelayDays} days</span>.
            </p>
          </GlassCard>
        </motion.div>
      )}

      {/* AI Coach */}
      <GlassCard className="p-5">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl gradient-brand text-white">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">AI Coach</p>
            <p className="text-lg font-semibold">
              {state.status === "ended" ? "Personalised Recovery Plan" : "Budget Advice & Motivation"}
            </p>
          </div>
        </div>
        <div className="mt-4 space-y-2 text-sm">
          {state.status === "ended" ? (
            <>
              <p>Today's overspending mainly came from <span className="font-semibold">Food</span>.</p>
              <p>You usually spend <span className="font-semibold">₹320/day</span> on Food. Today you spent <span className="font-semibold">₹610</span>.</p>
              <p className="text-emerald-500">Reducing Food spending by ₹150 tomorrow keeps your Bike goal on schedule.</p>
            </>
          ) : (
            <>
              <p>You're <span className="font-semibold">{percent}%</span> of the way to your Bike, {userName}. Nice discipline.</p>
              <p>Today's spending is <span className="font-semibold">₹{GOAL.dailyBudget - state.todaySpent}</span> under budget — that headroom compounds into ~{Math.round((GOAL.dailyBudget - state.todaySpent) * 30)} extra saved this month.</p>
              <p className="text-emerald-500">Keep this pace and you'll hit your goal on schedule.</p>
            </>
          )}
        </div>
      </GlassCard>

      {/* Demo Controls */}
      {/* 
      <GlassCard className="p-5">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Demo Controls (hackathon)</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <DemoBtn onClick={runOverspend} icon={<TrendingDown className="h-4 w-4" />} label="Simulate Overspending" tone="danger" />
          <DemoBtn onClick={runSuccess} icon={<TrendingUp className="h-4 w-4" />} label="Simulate Successful Day" tone="success" />
          <DemoBtn onClick={reset} icon={<RotateCcw className="h-4 w-4" />} label="Reset Journey" />
        </div>
      </GlassCard> 
      */}
    </div>
  );
}

function Stat({ label, value, tone, icon }: { label: string; value: string; tone?: "danger"; icon?: React.ReactNode }) {
  return (
    <div className={cn("rounded-lg border p-3", tone === "danger" && "border-red-500/30 bg-red-500/5")}>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("mt-1 flex items-center gap-1 text-base font-semibold", tone === "danger" && "text-red-500")}>
        {icon} {value}
      </p>
    </div>
  );
}

function DemoBtn({ onClick, icon, label, tone }: { onClick: () => void; icon: React.ReactNode; label: string; tone?: "danger" | "success" }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition hover:bg-secondary",
        tone === "danger" && "border-red-500/30 text-red-500 hover:bg-red-500/10",
        tone === "success" && "border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10",
      )}
    >
      <Play className="h-3.5 w-3.5" />
      {icon}
      {label}
    </button>
  );
}
