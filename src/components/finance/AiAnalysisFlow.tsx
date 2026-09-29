// Reusable "bank-style" AI analysis animation + Analysis Complete summary.
// Used by Dashboard sync and Incoming Transactions sync flows.
import { AnimatePresence, motion } from "framer-motion";
import {
  CheckCircle2, Loader2, ShieldCheck, Sparkles, X,
} from "lucide-react";
import { useEffect, useState } from "react";

export const ANALYSIS_STEPS = [
  "Securely reading transaction history",
  "Identifying merchants",
  "Categorising expenses",
  "Detecting recurring payments",
  "Analysing spending behaviour",
  "Comparing with historical patterns",
  "Calculating financial health",
  "Searching for unusual activity",
  "Preparing personalised insights",
];

export type AnalysisSummary = {
  transactions: number;
  merchants: number;
  categories: number;
  subscriptions: number;
  insights: number;
  anomalies: number;
};

export function AiAnalysisFlow({
  open,
  summary,
  onDone,
  title = "Analysing your financial activity",
  subtitle = "Your personalised AI financial analysis is running securely on-device.",
}: {
  open: boolean;
  summary: AnalysisSummary | null;
  onDone: () => void;
  title?: string;
  subtitle?: string;
}) {
  const [step, setStep] = useState(0);
  const [phase, setPhase] = useState<"processing" | "done">("processing");

  useEffect(() => {
    if (!open) { setStep(0); setPhase("processing"); return; }
  }, [open]);

  useEffect(() => {
    if (!open || phase !== "processing") return;
    if (step >= ANALYSIS_STEPS.length) {
      const t = setTimeout(() => setPhase("done"), 350);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setStep((s) => s + 1), 480);
    return () => clearTimeout(t);
  }, [open, step, phase]);

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-3 backdrop-blur-sm sm:p-4"
      >
        <motion.div
          initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }}
          className="glass w-full max-w-md rounded-3xl p-5 sm:p-7"
        >
          {phase === "processing" ? (
            <>
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl gradient-brand text-white">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="truncate text-base font-semibold sm:text-lg">{title}</h2>
                  <p className="mt-0.5 text-[11px] text-muted-foreground sm:text-xs">{subtitle}</p>
                </div>
              </div>
              <ul className="mt-5 space-y-2 sm:mt-6 sm:space-y-2.5">
                {ANALYSIS_STEPS.map((s, i) => {
                  const done = i < step;
                  const active = i === step;
                  return (
                    <motion.li
                      key={s}
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className="flex items-center gap-2.5 text-sm"
                    >
                      {done ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" /> :
                       active ? <Loader2 className="h-4 w-4 shrink-0 animate-spin text-brand" /> :
                       <span className="h-4 w-4 shrink-0 rounded-full border" />}
                      <span className={done || active ? "text-foreground" : "text-muted-foreground"}>
                        {done ? "✓ " : ""}{s}
                      </span>
                    </motion.li>
                  );
                })}
              </ul>
              <div className="mt-5 flex items-center justify-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                <ShieldCheck className="h-3 w-3 text-emerald-500" /> Bank-grade encryption · Fully on-device
              </div>
            </>
          ) : (
            <>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-500/15 text-emerald-500">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wider text-emerald-500">Complete</p>
                    <h2 className="truncate text-base font-semibold sm:text-lg">Analysis Complete</h2>
                  </div>
                </div>
                <button
                  onClick={onDone}
                  aria-label="Close"
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border hover:bg-secondary"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-2.5 sm:gap-3">
                <SummaryRow value={summary?.transactions ?? 0} label="Transactions Analysed" />
                <SummaryRow value={summary?.merchants ?? 0} label="Merchants Identified" />
                <SummaryRow value={summary?.categories ?? 0} label="Spending Categories" />
                <SummaryRow value={summary?.subscriptions ?? 0} label="Recurring Payments Detected" />
                <SummaryRow value={summary?.insights ?? 0} label="Smart Recommendations Generated" />
                <SummaryRow
                  value={summary?.anomalies ?? 0}
                  label={
                    (summary?.anomalies ?? 0) === 0
                      ? "No Unusual Activity Detected"
                      : (summary?.anomalies ?? 0) === 1
                        ? "High-Priority Alert Generated"
                        : "High-Priority Alerts Generated"
                  }
                  tone={(summary?.anomalies ?? 0) > 0 ? "warning" : "success"}
                />
              </div>

              <button
                onClick={onDone}
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl gradient-brand py-2.5 text-sm font-semibold text-white shadow-md"
              >
                View Updated Dashboard
              </button>
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function SummaryRow({
  value, label, tone = "neutral",
}: { value: number; label: string; tone?: "neutral" | "success" | "warning" }) {
  return (
    <div className={`rounded-xl border p-3 ${
      tone === "warning" ? "border-warning/40 bg-warning/5"
        : tone === "success" ? "border-emerald-500/30 bg-emerald-500/5"
          : "bg-secondary/40"
    }`}>
      <p className="text-lg font-bold tabular-nums sm:text-xl">{value}</p>
      <p className="mt-0.5 text-[11px] leading-tight text-muted-foreground">{label}</p>
    </div>
  );
}
