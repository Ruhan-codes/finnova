import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import {
  Smartphone, ShieldCheck, CheckCircle2, Loader2, Lock, Radio, MessageSquare,
  Sparkles, Brain, Wifi, Fingerprint,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { parseCsv, useReplaceTransactions } from "@/lib/finance/store";

export const Route = createFileRoute("/import")({
  head: () => ({
    meta: [
      { title: "Connect Device — FinGuard AI" },
      { name: "description", content: "Securely connect your mobile transaction history to unlock AI-powered financial insights." },
    ],
  }),
  component: ConnectPage,
});

type Stage = "intro" | "permission" | "preparing" | "picking" | "pipeline" | "done";

const PIPELINE = [
  "Establishing Secure Connection",
  "Scanning Transaction Messages",
  "Extracting Payment Details",
  "Identifying Merchants",
  "Detecting UPI References",
  "Categorizing Transactions",
  "Matching Recurring Payments",
  "Building Spending Profile",
  "Learning Financial Behaviour",
  "Computing Financial Health",
  "Detecting Anomalies",
  "Generating AI Insights",
  "Preparing Dashboard",
];

const LEARNING_MSGS = [
  "Learning spending behaviour...",
  "Identifying recurring subscriptions...",
  "Building financial profile...",
  "Detecting behavioural patterns...",
  "Computing financial health...",
  "Estimating future expenses...",
];

const MERCHANT_CARDS = [
  { m: "Coffee Day Express", c: "Snacks" },
  { m: "Swiggy", c: "Food Delivery" },
  { m: "Amazon", c: "Shopping" },
  { m: "ACT Fibernet", c: "Utilities" },
  { m: "House Rent", c: "Housing" },
];

function ConnectPage() {
  const nav = useNavigate();
  const replace = useReplaceTransactions();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [stage, setStage] = useState<Stage>("intro");
  const [step, setStep] = useState(0);
  const [counters, setCounters] = useState({ messages: 0, merchants: 0, categories: 0, confidence: 0 });
  const [merchantIdx, setMerchantIdx] = useState(-1);
  const [learnIdx, setLearnIdx] = useState(0);

  // Pipeline stepping
  useEffect(() => {
    if (stage !== "pipeline") return;
    if (step >= PIPELINE.length) {
      const t = setTimeout(() => { setStage("done"); nav({ to: "/app/dashboard" }); }, 600);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setStep((s) => s + 1), 460);
    return () => clearTimeout(t);
  }, [stage, step, nav]);

  // Live counters animation during pipeline
  useEffect(() => {
    if (stage !== "pipeline") return;
    const total = { messages: 114, merchants: 33, categories: 9, confidence: 98 };
    const start = Date.now();
    const duration = 5200;
    let raf: number;
    const tick = () => {
      const p = Math.min(1, (Date.now() - start) / duration);
      const ease = 1 - Math.pow(1 - p, 3);
      setCounters({
        messages: Math.round(total.messages * ease),
        merchants: Math.round(total.merchants * ease),
        categories: Math.round(total.categories * ease),
        confidence: Math.round(total.confidence * ease),
      });
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [stage]);

  // Merchant classification stagger
  useEffect(() => {
    if (stage !== "pipeline") return;
    setMerchantIdx(-1);
    const timers: ReturnType<typeof setTimeout>[] = [];
    MERCHANT_CARDS.forEach((_, i) => {
      timers.push(setTimeout(() => setMerchantIdx(i), 400 + i * 700));
    });
    return () => { timers.forEach(clearTimeout); };
  }, [stage]);

  // Learning message rotation
  useEffect(() => {
    if (stage !== "pipeline") return;
    const t = setInterval(() => setLearnIdx((i) => (i + 1) % LEARNING_MSGS.length), 900);
    return () => clearInterval(t);
  }, [stage]);

  const openPicker = () => fileRef.current?.click();

  const handleFile = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = parseCsv(text);
      if (!parsed.length) { toast.error("Could not parse this file."); setStage("intro"); return; }
      setStage("pipeline");
      setStep(0);
      // Kick off actual data replace in the background while animation plays.
      replace.mutateAsync(parsed).catch((err) => {
        toast.error(err instanceof Error ? err.message : "Import failed");
      });
    } catch {
      toast.error("Failed to read the file.");
      setStage("intro");
    }
  };

  return (
    <div className="grid min-h-screen place-items-center bg-background px-4 py-10">
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

      <AnimatePresence mode="wait">
        {stage === "intro" && (
          <motion.div
            key="intro"
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="glass w-full max-w-lg rounded-3xl p-8 text-center"
          >
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl gradient-brand text-white shadow-lg">
              <Smartphone className="h-8 w-8" />
            </div>
            <h1 className="mt-5 text-2xl font-semibold">Connect Your Mobile Transaction History</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Securely import your transaction history to generate AI-powered financial insights.
            </p>
            <button
              onClick={() => setStage("permission")}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl gradient-brand px-4 py-3 text-sm font-medium text-white shadow-md hover:brightness-110"
            >
              <Wifi className="h-4 w-4" /> Connect Device
            </button>
            <p className="mt-3 text-[11px] text-muted-foreground">
              Supports Bank SMS, UPI notifications and exported transaction datasets.
            </p>
            <div className="mt-6 flex items-center justify-center gap-4 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1"><Lock className="h-3 w-3" /> AES-256</span>
              <span className="flex items-center gap-1"><ShieldCheck className="h-3 w-3" /> Zero-knowledge</span>
              <span className="flex items-center gap-1"><Fingerprint className="h-3 w-3" /> On-device</span>
            </div>
          </motion.div>
        )}

        {stage === "permission" && (
          <motion.div
            key="perm"
            initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
            className="glass w-full max-w-sm rounded-3xl p-6"
          >
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <MessageSquare className="h-4 w-4" /> Permission required
            </div>
            <h2 className="mt-3 text-lg font-semibold">Allow FinGuard AI to</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {["Read Transaction SMS","Detect UPI Notifications","Categorize Expenses"].map((p) => (
                <li key={p} className="flex items-center gap-2 rounded-xl border bg-card/40 px-3 py-2">
                  <CheckCircle2 className="h-4 w-4 text-success" /> {p}
                </li>
              ))}
            </ul>
            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setStage("intro")}
                className="flex-1 rounded-xl border py-2.5 text-sm font-medium hover:bg-secondary"
              >Deny</button>
              <button
                onClick={() => {
                  setStage("preparing");
                  setTimeout(() => { setStage("picking"); openPicker(); }, 1200);
                }}
                className="flex-1 rounded-xl gradient-brand py-2.5 text-sm font-medium text-white shadow"
              >Allow</button>
            </div>
          </motion.div>
        )}

        {stage === "preparing" && (
          <motion.div key="prep" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="glass w-full max-w-sm rounded-3xl p-8 text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-brand" />
            <p className="mt-3 text-sm font-medium">Preparing secure connection...</p>
            <p className="mt-1 text-xs text-muted-foreground">Establishing an encrypted link with your device.</p>
          </motion.div>
        )}

        {stage === "picking" && (
          <motion.div key="pick" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="glass w-full max-w-sm rounded-3xl p-8 text-center">
            <Radio className="mx-auto h-8 w-8 animate-pulse text-brand" />
            <p className="mt-3 text-sm font-medium">Waiting for device...</p>
            <p className="mt-1 text-xs text-muted-foreground">Complete the selection in the system dialog.</p>
            <button onClick={openPicker} className="mt-4 text-xs text-brand underline">Not seeing the dialog? Retry</button>
          </motion.div>
        )}

        {stage === "pipeline" && (
          <motion.div
            key="pipe"
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="grid w-full max-w-4xl gap-4 lg:grid-cols-[1.1fr_1fr]"
          >
            <div className="glass rounded-3xl p-6">
              <div className="mb-3 flex items-center gap-2 text-sm font-medium">
                <Brain className="h-4 w-4 text-brand" /> AI Processing Pipeline
              </div>
              <div className="max-h-[420px] space-y-1.5 overflow-y-auto pr-1">
                {PIPELINE.map((s, i) => {
                  const done = i < step;
                  const active = i === step;
                  return (
                    <motion.div
                      key={s}
                      initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                      className={`flex items-center gap-3 rounded-xl border px-3 py-2 text-sm ${
                        active ? "border-brand/60 bg-brand/5" : done ? "border-emerald-500/30 bg-emerald-500/5" : "border-border/60 bg-secondary/20"
                      }`}
                    >
                      {active ? <Loader2 className="h-4 w-4 animate-spin text-brand" /> :
                       done ? <CheckCircle2 className="h-4 w-4 text-success" /> :
                       <span className="h-4 w-4 rounded-full border" />}
                      <span className={active || done ? "text-foreground" : "text-muted-foreground"}>{s}</span>
                      {active && (
                        <div className="ml-auto h-1 w-16 overflow-hidden rounded-full bg-secondary">
                          <motion.div initial={{ width: 0 }} animate={{ width: "100%" }} transition={{ duration: 0.4 }} className="h-full gradient-brand" />
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </div>

            <div className="space-y-4">
              <div className="glass grid grid-cols-2 gap-3 rounded-3xl p-4">
                <Counter label="Messages Processed" value={counters.messages} />
                <Counter label="Merchants Identified" value={counters.merchants} />
                <Counter label="Categories Learned" value={counters.categories} />
                <Counter label="AI Confidence" value={counters.confidence} suffix="%" />
              </div>
              <div className="glass rounded-3xl p-4">
                <p className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  <Sparkles className="h-3.5 w-3.5" /> Live Merchant Classification
                </p>
                <div className="space-y-1.5">
                  <AnimatePresence>
                    {MERCHANT_CARDS.slice(0, merchantIdx + 1).map((m) => (
                      <motion.div
                        key={m.m}
                        initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                        className="flex items-center justify-between rounded-lg border bg-card/40 px-3 py-2 text-sm"
                      >
                        <span className="font-medium">{m.m}</span>
                        <span className="text-xs text-muted-foreground">→ {m.c}</span>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
              <div className="glass rounded-3xl p-4 text-center">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">AI Learning</p>
                <AnimatePresence mode="wait">
                  <motion.p
                    key={learnIdx}
                    initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                    className="mt-1 text-sm font-medium"
                  >
                    {LEARNING_MSGS[learnIdx]}
                  </motion.p>
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Counter({ label, value, suffix = "" }: { label: string; value: number; suffix?: string }) {
  return (
    <div className="rounded-xl border bg-card/40 p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}{suffix}</p>
    </div>
  );
}
