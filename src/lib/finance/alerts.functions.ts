// Server functions for AI alerts (persisted anomalies) and review workflow.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AlertDeliveryStatus = "pending" | "sent" | "failed";

export type PersistedAlert = {
  id: string;
  merchant: string;
  actual: number;
  expected: number;
  deviation: number;
  confidence: number;
  severity: "Low" | "Medium" | "High";
  status: "pending" | "confirmed" | "disputed" | "resolved";
  reason: string;
  aiExplanation: string;
  notificationHtml: string | null;
  emailSent: boolean;
  transactionId: string | null;
  createdAt: string;
  delivery: {
    status: AlertDeliveryStatus;
    provider: string | null;
    messageId: string | null;
    sentAt: string | null;
    error: string | null;
    attempts: number;
  };
};

const SEVERITIES = ["Low", "Medium", "High"] as const;

const AlertInput = z.object({
  transactionId: z.string().uuid().nullable(),
  fingerprint: z.string().max(300).optional().nullable(),
  merchant: z.string().min(1).max(200),
  actual: z.number().finite(),
  expected: z.number().finite(),
  deviation: z.number().finite(),
  confidence: z.number().min(0).max(100),
  severity: z.enum(SEVERITIES),
  reason: z.string().max(500),
  aiExplanation: z.string().max(2000),
  notificationHtml: z.string().max(64_000),
});

function normStatus(v: unknown): AlertDeliveryStatus {
  return v === "sent" || v === "failed" ? v : "pending";
}

function mapAlert(r: Record<string, unknown>): PersistedAlert {
  return {
    id: r.id as string,
    merchant: r.merchant as string,
    actual: Number(r.actual_amount),
    expected: Number(r.expected_amount),
    deviation: Number(r.deviation_pct),
    confidence: Number(r.confidence),
    severity: (r.severity as string) as PersistedAlert["severity"],
    status: (r.status as string) as PersistedAlert["status"],
    reason: (r.reason as string) ?? "",
    aiExplanation: (r.ai_explanation as string) ?? "",
    notificationHtml: (r.notification_html as string) ?? null,
    emailSent: !!r.email_sent,
    transactionId: (r.transaction_id as string) ?? null,
    createdAt: r.created_at as string,
    delivery: {
      status: normStatus(r.delivery_status),
      provider: (r.delivery_provider as string) ?? null,
      messageId: (r.delivery_message_id as string) ?? null,
      sentAt: (r.email_sent_at as string) ?? null,
      error: (r.delivery_error as string) ?? null,
      attempts: Number(r.delivery_attempts ?? 0),
    },
  };
}

const SELECT_COLUMNS =
  "id, transaction_id, merchant, actual_amount, expected_amount, deviation_pct, confidence, severity, status, reason, ai_explanation, notification_html, email_sent, created_at, delivery_status, delivery_provider, delivery_message_id, email_sent_at, delivery_error, delivery_attempts";

export const listAlerts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PersistedAlert[]> => {
    const { data, error } = await context.supabase
      .from("alerts")
      .select(SELECT_COLUMNS)
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return (data ?? []).map(mapAlert);
  });

function buildTextFallback(a: z.infer<typeof AlertInput>): string {
  return [
    `FinGuard AI — ${a.severity} risk anomaly`,
    `Merchant: ${a.merchant}`,
    `Actual: ${a.actual}`,
    `Expected: ${a.expected}`,
    `Deviation: +${Math.round(a.deviation)}%`,
    `Confidence: ${Math.round(a.confidence)}%`,
    "",
    a.aiExplanation,
  ].join("\n");
}

