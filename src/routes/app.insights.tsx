import { createFileRoute } from "@tanstack/react-router";
import { GlassCard } from "@/components/finance/GlassCard";
import { StatCard } from "@/components/finance/StatCard";
import { useAnalytics } from "@/lib/finance/store";
import { inr } from "@/lib/finance/format";
import { TrendingUp, TrendingDown, Calendar, Repeat, Target, LineChart as LineIcon } from "lucide-react";
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";

export const Route = createFileRoute("/app/insights")({
  head: () => ({ meta: [{ title: "Insights — FinGuard AI" }, { name: "description", content: "Deep AI-powered financial analytics." }] }),
  component: Insights,
});

function Insights() {
  const a = useAnalytics();
  const forecastSeries = [
    ...a.monthly.map((m) => ({ name: m.label, val: m.expenses, kind: "actual" })),
    { name: "Next", val: a.forecastNextMonth, kind: "forecast" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Financial Insights</h1>
        <p className="mt-1 text-sm text-muted-foreground">Deep AI analysis of your spending behavior.</p>
      </div>

      {!a.hasData ? (
        <GlassCard className="py-10 text-center text-sm text-muted-foreground">Import transactions to unlock insights.</GlassCard>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
            <StatCard label="Top Spending Category" value={a.categories[0]?.category ?? "—"} delta={inr(a.categories[0]?.amount ?? 0)} icon={<TrendingUp className="h-4 w-4" />} />
            <StatCard label="Largest Merchant" value={a.merchants[0]?.merchant ?? "—"} delta={inr(a.merchants[0]?.amount ?? 0)} icon={<TrendingDown className="h-4 w-4" />} tone="danger" />
            <StatCard label="Monthly Average" value={inr(a.averages.monthlySpend)} delta={`${a.monthCount} months`} icon={<Calendar className="h-4 w-4" />} />
            <StatCard label="Daily Average" value={inr(a.averages.dailySpend)} delta="rolling" icon={<Calendar className="h-4 w-4" />} />
            <StatCard label="Weekend Spending" value={inr(a.weekendVsWeekday.weekend)} delta={`${a.weekendVsWeekday.weekendShare}% of total`} icon={<Calendar className="h-4 w-4" />} tone="warning" />
            <StatCard label="Weekday Spending" value={inr(a.weekendVsWeekday.weekday)} delta="working days" icon={<Calendar className="h-4 w-4" />} />
            <StatCard label="Subscriptions" value={`${a.subscriptions.length} detected`} delta={a.subscriptions.slice(0, 3).map((s) => s.merchant).join(", ")} icon={<Repeat className="h-4 w-4" />} />
            <StatCard label="Savings Ratio" value={`${Math.round(a.health.savingsRatio * 100)}%`} delta="of income" icon={<Target className="h-4 w-4" />} tone="success" />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <GlassCard>
              <div className="mb-4 flex items-center gap-2">
                <LineIcon className="h-4 w-4 text-brand" />
                <h3 className="text-sm font-semibold">Expense Forecast</h3>
              </div>
              <p className="mb-3 text-xs text-muted-foreground">Projected next-month spend: <b className="text-foreground">{inr(a.forecastNextMonth)}</b></p>
              <div className="h-56">
                <ResponsiveContainer>
                  <LineChart data={forecastSeries}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={11} />
                    <YAxis stroke="var(--muted-foreground)" fontSize={11} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: number) => inr(v)} contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12 }} />
                    <Line type="monotone" dataKey="val" stroke="#2563EB" strokeWidth={2.5} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </GlassCard>

            <GlassCard>
              <h3 className="mb-4 text-sm font-semibold">Recurring Subscriptions</h3>
              <ul className="divide-y">
                {a.subscriptions.slice(0, 8).map((s) => (
                  <li key={s.merchant} className="flex items-center justify-between py-2.5">
                    <span className="text-sm font-medium">{s.merchant}</span>
                    <span className="text-xs text-muted-foreground">{inr(s.amount)}</span>
                  </li>
                ))}
                {a.subscriptions.length === 0 && <li className="py-2 text-sm text-muted-foreground">No recurring bills detected yet.</li>}
              </ul>
            </GlassCard>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <GlassCard>
              <h3 className="mb-2 text-sm font-semibold">Financial Health</h3>
              <p className="text-2xl font-semibold">{a.health.score} / 100 <span className="text-sm font-normal text-success">{a.health.label}</span></p>
              <p className="mt-2 text-xs text-muted-foreground">{a.health.explanation}</p>
            </GlassCard>
            <GlassCard>
              <h3 className="mb-2 text-sm font-semibold">Cash Flow</h3>
              <p className="text-2xl font-semibold">{inr(a.cashFlow)} <span className={`text-sm font-normal ${a.cashFlow >= 0 ? "text-success" : "text-destructive"}`}>{a.cashFlow >= 0 ? "surplus" : "deficit"}</span></p>
              <p className="mt-2 text-xs text-muted-foreground">Based on total income minus total expenses across your dataset.</p>
            </GlassCard>
          </div>
        </>
      )}
    </div>
  );
}
