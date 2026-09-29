import { createFileRoute } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import {
  Droplet,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Minus,
  Zap,
  Clock,
  CalendarDays,
  Flame,
  ShieldCheck,
  Loader2,
  Check,
  X,
  Trophy,
  Award,
  Star,
  Brain,
  Rocket,
  Compass,
  Eye,
  EyeOff,
  RotateCcw,
} from "lucide-react";
import { GlassCard } from "@/components/finance/GlassCard";
import { useTransactions, useAnalytics } from "@/lib/finance/store";
import { buildBehaviourReport, buildChallenge, habitKey, type Habit, type HabitPriority } from "@/lib/finance/behaviour";
import { challenges, useChallenges, computeBadges } from "@/lib/finance/challenges";
import { listLeakFeedback, setLeakFeedback, type LeakDecision } from "@/lib/finance/leakFeedback.functions";
import { explainLeak } from "@/lib/ai/leakcoach.functions";
import { useSmartSave, SMARTSAVE_GOAL, estimatedPurchaseDate, formatDate } from "@/lib/finance/smartsave";
import { inr } from "@/lib/finance/format";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/moneyleaks")({
  head: () => ({
    meta: [
      { title: "AI Financial Behaviour Coach — FinGuard AI" },
      {
        name: "description",
        content:
          "Behaviour-first money leak coach: uncover hidden habits, prioritise fixes, and see how each change accelerates your financial goals.",
      },
      { property: "og:title", content: "AI Financial Behaviour Coach — FinGuard AI" },
      {
        property: "og:description",
        content: "Find hidden spending habits, rank them by impact, and get 7-day challenges to reach your goal earlier.",
      },
    ],
  }),
  component: BehaviourCoach,
});

const PRIORITY_STYLES: Record<HabitPriority, string> = {
  critical: "border-destructive/40 bg-destructive/10 text-destructive",
  high: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  medium: "border-brand/40 bg-brand/10 text-brand",
  low: "border-border bg-secondary/60 text-muted-foreground",
};

const CATEGORY_STYLES: Record<Habit["category"], string> = {
  necessary: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  emotional: "bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400 border-fuchsia-500/30",
  waste: "bg-destructive/10 text-destructive border-destructive/30",
  lifestyle: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30",
};

