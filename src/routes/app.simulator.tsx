import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  ArrowRight,
  BadgeCheck,
  Brain,
  Calendar,
  ChevronRight,
  CircleDollarSign,
  Gauge,
  LineChart,
  RefreshCw,
  RotateCcw,
  Send,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  Wallet,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GlassCard } from "@/components/finance/GlassCard";
import { simulateFuture, type SimulationResult } from "@/lib/ai/simulator.functions";
import { inr } from "@/lib/finance/format";
import { buildFinanceSummary, summaryToPrompt } from "@/lib/finance/summary";
import { useTransactions } from "@/lib/finance/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/simulator")({
  head: () => ({
    meta: [
      { title: "Future Simulator — FinGuard AI" },
      {
        name: "description",
        content:
          "Predict your financial future before you make a decision. Compare scenarios, see before-vs-after metrics, and get a personalised AI verdict from your own transactions.",
      },
      { property: "og:title", content: "Future Simulator — FinGuard AI" },
      {
        property: "og:description",
        content: "An AI-powered financial prediction engine that simulates any decision using your own data.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SimulatorPage,
});

const EXAMPLES = [
  "Buy an iPhone worth ₹1,50,000",
  "Take a ₹10 lakh car loan for 5 years",
  "Invest ₹15,000 every month",
  "Move to Bangalore next year",
  "Plan a Europe trip worth ₹4 lakh",
  "Quit my job for 6 months",
  "Save ₹25 lakh in 5 years",
  "Increase salary to ₹90,000",
];

const STAGES = [
  "Reading your transactions…",
  "Detecting recurring commitments…",
  "Modelling monthly cash flow…",
  "Projecting savings trajectory…",
  "Comparing alternative futures…",
  "Scoring risk & confidence…",
];

const VERDICT_META: Record<
  string,
  { label: string; tone: string; ring: string; icon: typeof BadgeCheck }
> = {
  excellent: { label: "Excellent Decision", tone: "text-emerald-600 dark:text-emerald-400", ring: "ring-emerald-500/30 bg-emerald-500/5", icon: BadgeCheck },
  safe: { label: "Safe", tone: "text-emerald-600 dark:text-emerald-400", ring: "ring-emerald-500/30 bg-emerald-500/5", icon: ShieldCheck },
  manageable: { label: "Manageable", tone: "text-amber-600 dark:text-amber-400", ring: "ring-amber-500/30 bg-amber-500/5", icon: Gauge },
  risky: { label: "Risky", tone: "text-orange-600 dark:text-orange-400", ring: "ring-orange-500/30 bg-orange-500/5", icon: TriangleAlert },
  not_recommended: { label: "Not Recommended", tone: "text-rose-600 dark:text-rose-400", ring: "ring-rose-500/30 bg-rose-500/5", icon: TriangleAlert },
};

function verdictMeta(v?: string) {
  return VERDICT_META[v ?? ""] ?? VERDICT_META.manageable;
}

type Phase = "idle" | "clarify" | "running" | "result" | "error";

function formatMetric(key: string, n: number): string {
  if (["healthScore", "leakScore", "savingsRatePct"].includes(key)) return `${Math.round(n)}${key === "savingsRatePct" ? "%" : ""}`;
  if (key === "emergencyFundMonths") return `${n.toFixed(1)} mo`;
  return inr(Math.round(n));
}

const METRIC_META: Record<string, { label: string; icon: typeof Gauge; higherIsBetter: boolean }> = {
  healthScore: { label: "Financial Health", icon: Activity, higherIsBetter: true },
  emergencyFundMonths: { label: "Emergency Fund", icon: ShieldCheck, higherIsBetter: true },
  monthlySavings: { label: "Monthly Savings", icon: Wallet, higherIsBetter: true },
  savingsRatePct: { label: "Savings Rate", icon: LineChart, higherIsBetter: true },
  netWorth1Y: { label: "Net Worth (1Y)", icon: CircleDollarSign, higherIsBetter: true },
  leakScore: { label: "Money Leak Score", icon: Zap, higherIsBetter: true },
};

function SimulationRunning({ stageIdx }: { stageIdx: number }) {
  return (
    <GlassCard className="flex flex-col items-center justify-center gap-5 py-16 text-center">
      <div className="relative">
        <motion.div
          className="grid h-20 w-20 place-items-center rounded-3xl gradient-brand text-white"
          animate={{ scale: [1, 1.08, 1] }}
          transition={{ duration: 1.6, repeat: Infinity }}
        >
          <Brain className="h-9 w-9" />
        </motion.div>
        <motion.span
          className="absolute inset-0 rounded-3xl ring-2 ring-brand/40"
          animate={{ scale: [1, 1.4], opacity: [0.5, 0] }}
          transition={{ duration: 1.6, repeat: Infinity }}
        />
      </div>
      <div>
        <h3 className="text-lg font-semibold">Running Financial Simulation</h3>
        <p className="text-sm text-muted-foreground">Your future is being modelled from your own data.</p>
      </div>
      <ul className="w-full max-w-sm space-y-1.5 text-left text-sm">
        {STAGES.map((s, i) => (
          <li key={s} className={cn("flex items-center gap-2 transition-colors", i <= stageIdx ? "text-foreground" : "text-muted-foreground/50")}>
            <span
              className={cn(
                "grid h-4 w-4 place-items-center rounded-full text-[10px]",
                i < stageIdx ? "bg-emerald-500 text-white" : i === stageIdx ? "bg-brand text-white" : "bg-secondary",
              )}
            >
              {i < stageIdx ? "✓" : ""}
            </span>
            {s}
          </li>
        ))}
      </ul>
    </GlassCard>
  );
}

function ScoreDelta({ before, after, keyName }: { before: number; after: number; keyName: string }) {
  const meta = METRIC_META[keyName];
  const Icon = meta?.icon ?? Gauge;
  const delta = after - before;
  const positive = meta?.higherIsBetter ? delta >= 0 : delta <= 0;
  return (
    <GlassCard className="p-4">
      <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {meta?.label ?? keyName}
      </div>
      <div className="flex items-baseline justify-between gap-2">
        <div className="text-xs text-muted-foreground">{formatMetric(keyName, before)}</div>
        <ArrowRight className="h-3 w-3 text-muted-foreground" />
        <div className="text-lg font-semibold tabular-nums">{formatMetric(keyName, after)}</div>
      </div>
      <div className={cn("mt-1 text-[11px] font-medium", positive ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
        {delta > 0 ? "+" : ""}
        {formatMetric(keyName, delta)}
      </div>
    </GlassCard>
  );
}

function VerdictHero({ result }: { result: SimulationResult }) {
  const v = verdictMeta(result.verdict);
  const Icon = v.icon;
  const conf = Math.round(result.confidence ?? 0);
  return (
    <GlassCard className={cn("relative overflow-hidden p-6 ring-1", v.ring)}>
      <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-brand/10 blur-3xl" />
      <div className="relative flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-4">
          <div className={cn("grid h-12 w-12 place-items-center rounded-2xl bg-background/60 ring-1", v.ring)}>
            <Icon className={cn("h-6 w-6", v.tone)} />
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Verdict</div>
            <h2 className={cn("text-2xl font-semibold", v.tone)}>{v.label}</h2>
            <p className="mt-1 max-w-xl text-sm leading-relaxed">{result.directAnswer}</p>
          </div>
        </div>
        <div className="min-w-[140px] rounded-2xl border bg-background/60 p-3 text-center">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">AI Confidence</div>
          <div className="text-2xl font-semibold tabular-nums">{conf}%</div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
            <motion.div className="h-full bg-brand" initial={{ width: 0 }} animate={{ width: `${conf}%` }} transition={{ duration: 0.8 }} />
          </div>
          {result.confidenceReason && <div className="mt-2 text-[10px] leading-tight text-muted-foreground">{result.confidenceReason}</div>}
        </div>
      </div>
    </GlassCard>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon: typeof Sparkles; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {title}
      </h3>
      {children}
    </div>
  );
}

function BulletList({ items }: { items?: string[] }) {
  if (!items?.length) return null;
  return (
    <ul className="space-y-1.5 text-sm">
      {items.map((it, i) => (
        <li key={i} className="flex gap-2">
          <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-brand" />
          <span className="leading-relaxed">{it}</span>
        </li>
      ))}
    </ul>
  );
}

function TimelineStrip({ nodes }: { nodes: NonNullable<SimulationResult["timeline"]> }) {
  if (!nodes?.length) return null;
  return (
    <div className="relative">
      <div className="absolute left-4 top-4 right-4 h-px bg-border md:left-6 md:right-6" />
      <div className="relative grid gap-4 md:grid-cols-7">
        {nodes.map((n, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="relative flex flex-col items-center text-center"
          >
            <div
              className={cn(
                "grid h-8 w-8 place-items-center rounded-full border-2 bg-background text-[10px] font-semibold",
                n.highlight ? "border-brand text-brand" : "border-border text-muted-foreground",
              )}
            >
              {i + 1}
            </div>
            <div className="mt-2 text-xs font-semibold">{n.label}</div>
            <div className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{n.note}</div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function ScenarioCompare({ scenarios }: { scenarios: NonNullable<SimulationResult["scenarios"]> }) {
  if (!scenarios?.length) return null;
  return (
    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
      {scenarios.map((s, i) => {
        const v = verdictMeta(s.verdict);
        return (
          <div
            key={i}
            className={cn(
              "rounded-2xl border p-4 transition-all",
              s.recommended ? "border-brand bg-brand/5 shadow-sm" : "bg-card",
            )}
          >
            <div className="mb-2 flex items-center justify-between">
              <div className="text-sm font-semibold">{s.name}</div>
              {s.recommended && (
                <span className="rounded-full bg-brand px-2 py-0.5 text-[10px] font-semibold text-brand-foreground">
                  Best
                </span>
              )}
            </div>
            <div className={cn("mb-2 text-xs font-medium", v.tone)}>{v.label}</div>
            <p className="text-xs leading-relaxed text-muted-foreground">{s.oneLine}</p>
            {typeof s.monthlyImpact === "number" && s.monthlyImpact !== 0 && (
              <div className="mt-2 text-[11px] tabular-nums text-muted-foreground">
                Monthly impact: <span className={cn("font-semibold", s.monthlyImpact >= 0 ? "text-emerald-600" : "text-rose-600")}>{s.monthlyImpact >= 0 ? "+" : ""}{inr(s.monthlyImpact)}</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ControlPanel({
  controls,
  values,
  onChange,
  disabled,
}: {
  controls: NonNullable<SimulationResult["controls"]>;
  values: Record<string, number>;
  onChange: (k: string, v: number) => void;
  disabled: boolean;
}) {
  if (!controls?.length) return null;
  return (
    <div className="space-y-4">
      {controls.map((c) => {
        const cur = values[c.key] ?? c.value;
        return (
          <div key={c.key}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="font-medium">{c.label}</span>
              <span className="tabular-nums text-muted-foreground">
                {c.unit === "₹" ? inr(cur) : `${cur}${c.unit ? ` ${c.unit}` : ""}`}
              </span>
            </div>
            <input
              type="range"
              min={c.min}
              max={c.max}
              step={c.step}
              value={cur}
              disabled={disabled}
              onChange={(e) => onChange(c.key, Number(e.target.value))}
              className="w-full accent-brand"
            />
          </div>
        );
      })}
    </div>
  );
}

function SimulatorPage() {
  const txs = useTransactions();
  const runSim = useServerFn(simulateFuture);

  const [phase, setPhase] = useState<Phase>("idle");
  const [scenario, setScenario] = useState("");
  const [stageIdx, setStageIdx] = useState(0);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [clarifications, setClarifications] = useState<{ question: string; answer: string }[]>([]);
  const [pendingAnswers, setPendingAnswers] = useState<Record<string, string>>({});
  const [assumptions, setAssumptions] = useState<Record<string, number>>({});
  const [rerunning, setRerunning] = useState(false);
  const rerunTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const financeContext = useMemo(() => summaryToPrompt(buildFinanceSummary(txs)), [txs]);

  const run = useCallback(
    async (opts: {
      scenarioText: string;
      clarify: { question: string; answer: string }[];
      overrides: Record<string, number>;
      silent?: boolean;
    }) => {
      if (!opts.silent) {
        setPhase("running");
        setStageIdx(0);
        setError(null);
      } else {
        setRerunning(true);
      }
      const interval = setInterval(() => setStageIdx((s) => Math.min(STAGES.length - 1, s + 1)), 700);
      try {
        const json = (await runSim({
          data: {
            scenario: opts.scenarioText,
            financeContext,
            clarifications: opts.clarify,
            assumptions: opts.overrides,
          },
        })) as SimulationResult;
        clearInterval(interval);
        setResult(json);
        if (json.needsMoreInfo) {
          setPhase("clarify");
        } else {
          setPhase("result");
          const initial: Record<string, number> = {};
          for (const c of json.controls ?? []) initial[c.key] = c.value;
          if (!opts.silent) setAssumptions(initial);
        }
      } catch (e) {
        clearInterval(interval);
        setError(e instanceof Error ? e.message : "Something went wrong.");
        setPhase("error");
      } finally {
        setRerunning(false);
      }
    },
    [financeContext, runSim],
  );

  const start = (text: string) => {
    const q = text.trim();
    if (!q) return;
    setScenario(q);
    setClarifications([]);
    setPendingAnswers({});
    setAssumptions({});
    setResult(null);
    void run({ scenarioText: q, clarify: [], overrides: {} });
  };

  const submitClarifications = () => {
    const qs = result?.followUpQuestions ?? [];
    const merged = [
      ...clarifications,
      ...qs.map((q) => ({ question: q, answer: (pendingAnswers[q] ?? "").trim() })).filter((c) => c.answer),
    ];
    setClarifications(merged);
    setPendingAnswers({});
    void run({ scenarioText: scenario, clarify: merged, overrides: assumptions });
  };

  const handleAssumption = (k: string, v: number) => {
    const next = { ...assumptions, [k]: v };
    setAssumptions(next);
    if (rerunTimer.current) clearTimeout(rerunTimer.current);
    rerunTimer.current = setTimeout(() => {
      void run({ scenarioText: scenario, clarify: clarifications, overrides: next, silent: true });
    }, 600);
  };

  const reset = () => {
    setPhase("idle");
    setScenario("");
    setResult(null);
    setClarifications([]);
    setPendingAnswers({});
    setAssumptions({});
    setError(null);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl gradient-brand text-white">
            <Brain className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Future Simulator</h1>
            <p className="text-sm text-muted-foreground">
              AI prediction engine · modelling your future from {txs.length} transactions
            </p>
          </div>
        </div>
        {phase !== "idle" && (
          <button
            onClick={reset}
            className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-xs text-muted-foreground hover:bg-secondary"
          >
            <RotateCcw className="h-3.5 w-3.5" /> New simulation
          </button>
        )}
      </div>

      {phase === "idle" && (
        <GlassCard className="p-6">
          <div className="mx-auto max-w-2xl text-center">
            <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-brand">
              <Sparkles className="h-3 w-3" /> Predict any financial decision
            </div>
            <h2 className="text-2xl font-semibold">If I do this, what happens to my future?</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Describe any decision — a purchase, a loan, a job change, a goal. The simulator projects it against your real
              cash flow and returns a verdict, before-vs-after metrics, an interactive timeline, and better alternatives.
            </p>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              start(scenario);
            }}
            className="mx-auto mt-6 flex max-w-2xl items-center gap-2"
          >
            <textarea
              value={scenario}
              onChange={(e) => setScenario(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  start(scenario);
                }
              }}
              rows={1}
              placeholder="e.g. Can I buy an iPhone worth ₹1,50,000?"
              className="flex-1 resize-none rounded-2xl border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand/40"
            />
            <button
              type="submit"
              disabled={!scenario.trim()}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full gradient-brand text-white disabled:opacity-50"
              aria-label="Simulate"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
          <div className="mx-auto mt-4 flex max-w-2xl flex-wrap justify-center gap-2">
            {EXAMPLES.map((q) => (
              <button
                key={q}
                onClick={() => start(q)}
                className="rounded-full border bg-card px-3 py-1.5 text-xs hover:bg-secondary"
              >
                {q}
              </button>
            ))}
          </div>
        </GlassCard>
      )}

      {phase === "running" && <SimulationRunning stageIdx={stageIdx} />}

      {phase === "clarify" && result && (
        <GlassCard className="p-6">
          <div className="mb-4 flex items-center gap-2 text-sm">
            <Sparkles className="h-4 w-4 text-brand" />
            <span className="font-medium">A few quick details to sharpen the prediction:</span>
          </div>
          <div className="space-y-3">
            {(result.followUpQuestions ?? []).map((q) => (
              <div key={q}>
                <label className="mb-1 block text-xs font-medium">{q}</label>
                <input
                  value={pendingAnswers[q] ?? ""}
                  onChange={(e) => setPendingAnswers((s) => ({ ...s, [q]: e.target.value }))}
                  className="w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand/40"
                  placeholder="Your answer…"
                />
              </div>
            ))}
          </div>
          <div className="mt-4 flex justify-end">
            <button
              onClick={submitClarifications}
              className="inline-flex items-center gap-1.5 rounded-full gradient-brand px-4 py-2 text-xs font-semibold text-white"
            >
              Run simulation <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </GlassCard>
      )}

      {phase === "error" && (
        <GlassCard className="p-6 text-center">
          <TriangleAlert className="mx-auto mb-3 h-8 w-8 text-rose-500" />
          <div className="text-sm">{error}</div>
          <button
            onClick={() => start(scenario)}
            className="mt-4 inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-xs hover:bg-secondary"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Try again
          </button>
        </GlassCard>
      )}

      <AnimatePresence>
        {phase === "result" && result && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
            <div className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Scenario:</span> {result.parsed?.label ?? scenario}
              {rerunning && <span className="ml-2 inline-flex items-center gap-1 text-brand"><RefreshCw className="h-3 w-3 animate-spin" /> Re-simulating…</span>}
            </div>

            <VerdictHero result={result} />

            <div className="grid gap-5 lg:grid-cols-3">
              <GlassCard className="p-5 lg:col-span-2">
                <div className="space-y-4">
                  <Section title="Why" icon={Sparkles}>
                    <BulletList items={result.why} />
                  </Section>
                  <Section title="Financial Impact" icon={CircleDollarSign}>
                    <BulletList items={result.financialImpact} />
                  </Section>
                  <Section title="Best Recommendation" icon={BadgeCheck}>
                    <BulletList items={result.recommendation} />
                  </Section>
                </div>
              </GlassCard>

              <GlassCard className="p-5">
                <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <Gauge className="h-3.5 w-3.5" /> Adjust assumptions
                </h3>
                <ControlPanel
                  controls={result.controls ?? []}
                  values={assumptions}
                  onChange={handleAssumption}
                  disabled={rerunning}
                />
                {!result.controls?.length && (
                  <p className="text-xs text-muted-foreground">No live levers for this scenario.</p>
                )}
              </GlassCard>
            </div>

            {result.metrics && (
              <div>
                <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <LineChart className="h-3.5 w-3.5" /> Before vs After
                </h3>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {Object.entries(result.metrics).map(([k, v]) => (
                    <ScoreDelta key={k} keyName={k} before={v.before} after={v.after} />
                  ))}
                </div>
              </div>
            )}

            {result.timeline?.length ? (
              <GlassCard className="p-5">
                <h3 className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5" /> Interactive Timeline
                </h3>
                <TimelineStrip nodes={result.timeline} />
              </GlassCard>
            ) : null}

            {result.scenarios?.length ? (
              <div>
                <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <Sparkles className="h-3.5 w-3.5" /> Alternative Futures
                </h3>
                <ScenarioCompare scenarios={result.scenarios} />
              </div>
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
