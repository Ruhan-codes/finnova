import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  Wallet, TrendingDown, PiggyBank, TrendingUp, DollarSign, Activity, Sparkles, RefreshCcw, Inbox,
  ShieldAlert, CheckCircle2, AlertTriangle,
} from "lucide-react";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, LineChart, Line, XAxis, YAxis,
  CartesianGrid, BarChart, Bar, AreaChart, Area,
} from "recharts";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { StatCard } from "@/components/finance/StatCard";
import { GlassCard } from "@/components/finance/GlassCard";
import { AiAnalysisFlow, type AnalysisSummary } from "@/components/finance/AiAnalysisFlow";
import { SubscriptionIntelligenceModal } from "@/components/finance/SubscriptionIntelligenceModal";

import { parseCsv, useAnalytics, useReplaceTransactions, useTransactions } from "@/lib/finance/store";
import { useAlerts } from "@/lib/finance/alertsStore";
import { inr, shortDate } from "@/lib/finance/format";
import { useCurrentUser } from "@/lib/finance/auth";

export const Route = createFileRoute("/app/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — FinGuard AI" },
      { name: "description", content: "AI-generated financial dashboard powered by your imported transactions." },
    ],
  }),
  component: Dashboard,
});

const COLORS = ["#2563EB", "#4F46E5", "#22C55E", "#F59E0B", "#EF4444", "#0EA5E9", "#8B5CF6", "#EC4899"];

