import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Transaction } from "./types";

const TxInput = z.object({
  date: z.string(),
  merchant: z.string().min(1).max(200),
  category: z.string().min(1).max(80),
  amount: z.number().finite(),
  paymentMethod: z.enum(["UPI", "Card", "Bank", "Cash"]),
  status: z.enum(["Completed", "Pending", "Failed"]).default("Completed"),
  aiConfidence: z.number().min(0).max(1).default(0.9),
  recurring: z.boolean().default(false),
  riskScore: z.number().int().min(0).max(100).default(0),
});

export const listTransactions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Transaction[]> => {
    const { data, error } = await context.supabase
      .from("transactions")
      .select("id, occurred_at, merchant, category, amount, payment_method, status, ai_confidence, recurring, risk_score, review_status")
      .eq("user_id", context.userId)
      .order("occurred_at", { ascending: false })
      .limit(5000);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => ({
      id: r.id as string,
      date: new Date(r.occurred_at as string).toISOString(),
      merchant: r.merchant as string,
      category: r.category as string,
      amount: Number(r.amount),
      paymentMethod: r.payment_method as Transaction["paymentMethod"],
      status: r.status as Transaction["status"],
      aiConfidence: Number(r.ai_confidence),
      recurring: !!r.recurring,
      riskScore: Number(r.risk_score),
      reviewStatus: (r.review_status as Transaction["reviewStatus"]) ?? "verified",
    }));
  });

export const replaceTransactions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ transactions: z.array(TxInput).max(5000) }).parse(input))
  .handler(async ({ data, context }) => {
    const { error: delErr } = await context.supabase
      .from("transactions")
      .delete()
      .eq("user_id", context.userId);
    if (delErr) throw new Error(delErr.message);
    if (data.transactions.length === 0) return { inserted: 0 };
    const rows = data.transactions.map((t) => ({
      user_id: context.userId,
      occurred_at: t.date,
      merchant: t.merchant,
      category: t.category,
      amount: t.amount,
      payment_method: t.paymentMethod,
      status: t.status,
      ai_confidence: t.aiConfidence,
      recurring: t.recurring,
      risk_score: t.riskScore,
    }));
    // Insert in chunks to stay well under any payload limit
    const CHUNK = 500;
    let inserted = 0;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const slice = rows.slice(i, i + CHUNK);
      const { error } = await context.supabase.from("transactions").insert(slice);
      if (error) throw new Error(error.message);
      inserted += slice.length;
    }
    return { inserted };
  });

// Append (Live Sync): does not delete existing rows. Returns the inserted
// rows with (id, fingerprint) so callers can link downstream alerts to the
// actual DB transaction id.
export type InsertedTx = { id: string; fingerprint: string };
export const appendTransactions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ transactions: z.array(TxInput).max(2000) }).parse(input))
  .handler(async ({ data, context }): Promise<{ inserted: number; rows: InsertedTx[] }> => {
    if (data.transactions.length === 0) return { inserted: 0, rows: [] };
    const { data: existing } = await context.supabase
      .from("transactions")
      .select("occurred_at, merchant, amount")
      .eq("user_id", context.userId)
      .limit(5000);
    const seen = new Set(
      (existing ?? []).map(
        (r) => `${new Date(r.occurred_at as string).toISOString()}|${r.merchant}|${Number(r.amount)}`,
      ),
    );
    const rows = data.transactions
      .filter((t) => !seen.has(`${new Date(t.date).toISOString()}|${t.merchant}|${t.amount}`))
      .map((t) => ({
        user_id: context.userId,
        occurred_at: t.date,
        merchant: t.merchant,
        category: t.category,
        amount: t.amount,
        payment_method: t.paymentMethod,
        status: t.status,
        ai_confidence: t.aiConfidence,
        recurring: t.recurring,
        risk_score: t.riskScore,
      }));
    if (rows.length === 0) return { inserted: 0, rows: [] };
    const CHUNK = 500;
    let inserted = 0;
    const insertedRows: InsertedTx[] = [];
    for (let i = 0; i < rows.length; i += CHUNK) {
      const slice = rows.slice(i, i + CHUNK);
      const { data: ret, error } = await context.supabase
        .from("transactions")
        .insert(slice)
        .select("id, occurred_at, merchant, amount");
      if (error) throw new Error(error.message);
      inserted += slice.length;
      for (const r of ret ?? []) {
        insertedRows.push({
          id: r.id as string,
          fingerprint: `${new Date(r.occurred_at as string).toISOString()}|${r.merchant}|${Number(r.amount)}`,
        });
      }
    }
    return { inserted, rows: insertedRows };
  });
