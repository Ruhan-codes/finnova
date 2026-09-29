import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, FileUp, Loader2, MessageSquare, Upload, X } from "lucide-react";
import { useEffect, useState } from "react";
import { parseCsv, smsToCsv, useReplaceTransactions } from "@/lib/finance/store";
import { MobileFileButton } from "@/components/finance/MobileFileButton";
import { toast } from "sonner";

const AI_STEPS = [
  "Reading Transactions...",
  "Removing Duplicates...",
  "Detecting Merchants...",
  "Categorizing Expenses...",
  "Identifying Subscriptions...",
  "Computing Income & Expenses...",
  "Calculating Financial Health...",
  "Generating AI Insights...",
  "Finding Anomalies...",
];

export function UploadDialog({
  open,
  onClose,
  onComplete,
  title = "Import Transaction History",
  subtitle = "Upload a CSV export or paste SMS transaction alerts. We'll replace your current dataset and regenerate every insight.",
}: {
  open: boolean;
  onClose: () => void;
  onComplete?: () => void;
  title?: string;
  subtitle?: string;
}) {
  const [tab, setTab] = useState<"csv" | "sms">("csv");
  const [dragging, setDragging] = useState(false);
  const [smsText, setSmsText] = useState("");
  const [processing, setProcessing] = useState(false);
  const [step, setStep] = useState(0);
  const replace = useReplaceTransactions();

  useEffect(() => {
    if (!open) {
      setProcessing(false);
      setStep(0);
      setSmsText("");
      setTab("csv");
    }
  }, [open]);

  useEffect(() => {
    if (!processing) return;
    if (step >= AI_STEPS.length) {
      const t = setTimeout(() => {
        onComplete?.();
        onClose();
      }, 400);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setStep((v) => v + 1), 550);
    return () => clearTimeout(t);
  }, [processing, step, onComplete, onClose]);

  const runImport = async (txsRaw: ReturnType<typeof parseCsv>) => {
    if (!txsRaw.length) {
      toast.error("Couldn't detect any transactions to import.");
      return;
    }
    setProcessing(true);
    try {
      await replace.mutateAsync(txsRaw);
      toast.success(`Imported ${txsRaw.length} transactions — analytics regenerated.`);
    } catch (err) {
      setProcessing(false);
      const msg = err instanceof Error ? err.message : "Import failed";
      toast.error(msg);
    }
  };

  const handleFile = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = parseCsv(text);
      if (!parsed.length) return toast.error("Could not parse this CSV.");
      await runImport(parsed);
    } catch {
      toast.error("Failed to read the file.");
    }
  };

  const importFromSms = async () => {
    const csv = smsToCsv(smsText);
    if (!csv) return toast.error("Couldn't detect any transactions in the messages.");
    const parsed = parseCsv(csv);
    await runImport(parsed);
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 grid place-items-center bg-black/40 backdrop-blur-sm p-4"
        onClick={processing ? undefined : onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="glass w-full max-w-xl rounded-3xl p-8"
        >
          <div className="mb-4 flex items-start justify-between">
            <div>
              <h2 className="text-xl font-semibold">{processing ? "AI is processing your data" : title}</h2>
              <p className="mt-1 text-xs text-muted-foreground">{processing ? "Regenerating dashboard, insights, budget, subscriptions, anomalies and forecasts." : subtitle}</p>
            </div>
            {!processing && (
              <button onClick={onClose} className="rounded-lg p-2 hover:bg-secondary" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {!processing ? (
            <>
              <div className="mt-2 grid grid-cols-2 rounded-xl border p-1 text-sm">
                <button
                  onClick={() => setTab("csv")}
                  className={`flex items-center justify-center gap-2 rounded-lg py-2 transition ${tab === "csv" ? "bg-brand text-white shadow" : "hover:bg-secondary"}`}
                >
                  <Upload className="h-4 w-4" /> CSV file
                </button>
                <button
                  onClick={() => setTab("sms")}
                  className={`flex items-center justify-center gap-2 rounded-lg py-2 transition ${tab === "sms" ? "bg-brand text-white shadow" : "hover:bg-secondary"}`}
                >
                  <MessageSquare className="h-4 w-4" /> From messages
                </button>
              </div>
              {tab === "csv" ? (
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragging(false);
                    const f = e.dataTransfer.files?.[0];
                    if (f) void handleFile(f);
                  }}
                  className={`mt-4 rounded-2xl border-2 border-dashed p-6 text-center transition ${dragging ? "border-brand bg-brand/5" : "border-border bg-secondary/40"}`}
                >
                  <MobileFileButton
                    onFile={handleFile}
                    className="flex w-full flex-col items-center gap-3 rounded-xl px-4 py-6 text-center transition hover:bg-secondary/70 active:scale-[0.99] touch-manipulation"
                  >
                    <div className="grid h-14 w-14 place-items-center rounded-2xl gradient-brand text-white shadow-md">
                      <Upload className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Tap to choose a transaction file</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">or drag &amp; drop from your computer</p>
                    </div>
                    <span className="rounded-full border bg-card px-3 py-1 text-[10px] uppercase tracking-wider text-muted-foreground">Replaces current dataset</span>
                  </MobileFileButton>
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  <textarea
                    value={smsText}
                    onChange={(e) => setSmsText(e.target.value)}
                    placeholder={"Paste bank/UPI SMS alerts, one per line. Example:\nDebited Rs.380 at Swiggy on 02-05-2026 - Food\nCredited INR 75000 from Employer Payroll on 01-05-2026 - Salary"}
                    rows={8}
                    className="w-full resize-none rounded-2xl border bg-secondary/40 p-4 text-sm outline-none focus:ring-2 focus:ring-brand/40"
                  />
                  <button
                    onClick={importFromSms}
                    disabled={!smsText.trim()}
                    className="flex w-full items-center justify-center gap-2 rounded-xl gradient-brand py-2.5 text-sm font-medium text-white shadow-md disabled:opacity-50"
                  >
                    <FileUp className="h-4 w-4" /> Convert messages & import
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="mt-6 space-y-2.5">
              {AI_STEPS.map((s, idx) => (
                <motion.div
                  key={s}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.04 }}
                  className="flex items-center gap-3 text-sm"
                >
                  {idx < step ? <CheckCircle2 className="h-4 w-4 text-success" /> :
                    idx === step ? <Loader2 className="h-4 w-4 animate-spin text-brand" /> :
                    <span className="h-4 w-4 rounded-full border" />}
                  <span className={idx <= step ? "text-foreground" : "text-muted-foreground"}>{s}</span>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
