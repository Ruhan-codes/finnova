// Banking-style anomaly popup. Watches persisted alerts and pops the newest
// pending high/medium anomaly on every signed-in device.
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, ShieldAlert, Snowflake, Phone, FileText, X, Loader2, Mail, Clock } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useAlerts, useResolveAlert } from "@/lib/finance/alertsStore";
import { inr } from "@/lib/finance/format";

const SEEN_KEY = "fg-anomaly-modal-dismissed";

function readDismissed(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    return new Set(JSON.parse(sessionStorage.getItem(SEEN_KEY) ?? "[]"));
  } catch {
    return new Set();
  }
}
function writeDismissed(ids: Set<string>) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(SEEN_KEY, JSON.stringify([...ids]));
}

export function AnomalyModal() {
  const { data: alerts = [] } = useAlerts();
  const resolve = useResolveAlert();
  const [dismissed, setDismissed] = useState<Set<string>>(() => readDismissed());
  const [showRecs, setShowRecs] = useState(false);
  const [showEmail, setShowEmail] = useState(false);
  const [busy, setBusy] = useState<null | "confirmed" | "disputed">(null);

  const pending = useMemo(
    () => alerts.filter((a) => a.status === "pending" && !dismissed.has(a.id)),
    [alerts, dismissed],
  );
  const active = pending[0];

  // Sound / toast when a new one appears in the background (currently-open modal owns focus).
  useEffect(() => {
    if (!active) return;
    toast.warning(`Unusual activity: ${active.merchant} · ${inr(active.actual)}`, { id: `anomaly-${active.id}` });
    setShowRecs(false);
    setShowEmail(false);
  }, [active?.id]);

  if (!active) return null;

  const dismiss = () => {
    const next = new Set(dismissed);
    next.add(active.id);
    setDismissed(next);
    writeDismissed(next);
    setShowRecs(false);
  };

  const handleConfirm = async () => {
    setBusy("confirmed");
    try {
      await resolve.mutateAsync({
        alertId: active.id,
        transactionId: active.transactionId,
        decision: "confirmed",
      });
      toast.success("Thanks — marked as legitimate.");
      dismiss();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update the alert.");
    } finally {
      setBusy(null);
    }
  };

  const handleDispute = async () => {
    if (!showRecs) {
      setShowRecs(true);
      return;
    }
    setBusy("disputed");
    try {
      await resolve.mutateAsync({
        alertId: active.id,
        transactionId: active.transactionId,
        decision: "disputed",
      });
      toast.success("Dispute opened. Follow the steps to protect your account.");
      dismiss();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't open a dispute.");
    } finally {
      setBusy(null);
    }
  };

  const sevBg =
    active.severity === "High"
      ? "bg-destructive/10 text-destructive"
      : active.severity === "Medium"
        ? "bg-warning/10 text-warning"
        : "bg-brand/10 text-brand";

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] grid place-items-center bg-black/50 p-4 backdrop-blur-sm"
      >
        <motion.div
          initial={{ scale: 0.95, y: 12, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="w-full max-w-lg overflow-hidden rounded-3xl border bg-card shadow-2xl"
        >
          <div className={`flex items-center justify-between px-6 py-4 ${sevBg}`}>
            <div className="flex items-center gap-2 text-sm font-semibold">
              <ShieldAlert className="h-4 w-4" />
              {active.severity} risk · Unusual transaction detected
              {pending.length > 1 && (
                <span className="ml-2 rounded-full bg-black/10 px-2 py-0.5 text-[10px] font-semibold">
                  1 of {pending.length}
                </span>
              )}
            </div>
            <button
              onClick={dismiss}
              className="rounded-lg p-1 hover:bg-black/10"
              aria-label="Dismiss"
              disabled={!!busy}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-5 p-6">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Merchant</p>
              <p className="mt-1 text-xl font-semibold">{active.merchant}</p>
              <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                {new Date(active.createdAt).toLocaleString("en-IN", {
                  weekday: "short", day: "numeric", month: "short", year: "numeric",
                  hour: "2-digit", minute: "2-digit",
                })}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <Stat label="Expected" value={inr(active.expected)} />
              <Stat label="Actual" value={inr(active.actual)} tone="text-destructive" />
              <Stat label="Deviation" value={`+${Math.round(active.deviation)}%`} tone="text-warning" />
              <Stat label="AI Confidence" value={`${Math.round(active.confidence)}%`} tone="text-brand" />
              <Stat label="Risk Score" value={`${Math.min(100, Math.round(active.deviation))}/100`} />
              <Stat label="Severity" value={active.severity} />
            </div>

            <div className="rounded-2xl border bg-secondary/40 p-4 text-sm">
              <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <AlertTriangle className="h-3.5 w-3.5" /> Why we flagged it
              </div>
              <p>{active.aiExplanation || active.reason}</p>
            </div>

            {active.notificationHtml && (
              <button
                onClick={() => setShowEmail((v) => !v)}
                className="flex w-full items-center justify-center gap-2 rounded-xl border bg-secondary/40 py-2 text-xs font-medium hover:bg-secondary"
              >
                <Mail className="h-3.5 w-3.5" />
                {showEmail ? "Hide" : "Preview"} email notification
              </button>
            )}
            <AnimatePresence>
              {showEmail && active.notificationHtml && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 320 }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden rounded-2xl border bg-white"
                >
                  <iframe
                    title="anomaly-email-preview"
                    srcDoc={active.notificationHtml}
                    className="h-[320px] w-full border-0"
                    sandbox=""
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {showRecs && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="space-y-2 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm"
                >
                  <p className="font-semibold text-destructive">Fraud suspected — recommended next steps</p>
                  <Rec icon={<Snowflake className="h-4 w-4" />} text="Freeze your card immediately in your banking app." />
                  <Rec icon={<Phone className="h-4 w-4" />} text="Call your bank's fraud helpline to block further charges." />
                  <Rec icon={<FileText className="h-4 w-4" />} text="Raise a formal dispute for this transaction." />
                  <Rec icon={<AlertTriangle className="h-4 w-4" />} text="Review the last 24 hours of activity for anything else unfamiliar." />
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                onClick={handleConfirm}
                disabled={!!busy}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
              >
                {busy === "confirmed" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Yes, this was me
              </button>
              <button
                onClick={handleDispute}
                disabled={!!busy}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-destructive py-2.5 text-sm font-semibold text-white transition hover:bg-destructive/90 disabled:opacity-60"
              >
                {busy === "disputed" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldAlert className="h-4 w-4" />}
                {showRecs ? "Confirm — mark as Fraud Suspected" : "No, I didn't make this"}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function Stat({ label, value, tone = "text-foreground" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl border bg-card/50 p-2.5 text-center">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-0.5 text-sm font-semibold ${tone}`}>{value}</p>
    </div>
  );
}

function Rec({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 text-destructive">{icon}</span>
      <span>{text}</span>
    </div>
  );
}
