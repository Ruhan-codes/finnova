import { createFileRoute } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, Mail, X, ShieldAlert, CheckCircle2, Clock, AlertTriangle, RefreshCw } from "lucide-react";
import { useState } from "react";
import { GlassCard } from "@/components/finance/GlassCard";
import { StatCard } from "@/components/finance/StatCard";
import { useAlerts, useRetryAlertEmail } from "@/lib/finance/alertsStore";
import type { PersistedAlert } from "@/lib/finance/alerts.functions";
import { inr } from "@/lib/finance/format";

export const Route = createFileRoute("/app/alerts")({
  head: () => ({ meta: [{ title: "Alerts — FinGuard AI" }, { name: "description", content: "Your alert center." }] }),
  component: Alerts,
});

function DeliveryBadge({ a }: { a: PersistedAlert }) {
  const s = a.delivery.status;
  const cls =
    s === "sent"
      ? "bg-emerald-500/15 text-emerald-500"
      : s === "failed"
        ? "bg-destructive/15 text-destructive"
        : "bg-amber-500/15 text-amber-500";
  const Icon = s === "sent" ? CheckCircle2 : s === "failed" ? AlertTriangle : Clock;
  const label = s === "sent" ? "Email sent" : s === "failed" ? "Email failed" : "Email pending";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${cls}`}>
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}

function Alerts() {
  const { data: alerts = [] } = useAlerts();
  const retry = useRetryAlertEmail();
  const [selected, setSelected] = useState<PersistedAlert | null>(null);
  const counts = {
    High: alerts.filter((a) => a.severity === "High").length,
    Medium: alerts.filter((a) => a.severity === "Medium").length,
    Resolved: alerts.filter((a) => a.status === "confirmed" || a.status === "resolved").length,
    Pending: alerts.filter((a) => a.status === "pending").length,
  };
  const emailFailed = alerts.filter((a) => a.delivery.status === "failed");
  const lastError = emailFailed[0]?.delivery.error ?? null;

  const risk = (r: string) => r === "High" ? "text-destructive bg-destructive/15" : r === "Medium" ? "text-warning bg-warning/15" : "text-brand bg-brand/15";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Alert Center</h1>
        <p className="mt-1 text-sm text-muted-foreground">Every AI-detected anomaly on your linked feed — synced across all your devices in real time. Real email delivery is triggered automatically for each new anomaly.</p>
      </div>

      {lastError && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm">
          <div className="flex items-center gap-2 font-medium text-amber-600">
            <AlertTriangle className="h-4 w-4" /> Email delivery unavailable
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {lastError}. Alerts are still created and synced in real time. Once a verified sender is configured, retries will succeed automatically.
          </p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="High Risk" value={counts.High} icon={<Bell className="h-4 w-4" />} tone="danger" />
        <StatCard label="Medium Risk" value={counts.Medium} icon={<Bell className="h-4 w-4" />} tone="warning" />
        <StatCard label="Resolved" value={counts.Resolved} icon={<Bell className="h-4 w-4" />} tone="success" />
        <StatCard label="Pending" value={counts.Pending} icon={<Bell className="h-4 w-4" />} />
      </div>

      <GlassCard>
        <h3 className="mb-4 text-sm font-semibold">Notification History</h3>
        {alerts.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No AI alerts yet. Run a Live Sync to see them appear here instantly.</p>}
        <ul className="space-y-2">
          {alerts.map((a, i) => (
            <motion.li key={a.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
              onClick={() => setSelected(a)}
              className="flex cursor-pointer flex-wrap items-center gap-3 rounded-xl border bg-card/60 p-3 hover:bg-secondary/50"
            >
              <div className={`grid h-9 w-9 place-items-center rounded-lg ${risk(a.severity)}`}><ShieldAlert className="h-4 w-4" /></div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">Unusual spend at {a.merchant}</p>
                <p className="truncate text-xs text-muted-foreground">{a.reason}</p>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${risk(a.severity)}`}>{a.severity}</span>
              <DeliveryBadge a={a} />
              {a.delivery.status === "failed" && (
                <button
                  onClick={(e) => { e.stopPropagation(); retry.mutate(a.id); }}
                  disabled={retry.isPending}
                  className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] hover:bg-secondary"
                >
                  <RefreshCw className="h-3 w-3" /> Retry
                </button>
              )}
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{a.status}</span>
              <span className="text-[10px] text-muted-foreground">{new Date(a.createdAt).toLocaleString("en-IN")}</span>
            </motion.li>
          ))}
        </ul>
      </GlassCard>

      <AnimatePresence>
        {selected && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={() => setSelected(null)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
              className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[min(720px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-3xl border bg-card shadow-2xl"
            >
              <div className="flex items-center justify-between border-b bg-secondary/60 px-6 py-4">
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-brand" />
                  <span className="font-medium">
                    Email {selected.delivery.status === "sent" ? `sent · ${new Date(selected.delivery.sentAt!).toLocaleString("en-IN")}` : selected.delivery.status === "failed" ? "failed — showing in-app copy" : "pending"}
                  </span>
                </div>
                <button onClick={() => setSelected(null)} className="rounded-lg p-1 hover:bg-background"><X className="h-4 w-4" /></button>
              </div>
              <div className="max-h-[70vh] space-y-4 overflow-y-auto p-6">
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <Kv k="Expected" v={inr(selected.expected)} />
                  <Kv k="Actual" v={inr(selected.actual)} />
                  <Kv k="Deviation" v={`+${Math.round(selected.deviation)}%`} />
                </div>
                {selected.delivery.status === "failed" && selected.delivery.error && (
                  <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
                    {selected.delivery.error}
                  </div>
                )}
                {selected.notificationHtml ? (
                  <iframe title="Email preview" srcDoc={selected.notificationHtml} className="h-[420px] w-full rounded-2xl border bg-white" />
                ) : (
                  <div className="rounded-2xl border bg-background p-5 text-sm">{selected.aiExplanation}</div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function Kv({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-lg bg-secondary/50 p-2">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{k}</p>
      <p className="text-sm font-medium">{v}</p>
    </div>
  );
}
