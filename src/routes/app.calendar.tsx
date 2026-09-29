import { createFileRoute } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronLeft, ChevronRight, X, Sparkles, TrendingUp, TrendingDown,
  AlertTriangle, Upload, ShieldCheck, Activity, PiggyBank, CalendarX,
  Clock, ShieldAlert, ArrowRight,
} from "lucide-react";
import { useMemo, useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { GlassCard } from "@/components/finance/GlassCard";
import { UploadDialog } from "@/components/finance/UploadDialog";
import { useTransactions, useAnalytics } from "@/lib/finance/store";
import { inr, localDateKey } from "@/lib/finance/format";
import { buildDayBreakdown, buildMonthlySummary } from "@/lib/finance/insights";
import { useI18n } from "@/lib/i18n";
import { useIsMobile } from "@/hooks/use-mobile";
import type { Transaction, Anomaly } from "@/lib/finance/types";

export const Route = createFileRoute("/app/calendar")({
  head: () => ({
    meta: [
      { title: "Expense Calendar — FinGuard AI" },
      { name: "description", content: "AI spending calendar with daily merchant, category, and anomaly breakdowns." },
    ],
  }),
  component: CalendarPage,
});

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const WEEKDAYS = ["S","M","T","W","T","F","S"];

type StatusKey = "none" | "normal" | "warning" | "high" | "unusual";

const STATUS_META: Record<StatusKey, { dot: string; ring: string; bg: string; label: string; text: string }> = {
  none:    { dot: "bg-muted-foreground/30", ring: "ring-border/40",         bg: "bg-transparent",           label: "No activity",      text: "text-muted-foreground" },
  normal:  { dot: "bg-emerald-500",         ring: "ring-emerald-500/30",    bg: "bg-emerald-500/[0.06]",    label: "Normal",           text: "text-emerald-600 dark:text-emerald-400" },
  warning: { dot: "bg-yellow-500",          ring: "ring-yellow-500/30",     bg: "bg-yellow-500/[0.08]",     label: "Budget warning",   text: "text-yellow-700 dark:text-yellow-400" },
  high:    { dot: "bg-orange-500",          ring: "ring-orange-500/30",     bg: "bg-orange-500/[0.08]",     label: "High spending",    text: "text-orange-700 dark:text-orange-400" },
  unusual: { dot: "bg-red-500",             ring: "ring-red-500/40",        bg: "bg-red-500/[0.10]",        label: "Unusual activity", text: "text-red-600 dark:text-red-400" },
};

type FilterKey = "all" | "normal" | "warning" | "high" | "anomalies";

const CAT_COLORS = ["hsl(var(--brand))", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16"];

function CalendarPage() {
  const { t } = useI18n();
  const isMobile = useIsMobile();
  const txs = useTransactions();
  const analytics = useAnalytics();
  const [cursor, setCursor] = useState(() => new Date());
  const [selected, setSelected] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [filter, setFilter] = useState<FilterKey>("all");

  const year = cursor.getFullYear();
  const month = cursor.getMonth();

  // Only expenses that BELONG to this month (local timezone respected)
  const monthTxs = useMemo(
    () => txs.filter((tx) => {
      if (tx.amount >= 0) return false;
      const d = new Date(tx.date);
      return d.getFullYear() === year && d.getMonth() === month;
    }),
    [txs, year, month],
  );

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDow = new Date(year, month, 1).getDay();

  const dayBreakdowns = useMemo(() => {
    const map = new Map<string, ReturnType<typeof buildDayBreakdown>>();
    for (let d = 1; d <= daysInMonth; d++) {
      const key = localDateKey(new Date(year, month, d));
      map.set(key, buildDayBreakdown(key, txs, analytics));
    }
    return map;
  }, [txs, analytics, year, month, daysInMonth]);

  const anomaliesByDay = useMemo(() => {
    const map = new Map<string, Anomaly[]>();
    for (const a of analytics.anomalies) {
      const key = localDateKey(a.date);
      const arr = map.get(key) ?? [];
      arr.push(a);
      map.set(key, arr);
    }
    return map;
  }, [analytics.anomalies]);

  const monthlySummary = useMemo(
    () => buildMonthlySummary(txs, year, month, analytics),
    [txs, year, month, analytics],
  );

  const matchesFilter = (key: string): boolean => {
    if (filter === "all") return true;
    if (filter === "anomalies") return (anomaliesByDay.get(key)?.length ?? 0) > 0;
    const bd = dayBreakdowns.get(key);
    return bd?.status === filter;
  };

  const cells: Array<{ day: number; key: string } | null> = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, key: localDateKey(new Date(year, month, d)) });
  }

  const changeMonth = (delta: number) => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + delta, 1));
  const today = localDateKey(new Date());
  const selectedDay = selected ? dayBreakdowns.get(selected) : null;
  const selectedAnomalies = selected ? anomaliesByDay.get(selected) ?? [] : [];
  const selectedTimeline = useMemo(() => {
    if (!selected) return [] as Transaction[];
    return txs
      .filter((tx) => tx.amount < 0 && localDateKey(tx.date) === selected)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [txs, selected]);

  const yearOptions = useMemo(() => {
    const now = new Date().getFullYear();
    return Array.from({ length: 6 }, (_, i) => now - 3 + i);
  }, []);

  // Active days for the mobile scroll list (only days with data in this month)
  const activeDays = useMemo(() => {
    return cells
      .filter((c): c is { day: number; key: string } => !!c)
      .map((c) => ({ ...c, bd: dayBreakdowns.get(c.key)! }))
      .filter((c) => c.bd.total > 0 && matchesFilter(c.key))
      .sort((a, b) => b.day - a.day);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cells, dayBreakdowns, filter, anomaliesByDay]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3 sm:flex sm:flex-wrap sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground sm:text-xs">AI Spending Calendar</p>
          <h1 className="mt-1 truncate text-2xl font-semibold sm:text-3xl">{t("calendar")}</h1>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">Tap any day to open an AI-generated financial brief.</p>
        </div>
        <button
          onClick={() => setUploadOpen(true)}
          className="inline-flex shrink-0 items-center gap-2 rounded-xl border bg-card px-3 py-2 text-xs font-medium hover:bg-secondary sm:text-sm"
        >
          <Upload className="h-4 w-4" /> <span className="hidden xs:inline">Import</span>
        </button>
      </div>

      {/* Month nav + filters */}
      <GlassCard className="p-3 sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <button onClick={() => changeMonth(-1)} className="rounded-lg border p-1.5 transition hover:bg-secondary" aria-label="Previous month">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-1.5">
              <select
                value={month}
                onChange={(e) => setCursor(new Date(year, Number(e.target.value), 1))}
                className="rounded-lg border bg-card px-2 py-1.5 text-sm font-semibold outline-none hover:bg-secondary"
                aria-label="Month"
              >
                {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
              </select>
              <select
                value={year}
                onChange={(e) => setCursor(new Date(Number(e.target.value), month, 1))}
                className="rounded-lg border bg-card px-2 py-1.5 text-sm font-semibold outline-none hover:bg-secondary"
                aria-label="Year"
              >
                {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <button onClick={() => changeMonth(1)} className="rounded-lg border p-1.5 transition hover:bg-secondary" aria-label="Next month">
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              onClick={() => setCursor(new Date())}
              className="ml-1 rounded-lg border bg-card px-2.5 py-1.5 text-xs font-medium hover:bg-secondary"
            >
              Today
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {([
              { k: "all",       label: "All" },
              { k: "normal",    label: "Normal",   dot: "bg-emerald-500" },
              { k: "warning",   label: "Warning",  dot: "bg-yellow-500" },
              { k: "high",      label: "High",     dot: "bg-orange-500" },
              { k: "anomalies", label: "Anomalies",dot: "bg-red-500" },
            ] as { k: FilterKey; label: string; dot?: string }[]).map((f) => {
              const active = filter === f.k;
              return (
                <button
                  key={f.k}
                  onClick={() => setFilter(f.k)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                    active ? "border-brand bg-brand/10 text-brand" : "bg-card hover:bg-secondary"
                  }`}
                >
                  {f.dot && <span className={`h-1.5 w-1.5 rounded-full ${f.dot}`} />}
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>
      </GlassCard>

      {/* Calendar / mobile list */}
      {isMobile ? (
        <GlassCard className="p-3">
          {activeDays.length === 0 ? (
            <EmptyState label="No spending days match this filter." />
          ) : (
            <ul className="divide-y">
              {activeDays.map((c, i) => {
                const meta = STATUS_META[c.bd.status as StatusKey] ?? STATUS_META.none;
                const dt = new Date(year, month, c.day);
                const hasAnomaly = (anomaliesByDay.get(c.key)?.length ?? 0) > 0;
                return (
                  <motion.li
                    key={c.key}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.02 }}
                  >
                    <button
                      onClick={() => setSelected(c.key)}
                      className="flex w-full items-center gap-3 py-3 text-left transition active:bg-secondary/60"
                    >
                      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border bg-card">
                        <span className="text-sm font-bold">{c.day}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-semibold">
                            {dt.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}
                          </p>
                          {hasAnomaly && <ShieldAlert className="h-3.5 w-3.5 text-red-500" />}
                        </div>
                        <p className={`text-xs ${meta.text}`}>{meta.label} · {c.bd.count} tx</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-bold tabular-nums">{inr(c.bd.total)}</p>
                        <span className={`ml-auto mt-1 inline-block h-2 w-2 rounded-full ${meta.dot}`} />
                      </div>
                    </button>
                  </motion.li>
                );
              })}
            </ul>
          )}
        </GlassCard>
      ) : (
        <GlassCard className="p-3 sm:p-4">
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] uppercase tracking-wider text-muted-foreground sm:gap-1.5">
            {WEEKDAYS.map((w, i) => <div key={i} className="py-1">{w}</div>)}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1 sm:gap-1.5">
            {cells.map((c, i) => {
              if (!c) return <div key={`e-${i}`} className="h-[58px] sm:h-[64px]" />;
              const bd = dayBreakdowns.get(c.key)!;
              const status = (bd.status as StatusKey) ?? "none";
              const meta = STATUS_META[status];
              const isSel = selected === c.key;
              const isToday = c.key === today;
              const matches = matchesFilter(c.key);
              const hasAnomaly = (anomaliesByDay.get(c.key)?.length ?? 0) > 0;
              return (
                <motion.button
                  key={c.key}
                  onClick={() => setSelected(c.key)}
                  whileHover={{ scale: 1.03, y: -1 }}
                  whileTap={{ scale: 0.97 }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: matches ? 1 : 0.28 }}
                  transition={{ delay: i * 0.004 }}
                  className={`group relative flex h-[58px] flex-col items-start justify-between rounded-lg p-1.5 text-left ring-1 transition sm:h-[64px] ${meta.bg} ${meta.ring} ${isSel ? "outline outline-2 outline-brand" : ""}`}
                  aria-label={`${c.key} spend ${bd.total}`}
                >
                  <div className="flex w-full items-center justify-between">
                    <span className={`text-[11px] font-semibold leading-none ${isToday ? "text-brand" : ""}`}>{c.day}</span>
                    {bd.total > 0 && <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${meta.dot}`} />}
                  </div>
                  {bd.total > 0 ? (
                    <span className="w-full truncate text-[10px] font-medium leading-none text-foreground/85">
                      ₹{bd.total >= 1000 ? `${(bd.total / 1000).toFixed(bd.total >= 10000 ? 0 : 1)}k` : bd.total}
                    </span>
                  ) : (
                    <span className="text-[9px] text-muted-foreground/60">—</span>
                  )}
                  {hasAnomaly && (
                    <span className="absolute right-1 bottom-1 text-red-500">
                      <ShieldAlert className="h-2.5 w-2.5" />
                    </span>
                  )}
                </motion.button>
              );
            })}
          </div>
        </GlassCard>
      )}

      {/* Monthly AI Overview */}
      <GlassCard>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold sm:text-base">{t("monthly_overview")}</h3>
            <p className="text-xs text-muted-foreground">AI financial report for {MONTHS[month]} {year}</p>
          </div>
          <Sparkles className="h-4 w-4 text-brand" />
        </div>
        <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
          <OverviewStat icon={<TrendingDown className="h-4 w-4" />} label="Total Spending" value={inr(monthlySummary.totalSpend)} tone="danger" />
          <OverviewStat icon={<PiggyBank className="h-4 w-4" />} label="Savings" value={inr(Math.max(0, monthlySummary.savings))} tone="success" />
          <OverviewStat icon={<TrendingUp className="h-4 w-4" />} label="Top Category" value={monthlySummary.highestCategory?.category ?? "—"} sub={monthlySummary.highestCategory ? inr(monthlySummary.highestCategory.amount) : ""} />
          <OverviewStat icon={<TrendingDown className="h-4 w-4" />} label="Lowest Category" value={monthlySummary.lowestCategory?.category ?? "—"} sub={monthlySummary.lowestCategory ? inr(monthlySummary.lowestCategory.amount) : ""} />
          <OverviewStat icon={<CalendarX className="h-4 w-4" />} label="No-Spend Days" value={String(monthlySummary.noSpendDays)} />
          <OverviewStat
            icon={monthlySummary.trendPct <= 0 ? <TrendingDown className="h-4 w-4" /> : <TrendingUp className="h-4 w-4" />}
            label="vs Last Month"
            value={`${monthlySummary.trendPct > 0 ? "+" : ""}${monthlySummary.trendPct}%`}
            tone={monthlySummary.trendPct <= 0 ? "success" : "danger"}
          />
        </div>
        <div className="mt-4 rounded-xl border bg-brand/5 p-4">
          <div className="mb-2 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-brand" />
            <p className="text-xs font-semibold uppercase tracking-wider text-brand">{t("ai_monthly_summary")}</p>
          </div>
          <ul className="space-y-1.5 text-sm">
            {monthlySummary.narrative.map((n, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-brand" />
                <span>{n}</span>
              </li>
            ))}
          </ul>
        </div>
      </GlassCard>

      {/* Detail drawer */}
      <AnimatePresence>
        {selected && selectedDay && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setSelected(null)}
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            />
            <motion.aside
              initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 260 }}
              className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col overflow-y-auto border-l bg-background shadow-2xl"
            >
              <div className="sticky top-0 z-10 flex items-start justify-between border-b bg-background/95 p-5 backdrop-blur">
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Daily Brief</p>
                  <h2 className="mt-1 truncate text-lg font-semibold">
                    {new Date(selected + "T12:00:00").toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                  </h2>
                </div>
                <button onClick={() => setSelected(null)} className="shrink-0 rounded-lg p-2 hover:bg-secondary" aria-label="Close">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-5 p-5">
                {selectedDay.total === 0 ? (
                  <div className="rounded-xl border bg-emerald-500/5 p-6 text-center">
                    <ShieldCheck className="mx-auto h-10 w-10 text-emerald-500" />
                    <p className="mt-3 text-sm font-semibold">No-Spend Day</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      You saved ~{inr(Math.round(analytics.averages.dailySpend))} versus a typical day. Great restraint.
                    </p>
                  </div>
                ) : (
                  <>
                    <StatusBanner status={selectedDay.status} label={selectedDay.statusLabel} />

                    <div className="grid grid-cols-3 gap-2">
                      <MiniBox label={t("total_spending")} value={inr(selectedDay.total)} />
                      <MiniBox label={t("transactions_count")} value={String(selectedDay.count)} />
                      <MiniBox
                        label="vs Avg"
                        value={`${selectedDay.vsAverage > 0 ? "+" : ""}${selectedDay.vsAverage}%`}
                        tone={selectedDay.vsAverage > 20 ? "danger" : selectedDay.vsAverage < -20 ? "success" : undefined}
                      />
                    </div>

                    {/* Anomalies */}
                    {selectedAnomalies.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Daily Anomaly Status</p>
                        {selectedAnomalies.map((a) => (
                          <motion.div
                            key={a.id}
                            initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                            className="rounded-xl border border-red-500/30 bg-red-500/5 p-3"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold">{a.merchant}</p>
                                <p className="text-xs text-muted-foreground">{a.reason}</p>
                              </div>
                              <span className="shrink-0 rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-semibold text-red-600 dark:text-red-400">
                                {a.risk} · {a.confidence}%
                              </span>
                            </div>
                            <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                              <div className="rounded-lg bg-background/60 p-1.5">
                                <p className="text-[9px] uppercase text-muted-foreground">Actual</p>
                                <p className="text-xs font-semibold text-red-500">{inr(a.actual)}</p>
                              </div>
                              <div className="rounded-lg bg-background/60 p-1.5">
                                <p className="text-[9px] uppercase text-muted-foreground">Expected</p>
                                <p className="text-xs font-semibold">{inr(a.expected)}</p>
                              </div>
                              <div className="rounded-lg bg-background/60 p-1.5">
                                <p className="text-[9px] uppercase text-muted-foreground">Deviation</p>
                                <p className="text-xs font-semibold text-orange-500">{a.deviation}%</p>
                              </div>
                            </div>
                            <p className="mt-2 flex items-start gap-1.5 text-xs text-foreground/80">
                              <ArrowRight className="mt-0.5 h-3 w-3 shrink-0 text-red-500" />
                              Verify this transaction. If unrecognised, dispute immediately.
                            </p>
                          </motion.div>
                        ))}
                      </div>
                    )}

                    {/* Category doughnut */}
                    {selectedDay.categories.length > 0 && (
                      <div>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("category_breakdown")}</p>
                        <div className="flex items-center gap-3">
                          <div className="h-32 w-32 shrink-0">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie
                                  data={selectedDay.categories}
                                  dataKey="amount"
                                  nameKey="category"
                                  innerRadius={34}
                                  outerRadius={58}
                                  paddingAngle={2}
                                  stroke="none"
                                  animationDuration={600}
                                >
                                  {selectedDay.categories.map((_, i) => (
                                    <Cell key={i} fill={CAT_COLORS[i % CAT_COLORS.length]} />
                                  ))}
                                </Pie>
                                <Tooltip
                                  formatter={(v: number) => inr(v)}
                                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                                />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                          <ul className="min-w-0 flex-1 space-y-1.5">
                            {selectedDay.categories.slice(0, 5).map((c, i) => (
                              <li key={c.category} className="flex items-center gap-2 text-xs">
                                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: CAT_COLORS[i % CAT_COLORS.length] }} />
                                <span className="min-w-0 flex-1 truncate">{c.category}</span>
                                <span className="shrink-0 tabular-nums text-muted-foreground">{c.share}%</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}

                    {/* Merchant breakdown */}
                    {selectedDay.merchants.length > 0 && (
                      <div>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("merchant_breakdown")}</p>
                        <ul className="space-y-2">
                          {selectedDay.merchants.map((m, i) => (
                            <motion.li
                              key={m.merchant}
                              initial={{ opacity: 0, x: -6 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: i * 0.03 }}
                              className="space-y-1"
                            >
                              <div className="flex items-center justify-between text-sm">
                                <span className="min-w-0 truncate font-medium">{m.merchant}</span>
                                <span className="shrink-0 tabular-nums text-muted-foreground">{inr(m.amount)} · {m.share}%</span>
                              </div>
                              <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${m.share}%` }}
                                  transition={{ duration: 0.5, delay: 0.1 + i * 0.03 }}
                                  className="h-full rounded-full bg-brand"
                                />
                              </div>
                            </motion.li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Timeline */}
                    {selectedTimeline.length > 0 && (
                      <div>
                        <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          <Clock className="h-3 w-3" /> Spending Timeline
                        </p>
                        <ol className="relative space-y-3 border-l border-border/60 pl-4">
                          {selectedTimeline.map((tx, i) => (
                            <motion.li
                              key={tx.id}
                              initial={{ opacity: 0, x: -6 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: i * 0.03 }}
                              className="relative"
                            >
                              <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-brand ring-2 ring-background" />
                              <div className="flex items-baseline justify-between gap-2">
                                <p className="text-xs font-medium text-muted-foreground tabular-nums">
                                  {new Date(tx.date).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}
                                </p>
                                <p className="text-sm font-semibold tabular-nums">{inr(-tx.amount)}</p>
                              </div>
                              <p className="truncate text-sm">
                                {tx.merchant} <span className="text-xs text-muted-foreground">· {tx.category}</span>
                              </p>
                            </motion.li>
                          ))}
                        </ol>
                      </div>
                    )}

                    {/* AI Insight */}
                    <div className="rounded-xl border border-brand/30 bg-brand/5 p-3">
                      <div className="mb-1.5 flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-brand" />
                        <p className="text-xs font-semibold uppercase tracking-wider text-brand">{t("ai_insight")}</p>
                      </div>
                      <p className="text-sm">{selectedDay.insight}</p>
                    </div>

                    {/* AI Recommendation */}
                    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3">
                      <div className="mb-1.5 flex items-center gap-2">
                        <Activity className="h-4 w-4 text-emerald-500" />
                        <p className="text-xs font-semibold uppercase tracking-wider text-emerald-500">{t("ai_recommendation")}</p>
                      </div>
                      <p className="text-sm">{selectedDay.recommendation}</p>
                    </div>
                  </>
                )}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <UploadDialog open={uploadOpen} onClose={() => setUploadOpen(false)} />
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="py-10 text-center">
      <CalendarX className="mx-auto h-8 w-8 text-muted-foreground/60" />
      <p className="mt-2 text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

function StatusBanner({ status, label }: { status: string; label: string }) {
  const meta = STATUS_META[(status as StatusKey)] ?? STATUS_META.none;
  const Icon = status === "unusual" || status === "high" ? AlertTriangle : ShieldCheck;
  return (
    <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium ${meta.bg} ${meta.text}`}>
      <Icon className="h-4 w-4" />
      {label}
    </div>
  );
}

function OverviewStat({ label, value, sub, tone, icon }: { label: string; value: string; sub?: string; tone?: "success" | "danger"; icon?: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card/40 p-3">
      <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        {icon} {label}
      </p>
      <p className={`mt-1 truncate text-base font-semibold sm:text-lg ${tone === "success" ? "text-emerald-500" : tone === "danger" ? "text-destructive" : ""}`}>{value}</p>
      {sub && <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

function MiniBox({ label, value, tone }: { label: string; value: string; tone?: "success" | "warning" | "danger" }) {
  const cls =
    tone === "danger" ? "border-destructive/40 bg-destructive/5"
      : tone === "warning" ? "border-warning/40 bg-warning/5"
      : tone === "success" ? "border-emerald-500/40 bg-emerald-500/5"
      : "border-border bg-card/40";
  return (
    <div className={`rounded-xl border p-2.5 ${cls}`}>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-0.5 truncate text-sm font-semibold">{value}</p>
    </div>
  );
}
