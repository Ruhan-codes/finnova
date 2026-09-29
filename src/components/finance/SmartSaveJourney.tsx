// SmartSave Journey UI — behavioural coaching layer.
// Composes with existing GlassCard/glassmorphism; adds AI onboarding,
// morning motivation, goal card, streak card, purchase analysis, journey
// ended modal, AI coach, milestones and a demo simulator.
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import {
  Bike, Flame, Sparkles, TrendingUp, CheckCircle2, AlertTriangle,
  Trophy, X, PartyPopper, Zap,
} from "lucide-react";
import { GlassCard } from "@/components/finance/GlassCard";
import { inr } from "@/lib/finance/format";
import { useAnalytics } from "@/lib/finance/store";
import {
  SMARTSAVE_GOAL, estimatedPurchaseDate, formatDate, progressPct,
  smartSave, useSmartSave,
} from "@/lib/finance/smartsave";

// ────────────────────────────────────────────────────────────────────────────
// Root component — orchestrates onboarding, cards and modals.
// ────────────────────────────────────────────────────────────────────────────
export function SmartSaveJourney() {
  const s = useSmartSave();
  const analytics = useAnalytics();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [insight, setInsight] = useState<null | {
    newTotal: number; delta: number; over: number;
  }>(null);
  const [journeyEndOpen, setJourneyEndOpen] = useState(false);
  const [milestone, setMilestone] = useState<null | 7 | 30 | 50>(null);

  // Auto-run onboarding on first visit.
  useEffect(() => {
    if (!s.onboarded) setShowOnboarding(true);
  }, [s.onboarded]);

  // Auto-trigger milestone celebrations.
  useEffect(() => {
    for (const m of [50, 30, 7] as const) {
      if (s.streakDays >= m && !s.celebratedMilestones.includes(m)) {
        setMilestone(m);
        break;
      }
    }
  }, [s.streakDays, s.celebratedMilestones]);

  const topCategory = analytics.categories[0]?.category ?? "Food";
  const topCategoryDaily = Math.max(
    120,
    Math.round((analytics.categories[0]?.amount ?? 9600) / 30),
  );

  function simulate() {
    // Fake ₹420 Swiggy purchase.
    setAnalyzing(true);
    setTimeout(() => {
      const prevToday = smartSave.get().todaySpending;
      smartSave.addSpending(420);
      const newTotal = prevToday + 420;
      const over = Math.max(0, newTotal - smartSave.get().dailyBudget);
      const delta = Math.max(1, Math.round(over / 12));
      setAnalyzing(false);
      setInsight({ newTotal, delta, over });
    }, 1600);
  }

  function endJourney() {
    setInsight(null);
    smartSave.endJourney();
    setJourneyEndOpen(true);
  }

  const purchaseDate = useMemo(() => formatDate(estimatedPurchaseDate(s)), [s]);

  return (
    <>
      {/* Morning motivation banner */}
      {s.onboarded && (
        <MorningMotivation
          streak={s.streakDays}
          budget={s.dailyBudget}
          purchaseDate={purchaseDate}
          ended={s.journeyEnded}
        />
      )}

      {/* Flagship dashboard cards */}
      {s.onboarded && (
        <div className="grid gap-4 md:grid-cols-2">
          <BikeGoalCard state={s} purchaseDate={purchaseDate} />
          <JourneyCard state={s} onSimulate={simulate} />
        </div>
      )}

      {/* AI Coach — only after journey ends */}
      {s.journeyEnded && (
        <AiCoachCard
          topCategory={topCategory}
          usualDaily={topCategoryDaily}
          todayInCategory={topCategoryDaily + Math.round((s.todaySpending - s.dailyBudget) * 0.7)}
        />
      )}

      {/* Modals & overlays */}
      <AnimatePresence>
        {showOnboarding && (
          <OnboardingModal
            onDone={() => {
              smartSave.completeOnboarding();
              setShowOnboarding(false);
            }}
          />
        )}
        {analyzing && <AnalyzingOverlay />}
        {insight && !analyzing && (
          <InsightModal
            data={insight}
            budget={s.dailyBudget}
            onClose={() => setInsight(null)}
            onEndJourney={endJourney}
          />
        )}
        {journeyEndOpen && (
          <JourneyEndedModal
            days={s.streakDays}
            onClose={() => setJourneyEndOpen(false)}
          />
        )}
        {milestone && (
          <MilestoneModal
            days={milestone}
            state={s}
            onClose={() => {
              smartSave.celebrate(milestone);
              setMilestone(null);
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Morning motivation
// ────────────────────────────────────────────────────────────────────────────
function MorningMotivation({
  streak, budget, purchaseDate, ended,
}: { streak: number; budget: number; purchaseDate: string; ended: boolean }) {
  const h = new Date().getHours();
  const greeting = h < 12 ? "Good Morning" : h < 18 ? "Good Afternoon" : "Good Evening";
  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass relative overflow-hidden rounded-2xl border border-brand/20 p-5"
    >
      <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-brand/15 blur-3xl" />
      <div className="relative flex items-start gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl gradient-brand text-white shadow-md">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            SmartSave Journey · Day {streak}
          </p>
          <h2 className="mt-0.5 text-lg font-semibold">
            {greeting} 👋 {ended ? "Start fresh tomorrow." : `Stay within ${inr(budget)} today`}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {ended
              ? "Every disciplined day moves you closer to your Bike."
              : `and you'll be one day closer to owning your Bike. Estimated purchase date `}
            {!ended && <span className="font-medium text-foreground">{purchaseDate}</span>}
            {!ended && "."}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Card 1 — Bike goal
// ────────────────────────────────────────────────────────────────────────────
function BikeGoalCard({
  state, purchaseDate,
}: { state: ReturnType<typeof useSmartSave>; purchaseDate: string }) {
  const pct = progressPct(state);
  return (
    <GlassCard className="relative overflow-hidden">
      <div className="absolute -right-6 -top-6 h-32 w-32 rounded-full bg-brand/10 blur-2xl" />
      <div className="relative flex items-start justify-between">
        <div>
          <p className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            <Bike className="h-3.5 w-3.5" /> Goal
          </p>
          <h3 className="mt-1 text-xl font-semibold">
            {SMARTSAVE_GOAL.emoji} {SMARTSAVE_GOAL.name} Goal
          </h3>
        </div>
        <span className="rounded-full bg-brand/15 px-2.5 py-1 text-xs font-medium text-brand">
          {SMARTSAVE_GOAL.months} months
        </span>
      </div>

      <div className="mt-5 flex items-end gap-2">
        <p className="text-3xl font-semibold tabular-nums">{pct}%</p>
        <p className="pb-1 text-xs text-muted-foreground">progress</p>
      </div>
      <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-secondary">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1.1, ease: "easeOut" }}
          className="h-full rounded-full gradient-brand"
        />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl border bg-card/60 p-3">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Saved</p>
          <p className="mt-0.5 text-sm font-semibold">
            {inr(state.savedAmount)}{" "}
            <span className="text-xs font-normal text-muted-foreground">
              / {inr(SMARTSAVE_GOAL.target)}
            </span>
          </p>
        </div>
        <div className="rounded-xl border bg-card/60 p-3">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Est. Purchase</p>
          <p className="mt-0.5 text-sm font-semibold">{purchaseDate}</p>
        </div>
      </div>
    </GlassCard>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Card 2 — Journey status
// ────────────────────────────────────────────────────────────────────────────
function JourneyCard({
  state, onSimulate,
}: { state: ReturnType<typeof useSmartSave>; onSimulate: () => void }) {
  const onTrack = state.todaySpending <= state.dailyBudget && !state.journeyEnded;
  const remaining = Math.max(0, state.dailyBudget - state.todaySpending);
  const usedPct = Math.min(100, Math.round((state.todaySpending / state.dailyBudget) * 100));
  return (
    <GlassCard className="relative overflow-hidden">
      <div className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-orange-400/15 blur-3xl" />
      <div className="relative flex items-start justify-between">
        <div>
          <p className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            <Flame className="h-3.5 w-3.5" /> SmartSave Journey
          </p>
          <h3 className="mt-1 flex items-baseline gap-2 text-2xl font-semibold">
            <motion.span
              key={state.streakDays}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
            >
              🔥 {state.streakDays}
            </motion.span>
            <span className="text-sm font-normal text-muted-foreground">Days</span>
          </h3>
        </div>
        <StatusPill onTrack={onTrack} ended={state.journeyEnded} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl border bg-card/60 p-3">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Today's AI Budget</p>
          <p className="mt-0.5 text-sm font-semibold">{inr(state.dailyBudget)}</p>
        </div>
        <div className="rounded-xl border bg-card/60 p-3">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Today's Spending</p>
          <motion.p
            key={state.todaySpending}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className={`mt-0.5 text-sm font-semibold ${
              state.todaySpending > state.dailyBudget ? "text-destructive" : ""
            }`}
          >
            {inr(state.todaySpending)}
          </motion.p>
        </div>
      </div>

      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-secondary">
        <motion.div
          animate={{ width: `${usedPct}%` }}
          transition={{ duration: 0.6 }}
          className={`h-full rounded-full ${
            usedPct >= 100 ? "bg-destructive" : usedPct > 80 ? "bg-warning" : "bg-success"
          }`}
        />
      </div>
      <p className="mt-1.5 text-[11px] text-muted-foreground">
        {onTrack
          ? `${inr(remaining)} left within today's AI budget.`
          : state.journeyEnded
            ? "Journey ended — start a new one tomorrow."
            : `Exceeded by ${inr(state.todaySpending - state.dailyBudget)}.`}
      </p>

      <button
        onClick={onSimulate}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-brand/40 bg-brand/5 px-3 py-2 text-xs font-medium text-brand transition hover:bg-brand/10"
      >
        <Zap className="h-3.5 w-3.5" /> Demo: Simulate Overspending
      </button>
    </GlassCard>
  );
}

function StatusPill({ onTrack, ended }: { onTrack: boolean; ended: boolean }) {
  if (ended)
    return (
      <span className="rounded-full bg-destructive/15 px-2.5 py-1 text-xs font-medium text-destructive">
        Journey Ended
      </span>
    );
  return onTrack ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2.5 py-1 text-xs font-medium text-success">
      <span className="h-1.5 w-1.5 rounded-full bg-success" /> On Track
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2.5 py-1 text-xs font-medium text-warning">
      <span className="h-1.5 w-1.5 rounded-full bg-warning" /> Over Budget
    </span>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Onboarding modal
// ────────────────────────────────────────────────────────────────────────────
const ONBOARDING_STEPS = [
  "Income detected",
  "Spending pattern analysed",
  "Lifestyle evaluated",
  "Savings potential calculated",
];

function OnboardingModal({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const [showInsight, setShowInsight] = useState(false);
  useEffect(() => {
    if (step < ONBOARDING_STEPS.length) {
      const t = setTimeout(() => setStep((s) => s + 1), 600);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setShowInsight(true), 400);
    return () => clearTimeout(t);
  }, [step]);

  return (
    <ModalShell>
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="glass w-full max-w-md rounded-3xl border p-7 shadow-2xl"
      >
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl gradient-brand text-white shadow-md">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">FinNova AI</p>
            <h3 className="text-lg font-semibold">
              {showInsight ? "Your personalised AI budget" : "Analysing your financial habits…"}
            </h3>
          </div>
        </div>

        {!showInsight ? (
          <ul className="mt-6 space-y-2.5">
            {ONBOARDING_STEPS.map((label, i) => (
              <motion.li
                key={label}
                initial={{ opacity: 0.3 }}
                animate={{ opacity: i < step ? 1 : 0.35 }}
                className="flex items-center gap-3 rounded-xl border bg-card/60 p-3 text-sm"
              >
                {i < step ? (
                  <CheckCircle2 className="h-4 w-4 text-success" />
                ) : (
                  <motion.span
                    className="h-4 w-4 rounded-full border-2 border-brand/40 border-t-brand"
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 0.9, ease: "linear" }}
                  />
                )}
                <span>{label}</span>
              </motion.li>
            ))}
          </ul>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 space-y-4"
          >
            <div className="rounded-2xl border border-brand/30 bg-brand/5 p-4">
              <p className="text-sm leading-relaxed">
                Based on your previous transaction history, you can comfortably save{" "}
                <span className="font-semibold text-brand">₹10,000</span> every month without
                significantly changing your lifestyle.
              </p>
            </div>
            <div className="rounded-2xl border p-4">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                Recommended daily spending limit
              </p>
              <p className="mt-1 text-3xl font-semibold">₹950</p>
              <p className="mt-1 text-xs text-muted-foreground">
                To reach your {SMARTSAVE_GOAL.emoji} {SMARTSAVE_GOAL.name} goal of{" "}
                {inr(SMARTSAVE_GOAL.target)} within {SMARTSAVE_GOAL.months} months.
              </p>
            </div>
            <button
              onClick={onDone}
              className="w-full rounded-xl gradient-brand py-2.5 text-sm font-medium text-white shadow-md"
            >
              Begin my SmartSave Journey
            </button>
          </motion.div>
        )}
      </motion.div>
    </ModalShell>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Purchase analysing overlay
// ────────────────────────────────────────────────────────────────────────────
function AnalyzingOverlay() {
  return (
    <ModalShell>
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ opacity: 0 }}
        className="glass flex w-full max-w-xs items-center gap-4 rounded-2xl border p-5 shadow-2xl"
      >
        <motion.span
          className="h-6 w-6 rounded-full border-2 border-brand/40 border-t-brand"
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 0.9, ease: "linear" }}
        />
        <div>
          <p className="text-sm font-semibold">Analysing purchase…</p>
          <p className="text-xs text-muted-foreground">FinNova AI is reviewing the impact.</p>
        </div>
      </motion.div>
    </ModalShell>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Insight modal (post-purchase)
// ────────────────────────────────────────────────────────────────────────────
function InsightModal({
  data, budget, onClose, onEndJourney,
}: {
  data: { newTotal: number; delta: number; over: number };
  budget: number;
  onClose: () => void;
  onEndJourney: () => void;
}) {
  const exceeded = data.over > 0;
  return (
    <ModalShell onClose={onClose}>
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="glass w-full max-w-md rounded-3xl border p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-warning/15 text-warning">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">SmartSave Insight</p>
              <h3 className="text-lg font-semibold">Purchase impact analysed</h3>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-muted-foreground hover:bg-secondary">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 space-y-3">
          <div className="rounded-2xl border p-4 text-sm">
            <p>
              This purchase increases today's spending to{" "}
              <span className="font-semibold">{inr(data.newTotal)}</span>.
            </p>
            <p className="mt-1 text-muted-foreground">
              Your personalised AI budget is{" "}
              <span className="font-medium text-foreground">{inr(budget)}</span>.
            </p>
            {exceeded && (
              <p className="mt-1 text-destructive">
                You exceeded today's recommendation by{" "}
                <span className="font-semibold">{inr(data.over)}</span>.
              </p>
            )}
          </div>

          {exceeded && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-center"
            >
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                If similar spending continues, your Bike goal may be delayed by
              </p>
              <p className="mt-2 text-4xl font-semibold text-destructive tabular-nums">
                {data.delta} days
              </p>
            </motion.div>
          )}

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 rounded-xl border bg-card px-3 py-2 text-sm font-medium hover:bg-secondary"
            >
              Got it
            </button>
            {exceeded && (
              <button
                onClick={onEndJourney}
                className="flex-1 rounded-xl bg-destructive px-3 py-2 text-sm font-medium text-destructive-foreground hover:opacity-90"
              >
                See Journey Impact
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </ModalShell>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Journey ended modal
// ────────────────────────────────────────────────────────────────────────────
function JourneyEndedModal({ days, onClose }: { days: number; onClose: () => void }) {
  return (
    <ModalShell onClose={onClose}>
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ type: "spring", stiffness: 220, damping: 22 }}
        className="glass relative w-full max-w-md overflow-hidden rounded-3xl border p-7 text-center shadow-2xl"
      >
        <div className="absolute -inset-16 bg-gradient-to-br from-orange-500/20 via-transparent to-destructive/20 blur-3xl" />
        <div className="relative">
          <motion.div
            initial={{ scale: 0.5, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring" }}
            className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-orange-500 to-red-500 text-white shadow-lg"
          >
            <Flame className="h-8 w-8" />
          </motion.div>
          <h2 className="mt-4 text-2xl font-semibold">🔥 SmartSave Journey Ended</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Your <span className="font-semibold text-foreground">{days}-day</span> SmartSave Journey
            has come to an end.
          </p>
          <div className="mt-4 rounded-2xl border bg-card/60 p-4 text-sm leading-relaxed">
            Every SmartSave Journey is unique. Once it ends, it cannot be restored.
            <br />
            Start a new journey tomorrow and build an even longer streak.
          </div>
          <button
            onClick={onClose}
            className="mt-5 w-full rounded-xl gradient-brand py-2.5 text-sm font-medium text-white shadow-md"
          >
            Close
          </button>
        </div>
      </motion.div>
    </ModalShell>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// AI Coach — post-journey contextual advice
// ────────────────────────────────────────────────────────────────────────────
function AiCoachCard({
  topCategory, usualDaily, todayInCategory,
}: { topCategory: string; usualDaily: number; todayInCategory: number }) {
  const reduce = Math.max(50, todayInCategory - usualDaily - 30);
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <GlassCard className="border border-brand/25">
        <div className="mb-3 flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl gradient-brand text-white">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">AI Coach</p>
            <h3 className="text-sm font-semibold">Personalised recovery plan</h3>
          </div>
        </div>
        <div className="space-y-2 text-sm">
          <p>
            Today's overspending mainly came from{" "}
            <span className="font-semibold">{topCategory}</span>.
          </p>
          <p className="text-muted-foreground">
            You usually spend{" "}
            <span className="font-medium text-foreground">{inr(usualDaily)}</span> per day on{" "}
            {topCategory}. Today you spent{" "}
            <span className="font-medium text-foreground">{inr(todayInCategory)}</span>.
          </p>
          <div className="rounded-xl border border-success/30 bg-success/5 p-3">
            <p className="flex items-center gap-2 text-sm">
              <TrendingUp className="h-4 w-4 text-success" />
              Reducing {topCategory} spending by{" "}
              <span className="font-semibold">{inr(reduce)}</span> tomorrow keeps your Bike goal on
              schedule.
            </p>
          </div>
        </div>
      </GlassCard>
    </motion.div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Milestone modal (7 / 30 / 50 day journeys)
// ────────────────────────────────────────────────────────────────────────────
function MilestoneModal({
  days, state, onClose,
}: { days: 7 | 30 | 50; state: ReturnType<typeof useSmartSave>; onClose: () => void }) {
  const content = milestoneContent(days, state);
  return (
    <ModalShell onClose={onClose}>
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: "spring", stiffness: 220, damping: 22 }}
        className="glass relative w-full max-w-md overflow-hidden rounded-3xl border p-7 text-center shadow-2xl"
      >
        <div className="absolute -inset-16 bg-gradient-to-br from-brand/25 via-transparent to-emerald-400/20 blur-3xl" />
        <div className="relative">
          <motion.div
            initial={{ scale: 0.5, rotate: -8 }}
            animate={{ scale: 1, rotate: 0 }}
            className="mx-auto grid h-16 w-16 place-items-center rounded-2xl gradient-brand text-white shadow-lg"
          >
            {days === 50 ? <PartyPopper className="h-8 w-8" /> : <Trophy className="h-8 w-8" />}
          </motion.div>
          <h2 className="mt-4 text-2xl font-semibold">{content.title}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{content.body}</p>
          {content.stat && (
            <div className="mt-4 rounded-2xl border bg-card/60 p-4">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                {content.stat.label}
              </p>
              <p className="mt-1 text-3xl font-semibold text-brand">{content.stat.value}</p>
            </div>
          )}
          <button
            onClick={onClose}
            className="mt-5 w-full rounded-xl gradient-brand py-2.5 text-sm font-medium text-white shadow-md"
          >
            Keep going
          </button>
        </div>
      </motion.div>
    </ModalShell>
  );
}

function milestoneContent(days: 7 | 30 | 50, _state: ReturnType<typeof useSmartSave>) {
  if (days === 7) {
    return {
      title: "🏆 7-Day Journey",
      body: "Because of your consistency, you've avoided unnecessary spending.",
      stat: { label: "Amount avoided", value: inr(1850) },
    };
  }
  if (days === 30) {
    return {
      title: "🏆 30-Day Journey",
      body: "Excellent work. Your disciplined spending has moved your Bike purchase earlier than originally estimated.",
      stat: { label: "Earlier by", value: "11 days" },
    };
  }
  return {
    title: "🎉 Outstanding!",
    body: `You've consistently followed your personalised AI budget for ${days} days. Compared to your previous habits, you've already saved a meaningful amount and moved your Bike goal closer.`,
    stat: { label: "Extra saved · Days closer", value: `${inr(8420)} · 17 days` },
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Modal shell — dim + centre + backdrop click
// ────────────────────────────────────────────────────────────────────────────
function ModalShell({ children, onClose }: { children: React.ReactNode; onClose?: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 grid place-items-center bg-background/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md">
        {children}
      </div>
    </motion.div>
  );
}
