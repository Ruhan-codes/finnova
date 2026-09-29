import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, ShieldCheck, Sparkles, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { auth } from "@/lib/finance/auth";

export const Route = createFileRoute("/onboarding")({
  head: () => ({ meta: [{ title: "Get started — FinGuard AI" }, { name: "description", content: "Personalize your FinGuard AI assistant." }] }),
  component: Onboarding,
});

const STEPS = [
  "Connecting Device...",
  "Establishing Secure Channel...",
  "Preparing AI...",
  "Importing Transaction History...",
  "Loading Financial Profile...",
];

function Onboarding() {
  const nav = useNavigate();
  const [step, setStep] = useState<"welcome" | "permission" | "loading">("welcome");
  const [i, setI] = useState(0);

  useEffect(() => {
    if (step !== "loading") return;
    if (i >= STEPS.length) {
      const t = setTimeout(async () => {
        await auth.markOnboarded();
        nav({ to: "/import" });
      }, 400);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setI((v) => v + 1), 900);
    return () => clearTimeout(t);
  }, [step, i, nav]);

  return (
    <div className="grid min-h-screen place-items-center bg-background px-6">
      <motion.div layout className="glass w-full max-w-lg rounded-3xl p-8">
        <AnimatePresence mode="wait">
          {step === "welcome" && (
            <motion.div key="welcome" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <div className="grid h-12 w-12 place-items-center rounded-2xl gradient-brand text-white">
                <Sparkles className="h-6 w-6" />
              </div>
              <h1 className="mt-6 text-2xl font-semibold">Welcome to FinGuard AI</h1>
              <p className="mt-2 text-muted-foreground">Let's personalize your AI Financial Assistant.</p>
              <button
                onClick={() => setStep("permission")}
                className="mt-8 w-full rounded-xl gradient-brand py-3 text-sm font-medium text-white"
              >
                Continue
              </button>
            </motion.div>
          )}
          {step === "permission" && (
            <motion.div key="permission" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-brand/15 text-brand">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <h1 className="mt-6 text-2xl font-semibold">Allow Transaction Synchronization</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                FinGuard AI analyzes your transaction history to provide spending insights, detect unusual financial activity, monitor budgets, and deliver proactive alerts.
              </p>
              <div className="mt-8 flex gap-3">
                <button
                  onClick={async () => { await auth.markOnboarded(); nav({ to: "/import" }); }}
                  className="flex-1 rounded-xl border py-3 text-sm font-medium hover:bg-secondary"
                >
                  Skip
                </button>
                <button
                  onClick={() => setStep("loading")}
                  className="flex-1 rounded-xl gradient-brand py-3 text-sm font-medium text-white shadow-md"
                >
                  Allow
                </button>
              </div>
            </motion.div>
          )}
          {step === "loading" && (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <h1 className="text-xl font-semibold">Setting things up…</h1>
              <div className="mt-6 space-y-3">
                {STEPS.map((s, idx) => (
                  <div key={s} className="flex items-center gap-3 text-sm">
                    {idx < i ? (
                      <CheckCircle2 className="h-4 w-4 text-success" />
                    ) : idx === i ? (
                      <Loader2 className="h-4 w-4 animate-spin text-brand" />
                    ) : (
                      <span className="h-4 w-4 rounded-full border" />
                    )}
                    <span className={idx <= i ? "text-foreground" : "text-muted-foreground"}>{s}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
