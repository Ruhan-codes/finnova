import { AnimatePresence, motion, useMotionValue, useTransform, animate } from "framer-motion";
import {
  X, Sparkles, TrendingUp, TrendingDown, Calendar, CreditCard,
  CheckCircle2, AlertCircle, BellRing, Wallet, EyeOff, Star, Info,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { inr, fullDate } from "@/lib/finance/format";
import {
  detectSubscriptions, summarizeSubscriptions, subscriptionInsights,
  type SubscriptionDetail,
} from "@/lib/finance/subscriptions";
import type { Transaction } from "@/lib/finance/types";

type Tag = "essential" | "non-essential" | "ignored";
type Prefs = Record<string, { tag?: Tag; reminder?: boolean; budgeted?: boolean }>;

const PREF_KEY = "fg.subscription.prefs.v1";

function loadPrefs(): Prefs {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(PREF_KEY) ?? "{}"); } catch { return {}; }
}
function savePrefs(p: Prefs) {
  try { localStorage.setItem(PREF_KEY, JSON.stringify(p)); } catch { /* noop */ }
}

// Simple emoji/letter avatar with brand-ish tint
function MerchantIcon({ name }: { name: string }) {
  const key = name.toLowerCase();
  const emoji =
    key.includes("netflix") ? "🎬"
    : key.includes("spotify") ? "🎧"
    : key.includes("prime") || key.includes("amazon") ? "📦"
    : key.includes("hotstar") || key.includes("sony") || key.includes("zee5") ? "📺"
    : key.includes("youtube") ? "▶️"
    : key.includes("jio") || key.includes("airtel") || key.includes("vi ") || key.includes("vodafone") ? "📶"
    : key.includes("act ") || key.includes("fibernet") ? "🌐"
    : key.includes("gym") || key.includes("cult") ? "🏋️"
    : key.includes("apple") || key.includes("icloud") ? "☁️"
    : key.includes("google") ? "🟦"
    : key.includes("swiggy") ? "🍱"
    : key.includes("zomato") ? "🍽️"
    : key.includes("notion") ? "📝"
    : key.includes("chatgpt") || key.includes("openai") ? "🤖"
    : key.includes("adobe") ? "🎨"
    : key.includes("figma") ? "🎯"
    : key.includes("microsoft") ? "🪟"
    : key.includes("audible") || key.includes("kindle") ? "📚"
    : "";
  return (
    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand/15 to-brand/5 text-lg font-semibold text-brand ring-1 ring-brand/10">
      {emoji || name.charAt(0).toUpperCase()}
    </div>
  );
}

function Counter({ value, format = (v: number) => Math.round(v).toString(), delay = 0 }: {
  value: number; format?: (v: number) => string; delay?: number;
}) {
  const mv = useMotionValue(0);
  const rounded = useTransform(mv, (v) => format(v));
  const [display, setDisplay] = useState(format(0));
  useEffect(() => {
    const controls = animate(mv, value, { duration: 1.1, delay, ease: [0.22, 1, 0.36, 1] });
    const unsub = rounded.on("change", setDisplay);
    return () => { controls.stop(); unsub(); };
  }, [value, mv, rounded, delay]);
  return <span>{display}</span>;
}