export const createAlerts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ alerts: z.array(AlertInput).max(50) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    if (data.alerts.length === 0) return { inserted: 0, emailed: 0, failed: 0 };

    // --- Resolve transaction ids (unchanged logic). ---
    const claimedIds = Array.from(
      new Set(
        data.alerts
          .map((a) => a.transactionId)
          .filter((v): v is string => !!v),
      ),
    );
    const validIds = new Set<string>();
    if (claimedIds.length) {
      const { data: valid, error: verr } = await context.supabase
        .from("transactions")
        .select("id")
        .eq("user_id", context.userId)
        .in("id", claimedIds);
      if (verr) throw new Error(verr.message);
      for (const r of valid ?? []) validIds.add(r.id as string);
    }

    const needFp = data.alerts
      .filter((a) => (!a.transactionId || !validIds.has(a.transactionId)) && !!a.fingerprint)
      .map((a) => a.fingerprint as string);
    const fpToId = new Map<string, string>();
    if (needFp.length) {
      const { data: recent, error: rerr } = await context.supabase
        .from("transactions")
        .select("id, occurred_at, merchant, amount")
        .eq("user_id", context.userId)
        .order("occurred_at", { ascending: false })
        .limit(500);
      if (rerr) throw new Error(rerr.message);
      for (const r of recent ?? []) {
        const fp = `${new Date(r.occurred_at as string).toISOString()}|${r.merchant}|${Number(r.amount)}`;
        if (!fpToId.has(fp)) fpToId.set(fp, r.id as string);
      }
    }

    type Row = {
      user_id: string;
      transaction_id: string | null;
      merchant: string;
      actual_amount: number;
      expected_amount: number;
      deviation_pct: number;
      confidence: number;
      severity: (typeof SEVERITIES)[number];
      status: "pending";
      reason: string;
      ai_explanation: string;
      notification_html: string;
      email_sent: boolean;
      delivery_status: AlertDeliveryStatus;
      dedupe_key: string;
    };

    const rows: Row[] = data.alerts.map((a) => {
      let txId: string | null = null;
      if (a.transactionId && validIds.has(a.transactionId)) txId = a.transactionId;
      else if (a.fingerprint && fpToId.has(a.fingerprint)) txId = fpToId.get(a.fingerprint)!;
      const dedupe =
        txId ??
        (a.fingerprint ? `fp:${a.fingerprint}` : `raw:${a.merchant}|${a.actual}|${a.expected}`);
      return {
        user_id: context.userId,
        transaction_id: txId,
        merchant: a.merchant,
        actual_amount: a.actual,
        expected_amount: a.expected,
        deviation_pct: a.deviation,
        confidence: a.confidence,
        severity: a.severity,
        status: "pending",
        reason: a.reason,
        ai_explanation: a.aiExplanation,
        notification_html: a.notificationHtml,
        email_sent: false,
        delivery_status: "pending",
        dedupe_key: dedupe,
      };
    });

    // Insert one-by-one so the per-user unique dedupe_key index skips
    // duplicates without failing the whole batch.
    const inserted: Array<{ row: Row; alertId: string; input: z.infer<typeof AlertInput> }> = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const { data: ins, error } = await context.supabase
        .from("alerts")
        .insert(row)
        .select("id")
        .single();
      if (error) {
        if ((error as { code?: string }).code === "23505") continue; // duplicate
        throw new Error(error.message);
      }
      inserted.push({ row, alertId: ins.id as string, input: data.alerts[i] });
    }

    if (inserted.length === 0) return { inserted: 0, emailed: 0, failed: 0 };

    // Flag underlying transactions as suspicious.
    const txIds = inserted
      .map((x) => x.row.transaction_id)
      .filter((v): v is string => !!v);
    if (txIds.length) {
      await context.supabase
        .from("transactions")
        .update({ review_status: "suspicious" })
        .in("id", txIds)
        .eq("user_id", context.userId);
    }

    // --- Auto-send real email per inserted anomaly ---
    // Look up the recipient email from the profile (RLS scoped to self).
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("email, first_name")
      .eq("id", context.userId)
      .maybeSingle();

    const recipient = (profile?.email ?? context.claims?.email ?? "").trim();
    let emailed = 0;
    let failed = 0;

    if (!recipient) {
      const msg = "No recipient email on profile";
      await context.supabase
        .from("alerts")
        .update({
          delivery_status: "failed",
          delivery_error: msg,
          delivery_attempts: 1,
          delivery_provider: "lovable",
        })
        .in(
          "id",
          inserted.map((x) => x.alertId),
        )
        .eq("user_id", context.userId);
      failed = inserted.length;
      return { inserted: inserted.length, emailed, failed };
    }

    const { sendAnomalyEmail } = await import("./emailSender.server");

    for (const item of inserted) {
      const subject = `[FinGuard AI] ${item.row.severity} risk anomaly at ${item.row.merchant}`;
      const text = buildTextFallback(item.input);
      const result = await sendAnomalyEmail({
        to: recipient,
        subject,
        html: item.row.notification_html,
        text,
        idempotencyKey: `alert:${item.alertId}`,
      });

      if (result.ok) {
        emailed++;
        await context.supabase
          .from("alerts")
          .update({
            delivery_status: "sent",
            delivery_provider: result.provider,
            delivery_message_id: result.messageId,
            email_sent_at: result.sentAt,
            email_sent: true,
            delivery_attempts: 1,
            delivery_error: null,
          })
          .eq("id", item.alertId)
          .eq("user_id", context.userId);
      } else {
        failed++;
        await context.supabase
          .from("alerts")
          .update({
            delivery_status: "failed",
            delivery_provider: result.provider,
            delivery_error: result.error,
            delivery_attempts: 1,
          })
          .eq("id", item.alertId)
          .eq("user_id", context.userId);
      }
    }

    return { inserted: inserted.length, emailed, failed };
  });

