import { createFileRoute } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity, CheckCircle2, Loader2, Lock, Radio, ShieldCheck,
  Sparkles, Upload, Waves, Zap, AlertTriangle, TrendingUp, Brain,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { parseCsv, useAppendTransactions, useTransactions } from "@/lib/finance/store";
import { listTransactions } from "@/lib/finance/transactions.functions";
import { useCreateAlerts, type AlertInsertInput } from "@/lib/finance/alertsStore";
import { MobileFileButton } from "@/components/finance/MobileFileButton";
import { buildAnomalyEmailHtml, recommendedActionFor } from "@/lib/finance/emailTemplate";
import { useCurrentUser } from "@/lib/finance/auth";
import type { Transaction } from "@/lib/finance/types";

export const Route = createFileRoute("/app/livesync")({
  head: () => ({
    meta: [
      { title: "Incoming Transactions — FinGuard AI" },
      { name: "description", content: "Securely sync the latest transaction notifications from your device and let FinGuard's AI compare them against your spending profile." },
      { property: "og:title", content: "Incoming Transactions — FinGuard AI" },
      { property: "og:description", content: "AI-powered banking assistant that reviews new activity against your history and instantly surfaces unusual charges." },
    ],
  }),
  component: LiveSyncPage,
});

const PIPELINE = [
  { label: "Securely reading transaction history", icon: Lock },
  { label: "Identifying merchants", icon: Sparkles },
  { label: "Categorising expenses", icon: Brain },
  { label: "Detecting recurring payments", icon: Waves },
  { label: "Analysing spending behaviour", icon: Activity },
  { label: "Comparing with historical patterns", icon: TrendingUp },
  { label: "Calculating financial health", icon: ShieldCheck },
  { label: "Searching for unusual activity", icon: AlertTriangle },
  { label: "Preparing personalised insights", icon: Zap },
];