export function SubscriptionIntelligenceModal({
  open, onClose, transactions,
}: { open: boolean; onClose: () => void; transactions: Transaction[] }) {
  const [prefs, setPrefs] = useState<Prefs>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "essential" | "non-essential">("all");

  useEffect(() => { if (open) setPrefs(loadPrefs()); }, [open]);

  const subs = useMemo(() => detectSubscriptions(transactions), [transactions]);
  const summary = useMemo(() => summarizeSubscriptions(subs), [subs]);
  const filtered = useMemo(() => {
    if (filter === "all") return subs;
    return subs.filter((s) => (prefs[s.merchant]?.tag ?? (filter === "essential" ? "essential" : "non-essential")) === filter);
  }, [subs, filter, prefs]);

  const updatePref = (merchant: string, patch: Partial<Prefs[string]>) => {
    setPrefs((prev) => {
      const next = { ...prev, [merchant]: { ...prev[merchant], ...patch } };
      savePrefs(next);
      return next;
    });
  };

  // Escape to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = ""; window.removeEventListener("keydown", onKey); };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-6"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        >
          <motion.div
            className="absolute inset-0 bg-background/70 backdrop-blur-md"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog" aria-modal="true" aria-label="Subscription Intelligence"
            className="relative flex h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-t-3xl border bg-card shadow-2xl sm:h-[86vh] sm:rounded-3xl"
            initial={{ y: 40, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 40, opacity: 0, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 260, damping: 28 }}
          >
            <Header count={summary.count} onClose={onClose} />

            <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
              {subs.length === 0 ? (
                <EmptyState />
              ) : (
                <>
                  <AiRecommendation summary={summary} />

                  <div className="mt-6 flex flex-wrap items-center gap-2">
                    {(["all", "essential", "non-essential"] as const).map((f) => (
                      <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                          filter === f
                            ? "border-brand bg-brand text-white shadow-sm"
                            : "border-border bg-secondary/40 text-muted-foreground hover:bg-secondary"
                        }`}
                      >
                        {f === "all" ? "All" : f === "essential" ? "Essential" : "Non-essential"}
                      </button>
                    ))}
                    <span className="ml-auto text-xs text-muted-foreground">{filtered.length} of {subs.length}</span>
                  </div>

                  <ul className="mt-4 space-y-3">
                    {filtered.map((s, i) => (
                      <SubscriptionRow
                        key={s.merchant}
                        s={s}
                        index={i}
                        expanded={expanded === s.merchant}
                        onToggle={() => setExpanded((v) => v === s.merchant ? null : s.merchant)}
                        pref={prefs[s.merchant] ?? {}}
                        onPref={(patch) => updatePref(s.merchant, patch)}
                      />
                    ))}
                  </ul>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Header({ count, onClose }: { count: number; onClose: () => void }) {
  return (
    <div className="relative flex items-center gap-3 border-b bg-gradient-to-br from-brand/8 via-transparent to-transparent px-5 py-4 sm:px-6">
      <div className="grid h-10 w-10 place-items-center rounded-xl gradient-brand text-white shadow-md">
        <Sparkles className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <h2 className="truncate text-base font-semibold sm:text-lg">Subscription Intelligence</h2>
        <p className="text-xs text-muted-foreground">
          {count} recurring payment{count === 1 ? "" : "s"} detected from your transaction history
        </p>
      </div>
      <button
        onClick={onClose}
        aria-label="Close"
        className="grid h-9 w-9 place-items-center rounded-full border bg-background/70 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function AiRecommendation({ summary }: { summary: ReturnType<typeof summarizeSubscriptions> }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
      className="overflow-hidden rounded-2xl border bg-gradient-to-br from-brand/8 via-background to-background p-5"
    >
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-brand" />
        <p className="text-xs font-semibold uppercase tracking-wider text-brand">AI Recommendation</p>
      </div>
      <p className="text-sm leading-relaxed text-foreground/90">
        You have <b>{summary.count}</b> active subscription{summary.count === 1 ? "" : "s"} costing{" "}
        <b><Counter value={summary.monthlyTotal} format={(v) => inr(v)} /></b>/month.
        Entertainment accounts for <b>{summary.entertainmentShare}%</b> of your recurring spend.
        {summary.potentialSavings > 0 && (
          <> Cancelling optional plans could save up to <b>{inr(summary.potentialSavings)}</b>/year.</>
        )}
      </p>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <MetricTile label="Monthly" value={summary.monthlyTotal} delay={0.05} />
        <MetricTile label="Annual" value={summary.annualTotal} delay={0.15} />
        <MetricTile label="Potential Savings" value={summary.potentialSavings} delay={0.25} tone="success" />
      </div>
    </motion.div>
  );
}

function MetricTile({ label, value, delay = 0, tone }: { label: string; value: number; delay?: number; tone?: "success" }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: 0.35 }}
      className="rounded-xl border bg-card/60 p-3"
    >
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-1 text-lg font-semibold tabular-nums ${tone === "success" ? "text-success" : ""}`}>
        <Counter value={value} format={(v) => inr(v)} delay={delay} />
      </p>
    </motion.div>
  );
}

function SubscriptionRow({
  s, index, expanded, onToggle, pref, onPref,
}: {
  s: SubscriptionDetail; index: number; expanded: boolean; onToggle: () => void;
  pref: Prefs[string]; onPref: (patch: Partial<Prefs[string]>) => void;
}) {
  const insights = useMemo(() => subscriptionInsights(s), [s]);
  const tag = pref.tag;

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.4), type: "spring", stiffness: 260, damping: 26 }}
      className="overflow-hidden rounded-2xl border bg-card transition hover:shadow-md"
    >
      <button onClick={onToggle} className="flex w-full items-center gap-3 px-4 py-3.5 text-left">
        <MerchantIcon name={s.merchant} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold">{s.merchant}</p>
            {tag === "essential" && <span className="rounded-full bg-success/15 px-1.5 py-0.5 text-[10px] font-medium text-success">Essential</span>}
            {tag === "non-essential" && <span className="rounded-full bg-warning/15 px-1.5 py-0.5 text-[10px] font-medium text-warning">Optional</span>}
            {tag === "ignored" && <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">Ignored</span>}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {s.frequency} · {s.count} payments · next {fullDate(s.nextExpected)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold tabular-nums">{inr(s.monthlyAmount)}<span className="text-[10px] font-normal text-muted-foreground">/mo</span></p>
          <p className="text-[11px] text-muted-foreground">{inr(s.annualCost)}/yr</p>
        </div>
        <ConfidenceDot confidence={s.confidence} />
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="details"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 220, damping: 30 }}
            className="border-t bg-secondary/30"
          >
            <div className="grid gap-4 px-4 py-4 sm:grid-cols-2">
              <DetailGrid s={s} />
              <div>
                <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-brand">
                  <Sparkles className="h-3.5 w-3.5" /> AI Insights
                </p>
                <ul className="space-y-1.5">
                  {insights.map((n, i) => (
                    <motion.li
                      key={i}
                      initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                      className="flex items-start gap-2 text-xs text-foreground/80"
                    >
                      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand/70" />
                      <span>{n}</span>
                    </motion.li>
                  ))}
                </ul>
                <p className="mt-3 text-[11px] text-muted-foreground">
                  <b>Why flagged:</b> {s.reason}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 border-t bg-background/60 px-4 py-3">
              <ActionChip icon={<Star className="h-3.5 w-3.5" />} active={tag === "essential"}
                onClick={() => onPref({ tag: tag === "essential" ? undefined : "essential" })}>Essential</ActionChip>
              <ActionChip icon={<AlertCircle className="h-3.5 w-3.5" />} active={tag === "non-essential"}
                onClick={() => onPref({ tag: tag === "non-essential" ? undefined : "non-essential" })}>Non-essential</ActionChip>
              <ActionChip icon={<BellRing className="h-3.5 w-3.5" />} active={!!pref.reminder}
                onClick={() => onPref({ reminder: !pref.reminder })}>{pref.reminder ? "Reminder On" : "Add Reminder"}</ActionChip>
              <ActionChip icon={<Wallet className="h-3.5 w-3.5" />} active={!!pref.budgeted}
                onClick={() => onPref({ budgeted: !pref.budgeted })}>{pref.budgeted ? "In Budget" : "Add to Budget"}</ActionChip>
              <ActionChip icon={<EyeOff className="h-3.5 w-3.5" />} active={tag === "ignored"}
                onClick={() => onPref({ tag: tag === "ignored" ? undefined : "ignored" })}>Ignore</ActionChip>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  );
}