function Dashboard() {
  const a = useAnalytics();
  const txs = useTransactions();
  const { data: persistedAlerts = [] } = useAlerts();
  const { user } = useCurrentUser();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const replace = useReplaceTransactions();
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [summary, setSummary] = useState<AnalysisSummary | null>(null);
  const [subsOpen, setSubsOpen] = useState(false);
  const txById = useMemo(() => new Map(txs.map((t) => [t.id, t])), [txs]);

  const greeting = new Date().getHours() < 12 ? "Good Morning" : new Date().getHours() < 18 ? "Good Afternoon" : "Good Evening";

  const openPicker = () => fileRef.current?.click();

  const handleFile = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = parseCsv(text);
      if (!parsed.length) return toast.error("We couldn't recognise any transactions in that file.");
      setSummary(null);
      setAnalysisOpen(true);
      try {
        await replace.mutateAsync(parsed);
        const merchants = new Set(parsed.map((t) => t.merchant.toLowerCase())).size;
        const categories = new Set(parsed.map((t) => t.category)).size;
        setSummary({
          transactions: parsed.length,
          merchants,
          categories,
          subscriptions: Math.min(merchants, Math.max(1, Math.floor(merchants / 8))),
          insights: 2,
          anomalies: 0,
        });
        toast.success("Your finances are up to date.");
      } catch (err) {
        setAnalysisOpen(false);
        toast.error(err instanceof Error ? err.message : "Sync failed.");
      }
    } catch {
      toast.error("We couldn't read that file. Please try again.");
    }
  };

  const HiddenPicker = (
    <input
      ref={fileRef}
      type="file"
      accept=".csv,text/csv,text/plain"
      className="sr-only"
      onChange={(e) => {
        const f = e.target.files?.[0];
        e.target.value = "";
        if (f) void handleFile(f);
      }}
    />
  );

  if (!a.hasData) {
    return (
      <div className="space-y-6">
        {HiddenPicker}
        <Header
          greeting={greeting}
          name={user?.firstName ?? "there"}
          score={0}
          scoreLabel="No data"
          onSync={openPicker}
        />
        <GlassCard className="grid place-items-center py-16 text-center sm:py-20">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-brand/15 text-brand">
            <Inbox className="h-6 w-6" />
          </div>
          <h2 className="mt-4 text-lg font-semibold">Sync your recent transactions to get started</h2>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            Pull in the latest activity from your device to unlock your personalised AI dashboard, insights, budgets and alerts.
          </p>
          <button
            onClick={openPicker}
            className="mt-6 inline-flex items-center gap-2 rounded-xl gradient-brand px-4 py-2.5 text-sm font-medium text-white shadow-md"
          >
            <RefreshCcw className="h-4 w-4" /> Sync New Data
          </button>
        </GlassCard>
        <AiAnalysisFlow open={analysisOpen} summary={summary} onDone={() => setAnalysisOpen(false)} />
      </div>
    );
  }

  const catChart = a.categories.slice(0, 8).map((c) => ({ name: c.category, value: c.amount }));
  const catTotal = catChart.reduce((s, c) => s + c.value, 0) || 1;

  // AI Risk Center — dynamic findings derived from analytics + alerts.
  const riskFindings = buildRiskFindings(a, persistedAlerts.length);

  return (
    <div className="space-y-6">
      {HiddenPicker}
      <Header
        greeting={greeting}
        name={user?.firstName ?? "there"}
        score={a.health.score}
        scoreLabel={a.health.label}
        scoreExplanation={a.health.explanation}
        onSync={openPicker}
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Monthly Income" value={inr(a.currentMonth.income)} delta={`avg ${inr(a.averages.monthlyIncome)}/mo`} icon={<TrendingUp className="h-4 w-4" />} tone="success" />
        <StatCard label="Monthly Expenses" value={inr(a.currentMonth.expenses)} delta={`avg ${inr(a.averages.monthlySpend)}/mo`} icon={<TrendingDown className="h-4 w-4" />} tone="danger" />
        <StatCard label="Savings" value={inr(a.currentMonth.savings)} delta={a.currentMonth.savings >= 0 ? "positive" : "negative"} icon={<PiggyBank className="h-4 w-4" />} tone={a.currentMonth.savings >= 0 ? "success" : "danger"} />
        <StatCard label="Budget Remaining" value={inr(a.currentMonth.budgetRemaining)} delta={`of ${inr(a.currentMonth.budgetSuggested)}`} icon={<Wallet className="h-4 w-4" />} />
        <StatCard label="Cash Flow" value={inr(a.cashFlow)} delta={a.cashFlow > 0 ? "healthy" : "review"} icon={<Activity className="h-4 w-4" />} tone={a.cashFlow > 0 ? "success" : "warning"} />
        <StatCard label="Net Balance" value={inr(a.totals.net)} delta={`${a.totalTransactions} transactions`} icon={<DollarSign className="h-4 w-4" />} />
      </div>

      {/* Forecast / Weekend vs Weekday / Subscriptions — moved directly below KPI metrics */}
      <div className="grid gap-4 md:grid-cols-3">
        <GlassCard>
          <h3 className="mb-2 text-sm font-semibold">Next-Month Forecast</h3>
          <p className="text-2xl font-semibold">{inr(a.forecastNextMonth)}</p>
          <p className="mt-1 text-xs text-muted-foreground">Predicted expenses (linear trend of last {a.monthly.length} months).</p>
        </GlassCard>
        <GlassCard>
          <h3 className="mb-2 text-sm font-semibold">Weekend vs Weekday</h3>
          <p className="text-2xl font-semibold">{a.weekendVsWeekday.weekendShare}% <span className="text-sm font-normal text-muted-foreground">weekend</span></p>
          <p className="mt-1 text-xs text-muted-foreground">Weekend spend {inr(a.weekendVsWeekday.weekend)} vs weekday {inr(a.weekendVsWeekday.weekday)}.</p>
        </GlassCard>
        <motion.button
          type="button"
          onClick={() => setSubsOpen(true)}
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.99 }}
          className="group relative overflow-hidden rounded-2xl border bg-card p-4 text-left shadow-sm transition hover:shadow-md"
        >
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-brand/8 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Subscriptions</h3>
            <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand">AI</span>
          </div>
          <p className="mt-2 text-2xl font-semibold">{a.subscriptions.length} <span className="text-sm font-normal text-muted-foreground">detected</span></p>
          <p className="mt-1 truncate text-xs text-muted-foreground">{a.subscriptions.slice(0, 3).map((s) => s.merchant).join(", ") || "None yet"}</p>
          <p className="mt-2 text-[11px] font-medium text-brand opacity-80 group-hover:opacity-100">Tap for full Subscription Intelligence →</p>
        </motion.button>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <GlassCard className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Income vs Expenses</h3>
            <span className="text-xs text-muted-foreground">{a.monthly.length} month(s)</span>
          </div>
          <div className="h-64">
            <ResponsiveContainer>
              <LineChart data={a.monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={12} />
                <YAxis stroke="var(--muted-foreground)" fontSize={12} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => inr(v)} contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12 }} />
                <Line type="monotone" dataKey="expenses" stroke="#EF4444" strokeWidth={2.5} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="income" stroke="#22C55E" strokeWidth={2.5} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        <GlassCard>
          <h3 className="mb-4 text-sm font-semibold">Category Distribution</h3>
          <div className="grid grid-cols-[1fr_auto] items-center gap-4">
            <div className="h-56">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={catChart} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80} paddingAngle={3}>
                    {catChart.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => inr(v)} contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="min-w-[9rem] space-y-1.5 text-xs">
              {catChart.map((c, i) => {
                const pct = Math.round((c.value / catTotal) * 100);
                return (
                  <li key={c.name} className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <span className="flex-1 truncate">{c.name}</span>
                    <span className="font-medium tabular-nums text-muted-foreground">{pct}%</span>
                  </li>
                );
              })}
            </ul>
          </div>
        </GlassCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <GlassCard>
          <h3 className="mb-4 text-sm font-semibold">Top Merchants</h3>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={a.merchants.slice(0, 7).map((m) => ({ name: m.merchant, value: m.amount }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={11} interval={0} angle={-15} textAnchor="end" height={50} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => inr(v)} contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12 }} />
                <Bar dataKey="value" fill="url(#brandGrad)" radius={[8, 8, 0, 0]} />
                <defs>
                  <linearGradient id="brandGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2563EB" />
                    <stop offset="100%" stopColor="#4F46E5" />
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        <GlassCard>
          <h3 className="mb-4 text-sm font-semibold">Savings Trend</h3>
          <div className="h-64">
            <ResponsiveContainer>
              <AreaChart data={a.monthly.map((m) => ({ label: m.label, savings: Math.max(0, m.savings) }))}>
                <defs>
                  <linearGradient id="savArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22C55E" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#22C55E" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={11} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => inr(v)} contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12 }} />
                <Area type="monotone" dataKey="savings" stroke="#22C55E" strokeWidth={2.5} fill="url(#savArea)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <GlassCard className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Recent Transactions</h3>
            <span className="text-xs text-muted-foreground">{a.totalTransactions} total</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr><th className="pb-3">Date</th><th>Merchant</th><th>Category</th><th className="text-right">Amount</th><th className="text-right">Review</th></tr>
              </thead>
              <tbody>
                {a.recent.map((t) => (
                  <tr key={t.id} className="border-t hover:bg-secondary/40">
                    <td className="py-3 text-muted-foreground">{shortDate(t.date)}</td>
                    <td className="font-medium">{t.merchant}</td>
                    <td><span className="rounded-full bg-secondary px-2 py-0.5 text-xs">{t.category}</span></td>
                    <td className={`text-right font-medium ${t.amount < 0 ? "" : "text-success"}`}>{inr(t.amount)}</td>
                    <td className="text-right"><ReviewPill status={t.reviewStatus ?? "verified"} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>

        <GlassCard>
          <div className="mb-3 flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg gradient-brand text-white"><ShieldAlert className="h-4 w-4" /></div>
            <h3 className="text-sm font-semibold">AI Risk Center</h3>
          </div>
          <ul className="space-y-2">
            {riskFindings.map((f, i) => (
              <motion.li
                key={f.title + i}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className={`flex items-start gap-2 rounded-xl border p-2.5 text-sm ${
                  f.tone === "warning"
                    ? "border-warning/40 bg-warning/5"
                    : f.tone === "danger"
                      ? "border-destructive/40 bg-destructive/5"
                      : "border-success/40 bg-success/5"
                }`}
              >
                {f.tone === "success" ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-success" />
                ) : (
                  <AlertTriangle className={`mt-0.5 h-4 w-4 ${f.tone === "danger" ? "text-destructive" : "text-warning"}`} />
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-medium leading-tight">{f.title}</p>
                  {f.detail && <p className="mt-0.5 text-[11px] text-muted-foreground">{f.detail}</p>}
                </div>
              </motion.li>
            ))}
          </ul>
        </GlassCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <GlassCard className="lg:col-span-3">
          <div className="mb-3 flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg gradient-brand text-white"><Sparkles className="h-4 w-4" /></div>
            <h3 className="text-sm font-semibold">AI Insights</h3>
          </div>
          <div className="space-y-2">
            {a.insights.length === 0 && (
              <p className="text-sm text-muted-foreground">Import more transactions to unlock deeper insights.</p>
            )}
            {a.insights.map((ins, i) => {
              const tone = ins.tone === "success" ? "border-success/40 bg-success/5"
                : ins.tone === "warning" ? "border-warning/40 bg-warning/5"
                : ins.tone === "danger" ? "border-destructive/40 bg-destructive/5"
                : "border-brand/30 bg-brand/5";
              return (
                <motion.div
                  key={ins.title + i}
                  initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}
                  className={`rounded-xl border p-3 text-sm ${tone}`}
                >
                  <p className="font-medium">{ins.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{ins.detail}</p>
                </motion.div>
              );
            })}
          </div>
        </GlassCard>
      </div>

      <AiAnalysisFlow open={analysisOpen} summary={summary} onDone={() => setAnalysisOpen(false)} />
      <SubscriptionIntelligenceModal open={subsOpen} onClose={() => setSubsOpen(false)} transactions={txs} />
    </div>
  );
}

type RiskFinding = { title: string; detail?: string; tone: "success" | "warning" | "danger" };
function buildRiskFindings(a: ReturnType<typeof import("@/lib/finance/store").useAnalytics>, alertCount: number): RiskFinding[] {
  const out: RiskFinding[] = [];
  // Salary detection
  if (a.currentMonth.income > 0) {
    out.push({ title: "Salary Received", detail: `${inr(a.currentMonth.income)} credited this month.`, tone: "success" });
  }
  // Budget status
  if (a.currentMonth.budgetSuggested > 0) {
    const used = a.currentMonth.expenses / a.currentMonth.budgetSuggested;
    if (used < 0.9) out.push({ title: "Budget On Track", detail: `${Math.round(used * 100)}% of monthly budget used.`, tone: "success" });
    else out.push({ title: "Budget Nearing Limit", detail: `${Math.round(used * 100)}% of monthly budget used.`, tone: "warning" });
  }
  // Spending stability
  if (a.monthly.length >= 2) {
    const last = a.monthly[a.monthly.length - 1];
    const prev = a.monthly[a.monthly.length - 2];
    if (prev.expenses > 0) {
      const diff = Math.round(((last.expenses - prev.expenses) / prev.expenses) * 100);
      if (Math.abs(diff) < 8) out.push({ title: "Spending Stable", detail: `Only ${Math.abs(diff)}% change vs last month.`, tone: "success" });
      else if (diff > 0) out.push({ title: `Spending Up ${diff}%`, detail: `${last.label} vs ${prev.label}.`, tone: "warning" });
    }
  }
  // Anomaly-derived findings
  for (const an of a.anomalies.slice(0, 3)) {
    const isHigh = an.risk === "High" || an.actual > 5000;
    out.push({
      title: isHigh ? "High Value Transaction" : `${an.merchant} Spending Increased`,
      detail: `${an.merchant} · ${inr(an.actual)} (${an.confidence}% confidence).`,
      tone: isHigh ? "danger" : "warning",
    });
  }
  if (out.length === 0 && alertCount === 0) {
    out.push({ title: "No unusual financial behaviour detected.", tone: "success" });
  }
  return out.slice(0, 6);
}

function Header({
  greeting, name, score, scoreLabel, scoreExplanation, onSync,
}: {
  greeting: string; name: string; score: number; scoreLabel: string; scoreExplanation?: string; onSync: () => void;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 sm:flex sm:flex-wrap sm:justify-between sm:gap-4">
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground sm:text-xs">
          {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
        </p>
        <h1 className="mt-1 truncate text-xl font-semibold sm:text-2xl md:text-3xl">{greeting}, {name} 👋</h1>
        <p className="mt-1 text-xs text-muted-foreground sm:text-sm">Your personalised AI financial overview.</p>
      </div>
      <div className="flex items-center gap-2 sm:gap-3">
        <button
          onClick={onSync}
          className="inline-flex items-center gap-1.5 rounded-xl gradient-brand px-3 py-2 text-xs font-semibold text-white shadow-md sm:text-sm"
        >
          <RefreshCcw className="h-4 w-4" /> <span className="hidden xs:inline sm:inline">Sync New Data</span><span className="xs:hidden sm:hidden">Sync</span>
        </button>
        <HealthRing score={score} label={scoreLabel} explanation={scoreExplanation} />
      </div>
    </div>
  );
}

function HealthRing({ score, label, explanation }: { score: number; label: string; explanation?: string }) {
  const r = 32, c = 2 * Math.PI * r;
  const offset = c - (score / 100) * c;
  return (
    <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="glass flex items-center gap-4 rounded-2xl p-4" title={explanation}>
      <div className="relative h-20 w-20">
        <svg viewBox="0 0 80 80" className="h-20 w-20 -rotate-90">
          <circle cx="40" cy="40" r={r} stroke="var(--secondary)" strokeWidth="8" fill="none" />
          <motion.circle
            cx="40" cy="40" r={r} stroke="url(#healthGrad)" strokeWidth="8" fill="none" strokeLinecap="round"
            strokeDasharray={c}
            initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: offset }} transition={{ duration: 1.2, ease: "easeOut" }}
          />
          <defs>
            <linearGradient id="healthGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#2563EB" /><stop offset="100%" stopColor="#22C55E" />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute inset-0 grid place-items-center">
          <span className="text-lg font-semibold">{score}</span>
        </div>
      </div>
      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Financial Health</p>
        <p className="text-lg font-semibold">{score} / 100</p>
        <p className="text-xs text-success">{label}</p>
      </div>
    </motion.div>
  );
}

export function StatusPill({ status }: { status: string }) {
  const cls = status === "Completed" ? "bg-success/15 text-success" : status === "Pending" ? "bg-warning/15 text-warning" : "bg-destructive/15 text-destructive";
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{status}</span>;
}

export function ReviewPill({ status }: { status: string }) {
  const label = status === "verified" ? "Verified"
    : status === "suspicious" ? "Suspicious"
    : status === "under_review" ? "Fraud Suspected"
    : status === "disputed" ? "Fraud Suspected"
    : status === "resolved" ? "Resolved" : "Verified";
  const cls = status === "suspicious" ? "bg-destructive/15 text-destructive"
    : status === "under_review" ? "bg-destructive/15 text-destructive"
    : status === "disputed" ? "bg-destructive/15 text-destructive"
    : "bg-success/15 text-success";
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${cls}`}>{label}</span>;
}

