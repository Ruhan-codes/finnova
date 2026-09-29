import { createFileRoute } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X, AlertTriangle } from "lucide-react";
import { useMemo, useState } from "react";
import { GlassCard } from "@/components/finance/GlassCard";
import { useTransactions } from "@/lib/finance/store";
import { useAlerts } from "@/lib/finance/alertsStore";
import type { Transaction } from "@/lib/finance/types";
import { fullDate, inr, shortDate } from "@/lib/finance/format";
import { StatusPill, ReviewPill } from "./app.dashboard";

export const Route = createFileRoute("/app/transactions")({
  head: () => ({ meta: [{ title: "Transactions — FinGuard AI" }, { name: "description", content: "Browse and analyze your transactions." }] }),
  component: Transactions,
});

function Transactions() {
  const txs = useTransactions();
  const { data: alerts = [] } = useAlerts();
  const alertByTxId = useMemo(() => {
    const m = new Map<string, typeof alerts[number]>();
    for (const a of alerts) if (a.transactionId) m.set(a.transactionId, a);
    return m;
  }, [alerts]);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState<"date" | "amount">("date");
  const [selected, setSelected] = useState<Transaction | null>(null);
  const selectedAlert = selected ? alertByTxId.get(selected.id) : undefined;

  const categories = useMemo(() => ["all", ...new Set(txs.map((t) => t.category))], [txs]);

  const filtered = useMemo(() => {
    let list = txs.filter((t) =>
      (category === "all" || t.category === category) &&
      (q === "" || t.merchant.toLowerCase().includes(q.toLowerCase()))
    );
    list = [...list].sort((a, b) => sort === "amount" ? Math.abs(b.amount) - Math.abs(a.amount) : (a.date < b.date ? 1 : -1));
    return list;
  }, [txs, q, category, sort]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold sm:text-2xl md:text-3xl">Recent Transactions</h1>
        <p className="mt-1 text-xs text-muted-foreground sm:text-sm">Every payment, categorised and analysed by AI.</p>
      </div>

      <GlassCard>
        <div className="mb-4 grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center sm:gap-3">
          <div className="relative min-w-0 sm:flex-1 sm:min-w-[220px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="Search merchants…"
              className="w-full rounded-xl border bg-background py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-brand/40"
            />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:gap-3">
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="min-w-0 rounded-xl border bg-background px-3 py-2 text-sm">
              {categories.map((c) => <option key={c} value={c}>{c === "all" ? "All categories" : c}</option>)}
            </select>
            <select value={sort} onChange={(e) => setSort(e.target.value as any)} className="min-w-0 rounded-xl border bg-background px-3 py-2 text-sm">
              <option value="date">Sort: Date</option>
              <option value="amount">Sort: Amount</option>
            </select>
          </div>
        </div>

        {/* Mobile card view */}
        <div className="grid gap-2 md:hidden">
          {filtered.map((t) => {
            const rs = t.reviewStatus ?? "verified";
            return (
              <button
                key={t.id}
                onClick={() => setSelected(t)}
                className={`w-full rounded-xl border p-3 text-left transition active:scale-[0.99] ${
                  rs === "suspicious" ? "border-destructive/40 bg-destructive/5"
                    : rs === "under_review" ? "border-warning/40 bg-warning/5"
                    : "bg-card hover:bg-secondary/50"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 truncate text-sm font-semibold">
                      {rs === "suspicious" && <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-destructive" />}
                      <span className="truncate">{t.merchant}</span>
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {shortDate(t.date)} · {t.paymentMethod}
                    </p>
                  </div>
                  <p className={`shrink-0 text-sm font-semibold tabular-nums ${t.amount > 0 ? "text-success" : ""}`}>
                    {inr(t.amount)}
                  </p>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px]">{t.category}</span>
                  <StatusPill status={t.status} />
                  <ReviewPill status={rs} />
                </div>
              </button>
            );
          })}
        </div>

        {/* Desktop table view */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="pb-3">Date</th><th>Merchant</th><th>Category</th>
                <th className="text-right">Amount</th><th>Method</th><th className="text-right">Status</th><th className="text-right">Review</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => {
                const rs = t.reviewStatus ?? "verified";
                const rowTone = rs === "suspicious" ? "bg-destructive/5 hover:bg-destructive/10"
                  : rs === "under_review" ? "bg-warning/5 hover:bg-warning/10"
                  : rs === "verified" ? "hover:bg-success/5"
                  : "hover:bg-secondary/40";
                return (
                  <tr key={t.id} className={`cursor-pointer border-t ${rowTone}`} onClick={() => setSelected(t)}>
                    <td className="py-3 text-muted-foreground">{shortDate(t.date)}</td>
                    <td className="font-medium">
                      <span className="inline-flex items-center gap-1.5">
                        {rs === "suspicious" && <AlertTriangle className="h-3.5 w-3.5 text-destructive" />}
                        {t.merchant}
                      </span>
                    </td>
                    <td><span className="rounded-full bg-secondary px-2 py-0.5 text-xs">{t.category}</span></td>
                    <td className={`text-right font-medium ${t.amount > 0 ? "text-success" : ""}`}>{inr(t.amount)}</td>
                    <td className="text-xs text-muted-foreground">{t.paymentMethod}</td>
                    <td className="text-right"><StatusPill status={t.status} /></td>
                    <td className="text-right"><ReviewPill status={rs} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </GlassCard>

      <AnimatePresence>
        {selected && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" onClick={() => setSelected(null)} />
            <motion.aside
              initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", damping: 25 }}
              className="fixed right-0 top-0 z-50 h-full w-full max-w-md overflow-y-auto border-l bg-card p-6"
            >
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Transaction</p>
                  <h2 className="text-2xl font-semibold">{selected.merchant}</h2>
                  <p className="text-sm text-muted-foreground">{fullDate(selected.date)}</p>
                </div>
                <button onClick={() => setSelected(null)} className="rounded-lg p-2 hover:bg-secondary"><X className="h-4 w-4" /></button>
              </div>
              <div className="mb-3 flex items-center gap-2">
                <ReviewPill status={selected.reviewStatus ?? "verified"} />
                <StatusPill status={selected.status} />
              </div>
              <div className={`mb-6 rounded-2xl gradient-brand p-6 text-white`}>
                <p className="text-xs opacity-80">Amount</p>
                <p className="text-3xl font-semibold">{inr(selected.amount)}</p>
                <p className="mt-1 text-xs opacity-80">{selected.paymentMethod} · {selected.status}</p>
              </div>
              {selectedAlert && (
                <div className="mb-4 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
                  <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-destructive">
                    <AlertTriangle className="h-3.5 w-3.5" /> AI Anomaly detected
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div><p className="text-[10px] uppercase text-muted-foreground">Expected</p><p className="font-semibold">{inr(selectedAlert.expected)}</p></div>
                    <div><p className="text-[10px] uppercase text-muted-foreground">Actual</p><p className="font-semibold text-destructive">{inr(selectedAlert.actual)}</p></div>
                    <div><p className="text-[10px] uppercase text-muted-foreground">Deviation</p><p className="font-semibold text-warning">+{Math.round(selectedAlert.deviation)}%</p></div>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">{selectedAlert.aiExplanation}</p>
                </div>
              )}
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <Info label="AI Category" value={selected.category} />
                <Info label="Confidence" value={`${Math.round(selected.aiConfidence * 100)}%`} />
                <Info label="Recurring" value={selected.recurring ? "Yes" : "No"} />
                <Info label="Risk Score" value={`${selected.riskScore} / 100`} />
                <Info label="Merchant Frequency" value={`${Math.floor(Math.random() * 12) + 2}× / month`} />
                <Info label="Similar transactions" value={`${Math.floor(Math.random() * 20) + 3}`} />
              </dl>
              <div className="mt-6">
                <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Notes</p>
                <textarea rows={3} placeholder="Add a note…" className="w-full rounded-xl border bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-brand/40" />
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}
