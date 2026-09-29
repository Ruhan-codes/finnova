import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { AlertTriangle, ShieldAlert, TrendingUp, ShieldCheck, CheckCircle2 } from "lucide-react";
import { GlassCard } from "@/components/finance/GlassCard";
import { useAnalytics } from "@/lib/finance/store";
import { inr, shortDate } from "@/lib/finance/format";

export const Route = createFileRoute("/app/anomalies")({
  head: () => ({ meta: [{ title: "Anomalies — FinGuard AI" }, { name: "description", content: "AI-detected spending anomalies with confidence and suggested actions." }] }),
  component: Anomalies,
});

function Anomalies() {
  const items = useAnalytics().anomalies;
  const toneFor = (r: string) => r === "High" ? "border-destructive/40 bg-destructive/5" : r === "Medium" ? "border-warning/40 bg-warning/5" : "border-brand/30 bg-brand/5";
  const iconFor = (r: string) => r === "High" ? "text-destructive" : r === "Medium" ? "text-warning" : "text-brand";
  const suggestedAction = (r: string, merchant: string) =>
    r === "High" ? `Verify if this purchase at ${merchant} was intentional. If not, dispute immediately.`
    : r === "Medium" ? `Confirm the transaction and set a monthly cap for ${merchant} if this becomes a pattern.`
    : `Review the transaction — it may be a legitimate one-off.`;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-destructive/15 text-destructive"><ShieldAlert className="h-5 w-5" /></div>
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold sm:text-3xl">Anomaly Detection</h1>
          <p className="text-xs text-muted-foreground sm:text-sm">Every anomaly explained — with confidence, reason, and next action.</p>
        </div>
      </div>

      {items.length === 0 && (
        <GlassCard className="py-10 text-center">
          <ShieldCheck className="mx-auto h-8 w-8 text-emerald-500" />
          <p className="mt-3 text-sm font-medium">No anomalies detected in your current dataset.</p>
          <p className="mt-1 text-xs text-muted-foreground">Your spending patterns look consistent. We'll notify you the moment something looks off.</p>
        </GlassCard>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {items.map((a, i) => (
          <motion.div key={a.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <GlassCard className={`border-2 ${toneFor(a.risk)} space-y-3`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <AlertTriangle className={`mt-0.5 h-5 w-5 shrink-0 ${iconFor(a.risk)}`} />
                  <div className="min-w-0">
                    <p className="truncate text-lg font-semibold">{a.merchant}</p>
                    <p className="text-xs text-muted-foreground">{shortDate(a.date)}</p>
                  </div>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${iconFor(a.risk)} bg-secondary`}>{a.risk} Risk</span>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Stat label="Expected" value={inr(a.expected)} />
                <Stat label="Actual" value={inr(a.actual)} tone="text-destructive" />
                <Stat label="Deviation" value={`${a.deviation}%`} tone="text-warning" icon={<TrendingUp className="h-3 w-3" />} />
                <Stat label="Confidence" value={`${a.confidence}%`} tone="text-brand" />
              </div>

              <div className="rounded-lg border bg-card/40 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Why flagged</p>
                <p className="mt-1 text-sm">{a.reason}</p>
              </div>

              <div className="flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Suggested Action</p>
                  <p className="mt-0.5 text-sm">{suggestedAction(a.risk, a.merchant)}</p>
                </div>
              </div>
            </GlassCard>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value, tone, icon }: { label: string; value: string; tone?: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-secondary/50 p-2 text-center">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-0.5 inline-flex items-center gap-1 text-sm font-semibold ${tone ?? ""}`}>{icon}{value}</p>
    </div>
  );
}
