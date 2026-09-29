// Pure HTML builder for the FinGuard AI anomaly alert email.
// The same HTML is used for real SMTP sends (when configured) and as the
// in-app fallback preview shown on the Alerts page.

import { inr } from "./format";

export type AnomalyEmailInput = {
  merchant: string;
  actual: number;
  expected: number;
  deviation: number;
  confidence: number;
  riskScore: number;
  severity: "Low" | "Medium" | "High";
  timestamp: string;
  explanation: string;
  recommendedAction: string;
  userFirstName?: string;
  reviewUrl?: string;
};

export function buildAnomalyEmailHtml(a: AnomalyEmailInput): string {
  const sevColor = a.severity === "High" ? "#dc2626" : a.severity === "Medium" ? "#d97706" : "#2563eb";
  const when = new Date(a.timestamp).toLocaleString("en-IN", {
    weekday: "short", day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
  const hi = a.userFirstName ? `Hi ${a.userFirstName},` : "Hi,";
  const reviewBtn = a.reviewUrl
    ? `<a href="${a.reviewUrl}" style="display:inline-block;padding:12px 20px;border-radius:10px;background:linear-gradient(90deg,#2563eb,#4f46e5);color:#fff;text-decoration:none;font-weight:600;font-size:14px">Review this transaction</a>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#f5f7fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,sans-serif;color:#0f172a">
  <div style="max-width:560px;margin:0 auto;padding:24px">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px">
      <div style="width:32px;height:32px;border-radius:8px;background:linear-gradient(135deg,#2563eb,#4f46e5);display:inline-block"></div>
      <span style="font-weight:700;font-size:16px">FinGuard AI</span>
    </div>
    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden">
      <div style="padding:16px 20px;border-bottom:1px solid #f1f5f9;background:${sevColor}10">
        <div style="font-size:11px;font-weight:700;letter-spacing:.08em;color:${sevColor};text-transform:uppercase">${a.severity} risk · anomaly detected</div>
        <div style="margin-top:4px;font-size:18px;font-weight:700">Unusual spending at ${escapeHtml(a.merchant)}</div>
      </div>
      <div style="padding:20px">
        <p style="margin:0 0 12px;font-size:14px;line-height:1.5">${hi} FinGuard's AI just flagged a transaction on your account that doesn't match your usual behavior.</p>
        <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin-top:8px">
          ${row("Merchant", escapeHtml(a.merchant))}
          ${row("Actual amount", `<b style="color:${sevColor}">${escapeHtml(inr(a.actual))}</b>`)}
          ${row("Your usual amount", escapeHtml(inr(a.expected)))}
          ${row("Deviation", `+${a.deviation}%`)}
          ${row("AI confidence", `${a.confidence}%`)}
          ${row("Risk score", `${a.riskScore} / 100`)}
          ${row("When", escapeHtml(when))}
        </table>
        <div style="margin-top:16px;padding:12px 14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;font-size:13px;line-height:1.5">
          <div style="font-weight:600;margin-bottom:4px">Why we flagged it</div>
          ${escapeHtml(a.explanation)}
        </div>
        <div style="margin-top:12px;padding:12px 14px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;font-size:13px;line-height:1.5">
          <div style="font-weight:600;margin-bottom:4px;color:#1d4ed8">Recommended action</div>
          ${escapeHtml(a.recommendedAction)}
        </div>
        ${reviewBtn ? `<div style="margin-top:20px">${reviewBtn}</div>` : ""}
      </div>
    </div>
    <p style="margin:16px 4px;font-size:11px;color:#64748b">You received this because FinGuard AI is monitoring your linked transaction feed.</p>
  </div></body></html>`;
}

function row(k: string, v: string) {
  return `<tr><td style="padding:6px 0;font-size:12px;color:#64748b;width:40%">${k}</td><td style="padding:6px 0;font-size:13px;text-align:right">${v}</td></tr>`;
}
function escapeHtml(s: string) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

export function recommendedActionFor(sev: "Low" | "Medium" | "High"): string {
  if (sev === "High")
    return "If you don't recognise this, freeze your card immediately, contact your bank, and raise a dispute. Also review your last 24 hours of activity.";
  if (sev === "Medium")
    return "Confirm whether this was you. If it wasn't, consider freezing the card and reviewing recent activity for other unusual charges.";
  return "Confirm this was you. If not, tap 'No, this wasn't me' to open a review and we'll help you dispute it.";
}
