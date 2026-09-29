// Server-only helper that delivers FinGuard anomaly alerts via Lovable's
// managed email API. Returns a structured result rather than throwing so
// callers can persist delivery status without swallowing the alert itself.
import { sendLovableEmail, EmailAPIError } from "@lovable.dev/email-js";

export type EmailDeliveryResult =
  | { ok: true; provider: string; messageId: string | null; sentAt: string }
  | { ok: false; provider: string; error: string; retryable: boolean };

function resolveSender(): { from: string; senderDomain: string } | null {
  const domain =
    process.env.SENDER_DOMAIN ||
    process.env.LOVABLE_SENDER_DOMAIN ||
    process.env.FROM_DOMAIN ||
    "";
  if (!domain) return null;
  return { from: `FinGuard AI <alerts@${domain}>`, senderDomain: domain };
}

export async function sendAnomalyEmail(input: {
  to: string;
  subject: string;
  html: string;
  text: string;
  idempotencyKey: string;
}): Promise<EmailDeliveryResult> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      provider: "lovable",
      error: "LOVABLE_API_KEY missing on server",
      retryable: false,
    };
  }
  const sender = resolveSender();
  if (!sender) {
    return {
      ok: false,
      provider: "lovable",
      error:
        "No verified sender domain configured. Set SENDER_DOMAIN in project secrets after verifying an email domain to enable delivery.",
      retryable: false,
    };
  }

  try {
    const res = await sendLovableEmail(
      {
        to: input.to,
        from: sender.from,
        sender_domain: sender.senderDomain,
        subject: input.subject,
        html: input.html,
        text: input.text,
        idempotency_key: input.idempotencyKey,
        purpose: "finguard-anomaly-alert",
        label: "anomaly-alert",
      },
      { apiKey, idempotencyKey: input.idempotencyKey },
    );
    return {
      ok: true,
      provider: "lovable",
      messageId: res.message_id ?? null,
      sentAt: new Date().toISOString(),
    };
  } catch (err) {
    if (err instanceof EmailAPIError) {
      const retryable = err.status === 429 || err.status >= 500;
      return {
        ok: false,
        provider: "lovable",
        error: `${err.code ?? "email_error"}: ${err.message}`.slice(0, 500),
        retryable,
      };
    }
    return {
      ok: false,
      provider: "lovable",
      error: (err instanceof Error ? err.message : String(err)).slice(0, 500),
      retryable: false,
    };
  }
}