function ConfidenceDot({ confidence }: { confidence: number }) {
  const tone = confidence >= 80 ? "text-success" : confidence >= 60 ? "text-brand" : "text-warning";
  return (
    <div className={`ml-2 hidden flex-col items-end sm:flex ${tone}`} title={`Confidence ${confidence}%`}>
      <div className="text-[10px] font-medium uppercase tracking-wide">Match</div>
      <div className="text-sm font-semibold tabular-nums">{confidence}%</div>
    </div>
  );
}

function DetailGrid({ s }: { s: SubscriptionDetail }) {
  const items = [
    { icon: <TrendingUp className="h-3.5 w-3.5" />, label: "First charged", value: fullDate(s.firstDate) },
    { icon: <TrendingDown className="h-3.5 w-3.5" />, label: "Last charged", value: fullDate(s.lastDate) },
    { icon: <Calendar className="h-3.5 w-3.5" />, label: "Next expected", value: fullDate(s.nextExpected) },
    { icon: <CheckCircle2 className="h-3.5 w-3.5" />, label: "Payments detected", value: `${s.count} total` },
    { icon: <CreditCard className="h-3.5 w-3.5" />, label: "Payment method", value: s.paymentMethod },
    { icon: <Info className="h-3.5 w-3.5" />, label: "Frequency", value: s.frequency },
  ];
  return (
    <div className="grid grid-cols-2 gap-2">
      {items.map((it) => (
        <div key={it.label} className="rounded-lg border bg-card/60 p-2.5">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
            {it.icon}{it.label}
          </div>
          <p className="mt-1 text-xs font-medium">{it.value}</p>
        </div>
      ))}
    </div>
  );
}

function ActionChip({ children, icon, active, onClick }: {
  children: React.ReactNode; icon: React.ReactNode; active?: boolean; onClick: () => void;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
        active
          ? "border-brand bg-brand text-white shadow-sm"
          : "border-border bg-secondary/40 text-muted-foreground hover:bg-secondary hover:text-foreground"
      }`}
    >
      {icon}{children}
    </motion.button>
  );
}

function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="grid place-items-center rounded-2xl border border-dashed py-14 text-center"
    >
      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-brand/10 text-brand">
        <Sparkles className="h-6 w-6" />
      </div>
      <h3 className="mt-4 text-base font-semibold">No subscriptions detected yet</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        Once a merchant charges you a similar amount at least 2–3 times, our AI will surface it here with
        renewal dates, annual cost, and cancel-worthiness score.
      </p>
    </motion.div>
  );
}
