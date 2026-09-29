import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Activity, Bell, CheckCircle2, Cpu, Radio, ShieldAlert, Zap } from "lucide-react";
import { useMemo } from "react";
import { GlassCard } from "@/components/finance/GlassCard";
import { StatCard } from "@/components/finance/StatCard";
import { useAnalytics, useTransactions } from "@/lib/finance/store";
import { useAlerts } from "@/lib/finance/alertsStore";
import { inr } from "@/lib/finance/format";

export const Route = createFileRoute("/app/monitor")({
  head: () => ({ meta: [{ title: "Live Monitor — FinGuard AI" }, { name: "description", content: "Live transaction monitoring dashboard." }] }),
  component: Monitor,
});

type Event = { at: string; icon: typeof Radio; text: string; detail?: string; tone: "brand" | "warning" | "success" | "danger" };

function Monitor() {
  const a = useAnalytics();
  const txs = useTransactions();
  const { data: alerts = [] } = useAlerts();

  const events = useMemo<Event[]>(() => {
    const evs: Event[] = [];
    for (const al of alerts) {
      evs.push({ at: al.createdAt, icon: ShieldAlert, tone: al.severity === "High" ? "danger" : "warning", text: `Anomaly · ${al.merchant}`, detail: `${inr(al.actual)} vs typical ${inr(al.expected)} — ${al.severity} risk` });
      if (al.status !== "pending") {
        evs.push({ at: al.createdAt, icon: CheckCircle2, tone: al.status === "confirmed" ? "success" : "warning", text: `Reviewed · ${al.merchant}`, detail: al.status === "confirmed" ? "Marked as legitimate" : "Dispute opened" });
      }
    }
    for (const t of txs.slice(0, 10)) {
      evs.push({ at: t.date, icon: Radio, tone: "brand", text: `Ingested · ${t.merchant}`, detail: `${inr(t.amount)} · ${t.paymentMethod}` });
    }
    return evs.sort((x, y) => (x.at < y.at ? 1 : -1)).slice(0, 25);
  }, [alerts, txs]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Live Transaction Monitor</h1>
          <p className="mt-1 text-sm text-muted-foreground">Real-time AI monitoring across every one of your devices.</p>
        </div>
        <div className="flex items-center gap-2 rounded-full border bg-success/10 px-3 py-1.5 text-xs font-medium text-success">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
          </span>
          Live
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Baseline Dataset" value={a.totalTransactions.toLocaleString()} delta={`${a.monthCount} months of history`} icon={<Radio className="h-4 w-4" />} tone="success" />
        <StatCard label="Detected Subscriptions" value={a.subscriptions.length} delta="auto-detected" icon={<Activity className="h-4 w-4" />} tone="success" />
        <StatCard label="AI Alerts" value={alerts.length} delta={`${alerts.filter((x) => x.status === "pending").length} pending`} icon={<Cpu className="h-4 w-4" />} tone={alerts.some((x) => x.status === "pending") ? "warning" : "success"} />
        <StatCard label="Confirmed Fraud" value={alerts.filter((x) => x.status === "disputed").length} delta="under review" icon={<Bell className="h-4 w-4" />} tone="danger" />
      </div>

      <GlassCard>
        <h3 className="mb-4 text-sm font-semibold flex items-center gap-2"><Zap className="h-4 w-4 text-brand" /> Event Timeline</h3>
        {events.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Waiting for events. Run a Live Sync to populate the timeline.</p>}
        <div className="relative pl-6">
          <div className="absolute left-2 top-2 bottom-2 w-px bg-border" />
          <div className="space-y-3">
            {events.map((e, i) => {
              const toneCls = e.tone === "danger" ? "bg-destructive text-white" : e.tone === "warning" ? "bg-warning text-white" : e.tone === "success" ? "bg-success text-white" : "gradient-brand text-white";
              const Icon = e.icon;
              return (
                <motion.div key={i} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.02 }} className="relative">
                  <span className={`absolute -left-[18px] top-2 grid h-4 w-4 place-items-center rounded-full ${toneCls}`}>
                    <Icon className="h-2.5 w-2.5" />
                  </span>
                  <div className="rounded-xl border bg-card/60 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{e.text}</span>
                      <span className="text-[10px] text-muted-foreground">{new Date(e.at).toLocaleString("en-IN")}</span>
                    </div>
                    {e.detail && <p className="mt-0.5 text-xs text-muted-foreground">{e.detail}</p>}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </GlassCard>
    </div>
  );
}