export const resolveAlert = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      alertId: z.string().uuid(),
      transactionId: z.string().uuid().nullable(),
      decision: z.enum(["confirmed", "disputed"]),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const alertStatus = data.decision;
    const reviewStatus = data.decision === "confirmed" ? "verified" : "under_review";
    const { error } = await context.supabase
      .from("alerts")
      .update({ status: alertStatus })
      .eq("id", data.alertId)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    if (data.transactionId) {
      await context.supabase
        .from("transactions")
        .update({ review_status: reviewStatus })
        .eq("id", data.transactionId)
        .eq("user_id", context.userId);
    }
    return { ok: true };
  });

// Manual retry for a single alert whose email delivery previously failed.
export const retryAlertEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ alertId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("alerts")
      .select(SELECT_COLUMNS)
      .eq("id", data.alertId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Alert not found");

    const { data: profile } = await context.supabase
      .from("profiles")
      .select("email")
      .eq("id", context.userId)
      .maybeSingle();
    const recipient = (profile?.email ?? context.claims?.email ?? "").trim();
    if (!recipient) throw new Error("No recipient email on profile");

    const { sendAnomalyEmail } = await import("./emailSender.server");
    const subject = `[FinGuard AI] ${row.severity} risk anomaly at ${row.merchant}`;
    const text = `FinGuard AI anomaly at ${row.merchant}\n\n${row.ai_explanation ?? ""}`;
    const result = await sendAnomalyEmail({
      to: recipient,
      subject,
      html: (row.notification_html as string) ?? "<p>Anomaly detected.</p>",
      text,
      idempotencyKey: `alert:${row.id}`,
    });

    const attempts = Number(row.delivery_attempts ?? 0) + 1;
    if (result.ok) {
      await context.supabase
        .from("alerts")
        .update({
          delivery_status: "sent",
          delivery_provider: result.provider,
          delivery_message_id: result.messageId,
          email_sent_at: result.sentAt,
          email_sent: true,
          delivery_attempts: attempts,
          delivery_error: null,
        })
        .eq("id", row.id)
        .eq("user_id", context.userId);
      return { ok: true as const };
    }
    await context.supabase
      .from("alerts")
      .update({
        delivery_status: "failed",
        delivery_provider: result.provider,
        delivery_error: result.error,
        delivery_attempts: attempts,
      })
      .eq("id", row.id)
      .eq("user_id", context.userId);
    return { ok: false as const, error: result.error };
  });