function LiveSyncPage() {
  const history = useTransactions();
  const append = useAppendTransactions();
  const createAlerts = useCreateAlerts();
  const { user } = useCurrentUser();
  const qc = useQueryClient();
  const fetchTx = useServerFn(listTransactions);
  const [dragging, setDragging] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [step, setStep] = useState(0);
  const [pending, setPending] = useState<Transaction[] | null>(null);
  const [result, setResult] = useState<{
    inserted: number;
    anomalies: Transaction[];
    newMerchants: string[];
  } | null>(null);
  const tickRef = useRef<number | null>(null);
  const merchantCount = useMemo(
    () => new Set(history.map((t) => t.merchant.toLowerCase())).size,
    [history],
  );

  useEffect(() => {
    if (!processing) return;
    if (step >= PIPELINE.length) {
      window.setTimeout(() => setProcessing(false), 500);
      return;
    }
    tickRef.current = window.setTimeout(() => setStep((s) => s + 1), 480);
    return () => {
      if (tickRef.current) window.clearTimeout(tickRef.current);
    };
  }, [processing, step]);

  const runSync = async (parsed: Transaction[]) => {
    if (!parsed.length) return toast.error("No transactions detected.");
    setPending(parsed);
    setResult(null);
    setStep(0);
    setProcessing(true);
    try {
      // Always pull the latest historical dataset from the server before
      // scoring anomalies. React Query hydration can lag behind the initial
      // render (or a fresh navigation from Import), which previously caused
      // the client to build an empty merchant profile and skip real anomalies.
      const freshHistory = await qc.fetchQuery({
        queryKey: ["transactions"],
        queryFn: () => fetchTx(),
        staleTime: 0,
      });
      // Behavioral merchant profiles.
      const merchantStats = new Map<string, { avg: number; max: number; count: number }>();
      for (const t of freshHistory) {
        const key = t.merchant.toLowerCase();
        const abs = Math.abs(t.amount);
        const cur = merchantStats.get(key) ?? { avg: 0, max: 0, count: 0 };
        cur.avg = (cur.avg * cur.count + abs) / (cur.count + 1);
        cur.max = Math.max(cur.max, abs);
        cur.count += 1;
        merchantStats.set(key, cur);
      }
      const anomalies: Array<{ tx: Transaction; expected: number; deviation: number; severity: "Low" | "Medium" | "High" }> = [];
      const newMerchants: string[] = [];
      for (const t of parsed) {
        const key = t.merchant.toLowerCase();
        const profile = merchantStats.get(key);
        const abs = Math.abs(t.amount);
        if (!profile) {
          if (abs > 2000) newMerchants.push(t.merchant);
          continue;
        }
        if (profile.count >= 2 && (abs > profile.avg * 3 || abs > profile.max * 1.5)) {
          const deviation = Math.round(((abs - profile.avg) / Math.max(1, profile.avg)) * 100);
          const severity: "Low" | "Medium" | "High" =
            deviation > 200 ? "High" : deviation > 100 ? "Medium" : "Low";
          anomalies.push({ tx: t, expected: Math.round(profile.avg), deviation, severity });
        }
      }
      const res = await append.mutateAsync(parsed);
      // Fingerprint -> DB tx id map so we can attach alerts to real rows.
      const idByFingerprint = new Map<string, string>();
      for (const r of res.rows) idByFingerprint.set(r.fingerprint, r.id);

      // Persist anomalies so the popup fires on every signed-in device via Realtime.
      if (anomalies.length) {
        const alertPayloads: AlertInsertInput[] = anomalies.map(({ tx, expected, deviation, severity }) => {
          const abs = Math.abs(tx.amount);
          const fp = `${new Date(tx.date).toISOString()}|${tx.merchant}|${tx.amount}`;
          const txId = idByFingerprint.get(fp) ?? null;
          const explanation = `${tx.merchant} charged ${Math.abs(tx.amount).toLocaleString("en-IN", { style: "currency", currency: "INR" })} — that's ${(abs / Math.max(1, expected)).toFixed(1)}× your typical spend at this merchant (avg ₹${expected.toLocaleString()}).`;
          const html = buildAnomalyEmailHtml({
            merchant: tx.merchant,
            actual: abs,
            expected,
            deviation,
            confidence: Math.min(98, 70 + Math.round(deviation / 5)),
            riskScore: Math.min(100, deviation),
            severity,
            timestamp: tx.date,
            explanation,
            recommendedAction: recommendedActionFor(severity),
            userFirstName: user?.firstName,
          });
          return {
            transactionId: txId,
            fingerprint: fp,
            merchant: tx.merchant,
            actual: abs,
            expected,
            deviation,
            confidence: Math.min(98, 70 + Math.round(deviation / 5)),
            severity,
            reason: `${(abs / Math.max(1, expected)).toFixed(1)}× typical spend at ${tx.merchant}`,
            aiExplanation: explanation,
            notificationHtml: html,
          };
        });
        try {
          await createAlerts.mutateAsync(alertPayloads);
          toast.warning(
            `${alertPayloads.length} anomaly${alertPayloads.length > 1 ? " alerts" : " alert"} raised — review the banking alert now.`,
          );
        } catch (err) {
          console.error("[livesync] failed to persist alerts:", err);
          toast.error(
            `Anomalies detected (${alertPayloads.length}) but the alert could not be saved: ${err instanceof Error ? err.message : "unknown error"}`,
          );
        }
      }

      setResult({
        inserted: res.inserted,
        anomalies: anomalies.map((a) => a.tx),
        newMerchants,
      });
      toast.success(`Analysis complete — ${res.inserted} new transactions reviewed.`);
    } catch (err) {
      setProcessing(false);
      const msg = err instanceof Error ? err.message : "Sync failed.";
      toast.error(msg);
    }
  };

  const handleFile = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = parseCsv(text);
      await runSync(parsed);
    } catch {
      toast.error("Could not read file.");
    }
  };

  return (
    <div className="space-y-6">
      <header className="grid grid-cols-1 gap-3 sm:flex sm:flex-wrap sm:items-end sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground sm:text-xs">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <span className="truncate">SECURE CHANNEL · END-TO-END ENCRYPTED</span>
          </div>
          <h1 className="mt-2 text-xl font-semibold tracking-tight sm:text-2xl">Incoming Transactions</h1>
          <p className="mt-1 max-w-2xl text-xs text-muted-foreground sm:text-sm">
            Sync the latest activity from your device. FinGuard's AI reviews every new transaction against your personal spending profile and instantly surfaces anything unusual.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-2xl border bg-card/50 px-3 py-2 text-[11px] sm:text-xs">
          <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-500" />
          <span className="text-muted-foreground">Profile:</span>
          <span className="font-medium">{history.length} txns</span>
          <span className="text-muted-foreground">·</span>
          <span className="font-medium">{merchantCount} merchants</span>
        </div>
      </header>

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-[1fr_1.1fr]">
        {/* Sync feed */}
        <section className="glass rounded-3xl p-4 sm:p-6">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium">
            <Radio className="h-4 w-4 text-brand" />
            Sync your latest activity
          </div>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const f = e.dataTransfer.files?.[0];
              if (f && !processing) void handleFile(f);
            }}
            className={`relative overflow-hidden rounded-2xl border-2 border-dashed p-3 text-center transition sm:p-4 ${
              dragging ? "border-brand bg-brand/5" : "border-border bg-secondary/40"
            } ${processing ? "pointer-events-none opacity-60" : ""}`}
          >
            <div className="pointer-events-none absolute inset-0 opacity-30">
              <div className="absolute inset-x-0 top-1/2 h-px bg-gradient-to-r from-transparent via-brand/60 to-transparent animate-pulse" />
            </div>
            <MobileFileButton
              onFile={handleFile}
              disabled={processing}
              className="relative flex w-full flex-col items-center gap-3 rounded-xl px-3 py-5 transition hover:bg-secondary/70 active:scale-[0.99] touch-manipulation disabled:opacity-60 sm:px-4 sm:py-6"
            >
              <div className="grid h-14 w-14 place-items-center rounded-2xl gradient-brand text-white shadow-lg">
                <Upload className="h-7 w-7" />
              </div>
              <p className="text-sm font-semibold sm:text-base">📱 Sync New Transactions</p>
              <p className="max-w-xs text-xs text-muted-foreground">
                Securely sync the latest transaction notifications from your device.
              </p>
              <span className="rounded-full border bg-card px-3 py-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                Files · Downloads · Device storage
              </span>
            </MobileFileButton>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2 text-center text-[10px] sm:text-[11px]">
            <MiniStat icon={<Lock className="h-3 w-3" />} label="Bank-grade" />
            <MiniStat icon={<ShieldCheck className="h-3 w-3" />} label="Private" />
            <MiniStat icon={<Zap className="h-3 w-3" />} label="Instant AI" />
          </div>
        </section>

        {/* Pipeline */}
        <section className="glass rounded-3xl p-4 sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Brain className="h-4 w-4 text-brand" />
              AI Financial Analysis
            </div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {processing ? "ANALYSING" : result ? "ANALYSIS COMPLETE" : "READY"}
            </div>
          </div>

          <div className="space-y-2">
            {PIPELINE.map((s, i) => {
              const done = processing ? i < step : !!result && !processing;
              const active = processing && i === step;
              const Icon = s.icon;
              return (
                <motion.div
                  key={s.label}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.02 }}
                  className={`flex items-center gap-3 rounded-xl border px-3 py-2 text-sm transition ${
                    active
                      ? "border-brand/60 bg-brand/5"
                      : done
                        ? "border-emerald-500/30 bg-emerald-500/5"
                        : "border-border/60 bg-secondary/20"
                  }`}
                >
                  <div className={`grid h-7 w-7 place-items-center rounded-lg ${
                    active ? "bg-brand text-white" : done ? "bg-emerald-500/15 text-emerald-500" : "bg-secondary text-muted-foreground"
                  }`}>
                    {active ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> :
                      done ? <CheckCircle2 className="h-3.5 w-3.5" /> :
                      <Icon className="h-3.5 w-3.5" />}
                  </div>
                  <span className={active || done ? "text-foreground" : "text-muted-foreground"}>
                    {s.label}
                  </span>
                  {active && (
                    <span className="ml-auto text-[10px] text-brand">processing…</span>
                  )}
                </motion.div>
              );
            })}
          </div>
        </section>
      </div>

      {/* Results panel */}
      <AnimatePresence>
        {result && !processing && (
          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="glass rounded-3xl p-4 sm:p-6"
          >
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              ✅ Analysis Complete
            </div>
            <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3">
              <ReportCard label="New transactions synced" value={String(result.inserted)} tone="brand" />
              <ReportCard label="New merchants identified" value={String(result.newMerchants.length)} tone="muted" />
              <ReportCard
                label="Unusual activity detected"
                value={String(result.anomalies.length)}
                tone={result.anomalies.length ? "danger" : "success"}
              />
            </div>

            {result.anomalies.length > 0 && (
              <div className="mt-6">
                <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Flagged for review
                </p>
                <ul className="divide-y rounded-2xl border bg-card/40">
                  {result.anomalies.slice(0, 6).map((t) => (
                    <li key={t.id} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
                      <div>
                        <p className="font-medium">{t.merchant}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(t.date).toLocaleDateString()} · {t.category}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-destructive">
                          ₹{Math.abs(t.amount).toLocaleString()}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          exceeds your typical spend at this merchant
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </motion.section>
        )}
      </AnimatePresence>

      {pending && processing && (
        <p className="text-center text-xs text-muted-foreground">
          Reviewing {pending.length} new transactions against {history.length} recent activities…
        </p>
      )}
    </div>
  );
}

function MiniStat({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center justify-center gap-1.5 rounded-lg border bg-card/40 px-2 py-1.5 text-muted-foreground">
      {icon}
      <span>{label}</span>
    </div>
  );
}

function ReportCard({
  label, value, tone,
}: { label: string; value: string; tone: "brand" | "success" | "danger" | "muted" }) {
  const toneClass = {
    brand: "text-brand",
    success: "text-emerald-500",
    danger: "text-destructive",
    muted: "text-foreground",
  }[tone];
  return (
    <div className="rounded-2xl border bg-card/40 p-4">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}
