import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Sparkles, TrendingUp, AlertCircle, CheckCircle2, Info } from "lucide-react";
import { useMemo, useState } from "react";
import { GlassCard } from "@/components/finance/GlassCard";
import { useAnalytics } from "@/lib/finance/store";
import { inr } from "@/lib/finance/format";
import { buildBudgetCoach, type CoachCategory } from "@/lib/finance/insights";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/app/budget")({
  head: () => ({ meta: [{ title: "AI Budget Coach — FinGuard AI" }, { name: "description", content: "AI-generated budget coach with per-category advice." }] }),
  component: Budget,
});

function Budget() {
  const { t } = useI18n();
  const a = useAnalytics();
  const suggestedIncome = a.averages.monthlyIncome || 0;
  const suggestedSavings = Math.max(0, Math.round(suggestedIncome * 0.2));
  const [income, setIncome] = useState(suggestedIncome);
  const [savingsGoal, setGoal] = useState(suggestedSavings);
  const coach = useMemo(() => buildBudgetCoach(a, income, savingsGoal), [a, income, savingsGoal]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground sm:text-xs">AI Budget Coach</p>
        <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">{t("budget")}</h1>
        <p className="mt-1 text-xs text-muted-foreground sm:text-sm">Personalised guidance built from {a.monthCount} month(s) of your data.</p>
      </div>

      {/* AI Budget Coach headline */}
      <GlassCard className="border-brand/30 bg-brand/5">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl gradient-brand text-white">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-brand">{t("ai_budget_coach")}</p>
            <p className="mt-1 text-sm sm:text-base">{coach.headline}</p>
          </div>
        </div>
      </GlassCard>

      <div className="grid gap-4 md:grid-cols-2">
        <GlassCard>
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">Monthly Income</span>
            <input type="number" value={income} onChange={(e) => setIncome(+e.target.value)}
              className="mt-1 w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand/40" />
            <span className="mt-1 block text-[11px] text-muted-foreground">Suggested from your data: {inr(suggestedIncome)}</span>
          </label>
        </GlassCard>
        <GlassCard>
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">Savings Goal</span>
            <input type="number" value={savingsGoal} onChange={(e) => setGoal(+e.target.value)}
              className="mt-1 w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand/40" />
            <span className="mt-1 block text-[11px] text-muted-foreground">20% of income = {inr(suggestedSavings)}</span>
          </label>
        </GlassCard>
      </div>

      {!a.hasData && (
        <GlassCard className="py-10 text-center">
          <Info className="mx-auto h-8 w-8 text-brand" />
          <p className="mt-3 text-sm font-medium">Import transactions to activate your AI Budget Coach.</p>
          <p className="mt-1 text-xs text-muted-foreground">Once you sync your data we'll generate a per-category coach with monthly advice.</p>
        </GlassCard>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {coach.categories.map((c, i) => (
          <motion.div key={c.name} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
            <CategoryCard c={c} t={t} />
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function CategoryCard({ c, t }: { c: CoachCategory; t: (k: string) => string }) {
  const meta = c.status === "exceeded"
    ? { color: "bg-destructive", ring: "border-destructive/40", icon: <AlertCircle className="h-4 w-4 text-destructive" />, label: `🔴 ${t("exceeded")}`, tone: "text-destructive" }
    : c.status === "near_limit"
    ? { color: "bg-warning", ring: "border-warning/40", icon: <TrendingUp className="h-4 w-4 text-warning" />, label: `🟡 ${t("near_limit")}`, tone: "text-warning" }
    : { color: "bg-emerald-500", ring: "border-emerald-500/40", icon: <CheckCircle2 className="h-4 w-4 text-emerald-500" />, label: `🟢 ${t("on_track")}`, tone: "text-emerald-500" };
  return (
    <div className={`glass rounded-2xl border p-5 ${meta.ring}`}>
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{c.name}</p>
          <p className={`mt-0.5 text-xs font-medium ${meta.tone}`}>{meta.label}</p>
        </div>
        {meta.icon}
      </div>
      <div className="mb-3 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-secondary/50 p-2">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("allocated")}</p>
          <p className="mt-0.5 text-xs font-semibold tabular-nums">{inr(c.allocated)}</p>
        </div>
        <div className="rounded-lg bg-secondary/50 p-2">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("spent")}</p>
          <p className="mt-0.5 text-xs font-semibold tabular-nums">{inr(c.spent)}</p>
        </div>
        <div className="rounded-lg bg-secondary/50 p-2">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("remaining")}</p>
          <p className={`mt-0.5 text-xs font-semibold tabular-nums ${c.remaining < 0 ? "text-destructive" : ""}`}>{inr(c.remaining)}</p>
        </div>
      </div>
      <div className="mb-3 h-2 overflow-hidden rounded-full bg-secondary">
        <motion.div
          initial={{ width: 0 }} animate={{ width: `${Math.min(100, c.pct)}%` }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className={`h-full rounded-full ${meta.color}`}
        />
      </div>
      <div className="flex items-start gap-2 rounded-lg border border-brand/20 bg-brand/5 p-2.5">
        <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" />
        <p className="text-xs">{c.advice}</p>
      </div>
    </div>
  );
}