function Stars({ n }: { n: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${n} of 5 priority`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={cn("h-3.5 w-3.5", i <= n ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30")}
        />
      ))}
    </span>
  );
}

function CoachText({ text }: { text: string }) {
  const lines = text.split(/\r?\n/);
  return (
    <div className="space-y-1.5">
      {lines.map((raw, i) => {
        const line = raw.trim();
        if (!line) return null;
        const bullet = /^[-*•]\s+/.test(line);
        const body = bullet ? line.replace(/^[-*•]\s+/, "") : line;
        const parts = body.split(/\*\*(.+?)\*\*/g);
        const content = parts.map((p, j) =>
          j % 2 === 1 ? (
            <strong key={j} className="font-semibold text-foreground">
              {p}
            </strong>
          ) : (
            <span key={j}>{p}</span>
          ),
        );
        return bullet ? (
          <p key={i} className="flex gap-2 pl-1">
            <span className="text-brand">•</span>
            <span>{content}</span>
          </p>
        ) : (
          <p key={i}>{content}</p>
        );
      })}
    </div>
  );
}

function ScoreRing({ score, band }: { score: number; band: string }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const color = score >= 70 ? "stroke-emerald-500" : score >= 50 ? "stroke-amber-500" : "stroke-destructive";
  return (
    <div className="relative grid h-40 w-40 shrink-0 place-items-center">
      <svg viewBox="0 0 120 120" className="h-40 w-40 -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" strokeWidth="10" className="stroke-secondary" />
        <motion.circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          strokeWidth="10"
          strokeLinecap="round"
          className={color}
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c - (c * score) / 100 }}
          transition={{ duration: 1, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute text-center">
        <p className="text-4xl font-semibold tabular-nums">{score}</p>
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">AI Leak Score</p>
        <p className="mt-0.5 text-[11px] font-medium text-foreground">{band}</p>
      </div>
    </div>
  );
}

function TrendPill({ trend, delta }: { trend: "improving" | "worsening" | "steady"; delta: number }) {
  const map = {
    improving: { icon: TrendingDown, cls: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", label: "Improving" },
    worsening: { icon: TrendingUp, cls: "border-destructive/40 bg-destructive/10 text-destructive", label: "Getting worse" },
    steady: { icon: Minus, cls: "border-border bg-secondary/60 text-muted-foreground", label: "Steady" },
  } as const;
  const { icon: Icon, cls, label } = map[trend];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium", cls)}>
      <Icon className="h-3 w-3" />
      Leak trend: {label}
      {delta !== 0 && <span className="tabular-nums opacity-80">({delta > 0 ? "+" : ""}{delta})</span>}
    </span>
  );
}

function HabitCard({
  habit,
  decision,
  onDecide,
  onChallenge,
  monthlySpend,
  hasChallenge,
  rank,
}: {
  habit: Habit;
  decision?: LeakDecision;
  onDecide: (d: LeakDecision | null) => void;
  onChallenge: () => void;
  monthlySpend: number;
  hasChallenge: boolean;
  rank: number;
}) {
  const [open, setOpen] = useState(false);
  const explain = useServerFn(explainLeak);
  const ai = useQuery({
    queryKey: ["habit-explain", habit.id],
    enabled: open,
    staleTime: Infinity,
    retry: false,
    queryFn: () =>
      explain({
        data: {
          merchant: habit.title,
          category: habit.reason,
          reason: habit.narrative,
          monthlyAmount: habit.monthlyAmount,
          potentialMonthlySaving: habit.monthlySaving,
          severity: habit.priority,
          spendShare: habit.spendShare,
          monthlySpend,
        },
      }),
  });

  const dimmed = decision === "ignored" || decision === "keep";

  return (
    <motion.div layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <GlassCard className={cn("h-full", dimmed && "opacity-70")}>
        <div className="mb-3 flex items-start gap-3">
          <div className="flex flex-col items-center gap-1">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand/10 text-lg">
              {habit.emoji}
            </div>
            <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground">
              #{rank}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-sm font-semibold">{habit.title}</p>
              <span
                className={cn(
                  "rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider",
                  PRIORITY_STYLES[habit.priority],
                )}
              >
                {habit.priority}
              </span>
              <span
                className={cn(
                  "rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize",
                  CATEGORY_STYLES[habit.category],
                )}
              >
                {habit.category}
              </span>
            </div>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{habit.reason}</p>
            <div className="mt-1"><Stars n={habit.stars} /></div>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-sm font-semibold tabular-nums">{inr(habit.monthlyAmount)}</p>
            <p className="text-[10px] text-muted-foreground">/ month</p>
          </div>
        </div>

        <p className="mb-3 text-xs leading-relaxed">{habit.narrative}</p>

        {habit.merchants.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-1">
            {habit.merchants.map((m) => (
              <span key={m} className="rounded-full bg-secondary/60 px-2 py-0.5 text-[10px] text-muted-foreground">
                {m}
              </span>
            ))}
          </div>
        )}

        <div className="mb-3">
          <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
            <span>Impact on spending</span>
            <span className="tabular-nums">{habit.spendShare}% of monthly spend</span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-secondary">
            <motion.div
              className={cn(
                "h-full rounded-full",
                habit.priority === "critical" ? "bg-destructive" : habit.priority === "high" ? "bg-amber-500" : "bg-brand",
              )}
              initial={{ width: 0 }}
              animate={{ width: `${Math.max(6, habit.impact)}%` }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Monthly save</p>
            <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">{inr(habit.monthlySaving)}</p>
          </div>
          <div className="rounded-lg border border-brand/30 bg-brand/5 p-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Annual save</p>
            <p className="text-sm font-semibold text-brand">{inr(habit.annualSaving)}</p>
          </div>
        </div>

        <div className="mt-3 flex items-start gap-2 rounded-lg bg-secondary/50 p-2.5">
          <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" />
          <div className="text-xs">
            <p className="font-medium">{habit.action.label}</p>
            <p className="text-muted-foreground">{habit.action.description}</p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => onDecide(decision === "fixing" ? null : "fixing")}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
              decision === "fixing"
                ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                : "border-border hover:bg-secondary",
            )}
          >
            <Check className="h-3 w-3" /> Reduce 30%
          </button>
          <button
            type="button"
            onClick={() => onDecide(decision === "keep" ? null : "keep")}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
              decision === "keep"
                ? "border-sky-500/50 bg-sky-500/15 text-sky-600 dark:text-sky-400"
                : "border-border hover:bg-secondary",
            )}
          >
            <ShieldCheck className="h-3 w-3" /> Necessary
          </button>
          <button
            type="button"
            onClick={() => onDecide(decision === "ignored" ? null : "ignored")}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
              decision === "ignored"
                ? "border-muted-foreground/40 bg-secondary text-muted-foreground"
                : "border-border hover:bg-secondary",
            )}
          >
            {decision === "ignored" ? <RotateCcw className="h-3 w-3" /> : <X className="h-3 w-3" />}
            {decision === "ignored" ? "Restore" : "Not a leak"}
          </button>
          <button
            type="button"
            onClick={onChallenge}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
              hasChallenge
                ? "border-amber-500/50 bg-amber-500/15 text-amber-600 dark:text-amber-400"
                : "border-border hover:bg-secondary",
            )}
          >
            <Flame className="h-3 w-3" /> {hasChallenge ? "Challenge active" : "Challenge me"}
          </button>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="ml-auto inline-flex items-center gap-1 rounded-full border border-brand/40 bg-brand/10 px-2.5 py-1 text-[11px] font-medium text-brand transition-colors hover:bg-brand/20"
          >
            <Brain className="h-3 w-3" /> {open ? "Hide" : "Why is this happening?"}
          </button>
        </div>

        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-3 rounded-lg border border-brand/25 bg-brand/5 p-3 text-xs leading-relaxed">
                {ai.isLoading && (
                  <span className="inline-flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Analysing this habit…
                  </span>
                )}
                {ai.isError && (
                  <span className="text-destructive">
                    {ai.error instanceof Error ? ai.error.message : "Could not reach the AI coach."}
                  </span>
                )}
                {ai.data && <CoachText text={ai.data.text} />}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </GlassCard>
    </motion.div>
  );
}

function ChallengePanel({ habit, onClose }: { habit: Habit; onClose: () => void }) {
  const store = useChallenges();
  const c = store[habit.id];
  const plan = useMemo(() => buildChallenge(habit), [habit]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-lg"
    >
      <GlassCard className="border-amber-500/40 shadow-2xl">
        <div className="mb-2 flex items-start gap-2">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-amber-500/15 text-amber-500">
            <Flame className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{plan.title}</p>
            <p className="text-[11px] text-muted-foreground">{plan.reward}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-muted-foreground hover:bg-secondary"
            aria-label="Close challenge"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {!c ? (
          <button
            type="button"
            onClick={() => challenges.start(habit.id, plan.title)}
            className="w-full rounded-lg bg-amber-500 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-500/90"
          >
            Start 7-day challenge
          </button>
        ) : (
          <>
            <div className="grid grid-cols-7 gap-1.5">
              {plan.days.map((d, i) => {
                const done = c.completedDays.includes(i);
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => challenges.toggleDay(habit.id, i)}
                    title={d}
                    className={cn(
                      "aspect-square rounded-lg border text-[11px] font-semibold transition",
                      done
                        ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                        : "border-border hover:bg-secondary",
                    )}
                  >
                    D{i + 1}
                  </button>
                );
              })}
            </div>
            <div className="mt-2 max-h-32 space-y-1 overflow-y-auto text-[11px] text-muted-foreground">
              {plan.days.map((d, i) => (
                <p key={i} className={cn(c.completedDays.includes(i) && "text-emerald-600 line-through dark:text-emerald-400")}>
                  Day {i + 1}: {d}
                </p>
              ))}
            </div>
            <div className="mt-2 flex items-center justify-between">
              <p className="text-[11px] font-medium tabular-nums">
                {c.completedDays.length} / 7 days done
              </p>
              <button
                type="button"
                onClick={() => challenges.quit(habit.id)}
                className="text-[11px] text-muted-foreground underline-offset-2 hover:underline"
              >
                Quit challenge
              </button>
            </div>
          </>
        )}
      </GlassCard>
    </motion.div>
  );
}

function BehaviourCoach() {
  const txs = useTransactions();
  const a = useAnalytics();
  const smart = useSmartSave();
  const qc = useQueryClient();
  const challengeStore = useChallenges();
  const [challengeFor, setChallengeFor] = useState<Habit | null>(null);
  const [showIgnored, setShowIgnored] = useState(false);

  const fetchFeedback = useServerFn(listLeakFeedback);
  const feedbackQuery = useQuery({
    queryKey: ["leak-feedback"],
    queryFn: () => fetchFeedback(),
    staleTime: 60_000,
  });
  const saveFeedback = useServerFn(setLeakFeedback);
  const decide = useMutation({
    mutationFn: (v: { leakKey: string; decision: LeakDecision | null }) => saveFeedback({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["leak-feedback"] }),
  });

  const decisions = useMemo(() => {
    const m = new Map<string, LeakDecision>();
    for (const f of feedbackQuery.data ?? []) m.set(f.leakKey, f.decision);
    return m;
  }, [feedbackQuery.data]);

  const report = useMemo(() => buildBehaviourReport(txs, a), [txs, a]);

  const activeHabits = useMemo(
    () => report.habits.filter((h) => {
      const d = decisions.get(habitKey(h.id));
      return d !== "ignored" && d !== "keep";
    }),
    [report.habits, decisions],
  );
  const visibleHabits = showIgnored ? report.habits : activeHabits;

  const monthlySpend = a.averages.monthlySpend || a.currentMonth.expenses || 1;
  const totalMonthlySaving = activeHabits.reduce((s, h) => s + h.monthlySaving, 0);
  const totalAnnualSaving = totalMonthlySaving * 12;

  // Goal impact
  const monthsToGoal = Math.max(
    0.1,
    (SMARTSAVE_GOAL.target - smart.savedAmount) / Math.max(1, smart.monthlyPotential),
  );
  const monthsWithFix = Math.max(
    0.1,
    (SMARTSAVE_GOAL.target - smart.savedAmount) / Math.max(1, smart.monthlyPotential + totalMonthlySaving),
  );
  const daysEarlier = Math.max(0, Math.round((monthsToGoal - monthsWithFix) * 30));
  const goalDate = estimatedPurchaseDate(smart);

  const badges = computeBadges(challengeStore);

  const topHabit = activeHabits[0];
  const activeChallenges = Object.keys(challengeStore).length;

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand/15 text-brand">
          <Compass className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold sm:text-3xl">AI Financial Behaviour Coach</h1>
          <p className="text-xs text-muted-foreground sm:text-sm">
            Why you're not saving — which habit to fix first, and how much earlier you'll reach your goal.
          </p>
        </div>
      </div>

      {/* Leak Score hero */}
      <GlassCard className="border-brand/25">
        <div className="flex flex-col gap-6 md:flex-row md:items-start">
          <div className="flex flex-col items-center gap-3">
            <ScoreRing score={report.leakScore.score} band={report.leakScore.band} />
            <TrendPill trend={report.leakScore.trend} delta={report.leakScore.trendDelta} />
          </div>
          <div className="min-w-0 flex-1 space-y-4">
            <p className="text-sm text-muted-foreground">{report.leakScore.meaning}</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Monthly save</p>
                <p className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">{inr(totalMonthlySaving)}</p>
              </div>
              <div className="rounded-xl border border-brand/30 bg-brand/5 p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Annual save</p>
                <p className="text-lg font-semibold text-brand">{inr(totalAnnualSaving)}</p>
              </div>
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Reach goal earlier</p>
                <p className="text-lg font-semibold text-amber-600 dark:text-amber-400 tabular-nums">
                  {daysEarlier} <span className="text-sm">days</span>
                </p>
              </div>
              <div className="rounded-xl border border-border bg-secondary/40 p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Health improvement</p>
                <p className="text-lg font-semibold tabular-nums">
                  {report.timeline.current.health}
                  <span className="text-muted-foreground"> → </span>
                  <span className="text-emerald-600 dark:text-emerald-400">{report.timeline.projected.health}</span>
                </p>
              </div>
            </div>
            {topHabit && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3">
                <p className="text-[10px] uppercase tracking-wider text-destructive/80">Fix this first</p>
                <p className="text-sm">
                  <span className="font-semibold">{topHabit.emoji} {topHabit.title}</span> — recover{" "}
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">{inr(topHabit.monthlySaving)}/mo</span>{" "}
                  and reach {SMARTSAVE_GOAL.emoji} {SMARTSAVE_GOAL.name} ~{Math.max(1, Math.round(daysEarlier * (topHabit.monthlySaving / Math.max(1, totalMonthlySaving))))} days sooner.
                </p>
              </div>
            )}
          </div>
        </div>
      </GlassCard>

      {/* Pattern detection */}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <PatternTile icon={<CalendarDays className="h-4 w-4" />} label="Most expensive weekday" value={report.patterns.mostExpensiveWeekday?.day ?? "—"} sub={report.patterns.mostExpensiveWeekday ? inr(report.patterns.mostExpensiveWeekday.amount) : "Not enough data"} />
        <PatternTile icon={<Clock className="h-4 w-4" />} label="Peak shopping hour" value={report.patterns.peakShoppingHour !== null ? `${report.patterns.peakShoppingHour}:00` : "—"} sub={report.patterns.peakShoppingHour !== null && report.patterns.peakShoppingHour >= 20 ? "Late-evening impulse window" : "Daytime buys"} />
        <PatternTile icon={<Zap className="h-4 w-4" />} label="Impulse score" value={`${report.patterns.impulseScore}%`} sub={report.patterns.impulseScore >= 60 ? "High impulse pattern" : "Under control"} intense={report.patterns.impulseScore >= 60} />
        <PatternTile icon={<TrendingUp className="h-4 w-4" />} label="Lifestyle inflation" value={`${report.patterns.lifestyleInflationPct > 0 ? "+" : ""}${report.patterns.lifestyleInflationPct}%`} sub="vs previous month" intense={report.patterns.lifestyleInflationPct >= 15} />
      </div>

      {/* Prioritised habits */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Priority habits</h2>
            <p className="text-xs text-muted-foreground">AI-ranked by impact on your savings goal.</p>
          </div>
          {report.habits.length > activeHabits.length && (
            <button
              type="button"
              onClick={() => setShowIgnored((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs hover:bg-secondary"
            >
              {showIgnored ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              {showIgnored ? "Hide ignored" : `Show ignored (${report.habits.length - activeHabits.length})`}
            </button>
          )}
        </div>

        {report.habits.length === 0 ? (
          <GlassCard className="py-10 text-center">
            <ShieldCheck className="mx-auto h-8 w-8 text-emerald-500" />
            <p className="mt-3 text-sm font-medium">No behavioural leaks detected.</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Your habits look healthy. Import more transaction history for deeper analysis.
            </p>
          </GlassCard>
        ) : (
          <motion.div layout className="grid gap-3 md:grid-cols-2">
            {visibleHabits.map((h, i) => (
              <HabitCard
                key={h.id}
                habit={h}
                rank={i + 1}
                decision={decisions.get(habitKey(h.id))}
                monthlySpend={monthlySpend}
                hasChallenge={!!challengeStore[h.id]}
                onDecide={(d) => decide.mutate({ leakKey: habitKey(h.id), decision: d })}
                onChallenge={() => setChallengeFor(h)}
              />
            ))}
          </motion.div>
        )}
      </div>

      {/* Goal Impact */}
      {topHabit && (
        <GlassCard className="border-emerald-500/30">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-500/15 text-emerald-500">
              <Target className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                Goal impact
              </p>
              <p className="mt-1 text-sm">
                Fixing <span className="font-semibold">{topHabit.title}</span> alone accelerates your{" "}
                {SMARTSAVE_GOAL.emoji} {SMARTSAVE_GOAL.name} goal by ~
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  {Math.max(1, Math.round(daysEarlier * (topHabit.monthlySaving / Math.max(1, totalMonthlySaving))))} days
                </span>.
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <MiniStat label="Current goal date" value={formatDate(goalDate)} />
                <MiniStat label="Leak score" value={`${report.leakScore.score} → ${report.timeline.projected.leakScore}`} accent="emerald" />
                <MiniStat label="Financial health" value={`${report.timeline.current.health} → ${report.timeline.projected.health}`} accent="emerald" />
              </div>
            </div>
          </div>
        </GlassCard>
      )}

      {/* Timeline */}
      <GlassCard>
        <div className="mb-3 flex items-center gap-2">
          <Rocket className="h-4 w-4 text-brand" />
          <p className="text-sm font-semibold">Monthly improvement timeline</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <TimelineBlock label="Last month" data={report.timeline.last} />
          <TimelineBlock label="This month" data={report.timeline.current} highlight />
          <TimelineBlock label="If you fix top 3" data={report.timeline.projected} accent />
        </div>
      </GlassCard>

      {/* Hidden AI Discoveries */}
      {report.discoveries.length > 0 && (
        <GlassCard className="border-fuchsia-500/25">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-fuchsia-500" />
            <p className="text-sm font-semibold">Hidden AI discoveries</p>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            {report.discoveries.map((d) => (
              <div
                key={d.id}
                className={cn(
                  "rounded-lg border p-3 text-xs",
                  d.tone === "danger"
                    ? "border-destructive/30 bg-destructive/5"
                    : d.tone === "warn"
                      ? "border-amber-500/30 bg-amber-500/5"
                      : "border-brand/25 bg-brand/5",
                )}
              >
                <p className="text-sm font-semibold">{d.title}</p>
                <p className="mt-0.5 text-muted-foreground">{d.detail}</p>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {/* What happens if you ignore this */}
      {topHabit && (
        <GlassCard className="border-destructive/30 bg-destructive/5">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-destructive/15 text-destructive">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-destructive">What if you ignore this?</p>
              <p className="mt-1 text-sm">
                Continuing at this pace delays {SMARTSAVE_GOAL.name} by ~<span className="font-semibold">{daysEarlier} days</span>,
                nudges your leak score{" "}
                <span className="font-semibold tabular-nums">
                  {report.leakScore.score} → {Math.max(0, report.leakScore.score - 8)}
                </span>{" "}
                and wastes ~<span className="font-semibold">{inr(totalAnnualSaving)}</span> over the next year.
              </p>
            </div>
          </div>
        </GlassCard>
      )}

      {/* Gamification */}
      <GlassCard>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-amber-500" />
            <p className="text-sm font-semibold">Your leak hunter badges</p>
          </div>
          <p className="text-[11px] text-muted-foreground tabular-nums">
            {activeChallenges} active challenge{activeChallenges === 1 ? "" : "s"}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {badges.map((b) => (
            <div
              key={b.id}
              className={cn(
                "flex flex-col items-center gap-1 rounded-xl border p-3 text-center text-[11px]",
                b.earned
                  ? b.tier === "gold"
                    ? "border-amber-500/50 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                    : b.tier === "silver"
                      ? "border-slate-400/50 bg-slate-400/10"
                      : "border-orange-600/40 bg-orange-600/10 text-orange-700 dark:text-orange-400"
                  : "border-border bg-secondary/30 text-muted-foreground opacity-60",
              )}
              title={b.hint}
            >
              <Award className="h-6 w-6" />
              <p className="font-semibold">{b.label}</p>
              <p className="text-[10px] capitalize">{b.tier}</p>
            </div>
          ))}
        </div>
      </GlassCard>

      <AnimatePresence>
        {challengeFor && <ChallengePanel habit={challengeFor} onClose={() => setChallengeFor(null)} />}
      </AnimatePresence>
    </div>
  );
}

function PatternTile({
  icon,
  label,
  value,
  sub,
  intense,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  intense?: boolean;
}) {
  return (
    <GlassCard className={cn("h-full", intense && "border-amber-500/40 bg-amber-500/5")}>
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
        <span className={cn("grid h-6 w-6 place-items-center rounded-md bg-secondary", intense && "bg-amber-500/15 text-amber-600 dark:text-amber-400")}>
          {icon}
        </span>
        {label}
      </div>
      <p className="mt-2 text-xl font-semibold tabular-nums">{value}</p>
      <p className="text-[11px] text-muted-foreground">{sub}</p>
    </GlassCard>
  );
}

function MiniStat({ label, value, accent }: { label: string; value: string; accent?: "emerald" }) {
  return (
    <div className="rounded-lg border border-border bg-secondary/40 p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-sm font-semibold tabular-nums", accent === "emerald" && "text-emerald-600 dark:text-emerald-400")}>
        {value}
      </p>
    </div>
  );
}

function TimelineBlock({
  label,
  data,
  highlight,
  accent,
}: {
  label: string;
  data: { leakScore: number; health: number; saving: number };
  highlight?: boolean;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border p-3",
        highlight ? "border-brand/40 bg-brand/5" : accent ? "border-emerald-500/40 bg-emerald-500/5" : "border-border bg-secondary/30",
      )}
    >
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <div className="mt-2 space-y-1 text-xs">
        <p className="flex items-center justify-between">
          <span className="text-muted-foreground">Leak score</span>
          <span className="font-semibold tabular-nums">{data.leakScore}</span>
        </p>
        <p className="flex items-center justify-between">
          <span className="text-muted-foreground">Health</span>
          <span className="font-semibold tabular-nums">{data.health}</span>
        </p>
        <p className="flex items-center justify-between">
          <span className="text-muted-foreground">Recoverable</span>
          <span className="font-semibold tabular-nums">{inr(data.saving)}</span>
        </p>
      </div>
    </div>
  );
}
