import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

export type BeforeAfter = { before: number; after: number };
export type SimTimelineNode = { label: string; note: string; highlight?: boolean };
export type SimScenario = {
  name: string;
  verdict: string;
  oneLine: string;
  monthlyImpact?: number;
  recommended?: boolean;
};
export type SimControl = {
  key: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
};
export type SimulationResult = {
  needsMoreInfo: boolean;
  followUpQuestions?: string[];
  parsed?: {
    label?: string;
    kind?: string;
    amount?: number;
    emiMonthly?: number;
    emiMonths?: number;
    monthlyDelta?: number;
    horizonMonths?: number;
  };
  verdict?: "excellent" | "safe" | "manageable" | "risky" | "not_recommended";
  confidence?: number;
  confidenceReason?: string;
  directAnswer?: string;
  why?: string[];
  financialImpact?: string[];
  recommendation?: string[];
  metrics?: {
    healthScore: BeforeAfter;
    emergencyFundMonths: BeforeAfter;
    monthlySavings: BeforeAfter;
    savingsRatePct: BeforeAfter;
    netWorth1Y: BeforeAfter;
    leakScore: BeforeAfter;
  };
  timeline?: SimTimelineNode[];
  scenarios?: SimScenario[];
  controls?: SimControl[];
};


const HistorySchema = z.object({
  question: z.string().max(400),
  answer: z.string().max(400),
});

const InputSchema = z.object({
  scenario: z.string().min(1).max(800),
  financeContext: z.string().max(20000),
  clarifications: z.array(HistorySchema).max(8).optional().default([]),
  assumptions: z
    .record(z.string(), z.union([z.number(), z.string(), z.boolean()]))
    .optional()
    .default({}),
});

const OUTPUT_SHAPE = `{
  "needsMoreInfo": boolean,
  "followUpQuestions": string[] (2-4 short, specific questions ONLY when needsMoreInfo=true, else empty),
  "parsed": {
    "label": short human title of the decision,
    "kind": "purchase" | "loan_emi" | "recurring_expense" | "income_change" | "investment" | "savings_goal" | "life_event" | "cancel_subscription" | "other",
    "amount": number (one-time cost, 0 if none),
    "emiMonthly": number (0 if none),
    "emiMonths": number (0 if none),
    "monthlyDelta": number (positive = extra saving/income, negative = extra outflow, 0 if none),
    "horizonMonths": number (planning horizon, default 60)
  },
  "verdict": "excellent" | "safe" | "manageable" | "risky" | "not_recommended",
  "confidence": number 0-100,
  "confidenceReason": string (why this confidence — e.g. 'based on 8 months of data'),
  "directAnswer": one decisive sentence (never a bare Yes/No; use 'Not right now' style if negative),
  "why": string[] 2-3 bullets tied to the user's real numbers,
  "financialImpact": string[] 3-4 concrete rupee-value bullets,
  "recommendation": string[] 2-4 actionable steps. If verdict is risky/not_recommended, include exactly what must change (extra monthly income, spending cuts naming categories, months to wait, EMI vs full, cheaper alternative),
  "metrics": {
    "healthScore":        { "before": number 0-100, "after": number 0-100 },
    "emergencyFundMonths":{ "before": number, "after": number },
    "monthlySavings":     { "before": number, "after": number },
    "savingsRatePct":     { "before": number 0-100, "after": number 0-100 },
    "netWorth1Y":         { "before": number, "after": number },
    "leakScore":          { "before": number 0-100, "after": number 0-100 }
  },
  "timeline": [
    { "label": "Today", "note": string, "highlight": boolean },
    { "label": "1 Month", "note": string, "highlight": boolean },
    { "label": "3 Months", "note": string, "highlight": boolean },
    { "label": "6 Months", "note": string, "highlight": boolean },
    { "label": "1 Year", "note": string, "highlight": boolean },
    { "label": "3 Years", "note": string, "highlight": boolean },
    { "label": "5 Years", "note": string, "highlight": boolean }
  ],
  "scenarios": [
    { "name": string, "verdict": "excellent"|"safe"|"manageable"|"risky"|"not_recommended", "oneLine": short summary with numbers, "monthlyImpact": number, "recommended": boolean }
    // 3-5 realistic alternatives — e.g. Buy today, Wait 6 months, EMI 12m, Cheaper alternative, Invest instead
  ],
  "controls": [
    { "key": string (snake_case), "label": string, "value": number, "min": number, "max": number, "step": number, "unit": "₹" | "months" | "%" | "" }
    // 2-4 interactive levers most relevant to THIS scenario (e.g. purchase_amount, emi_months, extra_monthly_saving, wait_months)
  ]
}`;

const SYSTEM = `You are FinGuard Future Simulator — a personalised AI financial prediction engine. You do NOT chat. You produce a single JSON simulation of the user's future given a decision.

Currency: INR (₹). Use Indian number formatting in strings (₹1,50,000).

RULES:
- Ground every number in the USER FINANCIAL DATA provided below. Never invent transactions or merchants.
- If the user's scenario is missing critical info (e.g. purchase price, EMI tenure, expected salary, timeframe) set needsMoreInfo=true and return only followUpQuestions + parsed with the fields you already know. Skip verdict/metrics/timeline/scenarios/controls in that case.
- Otherwise, produce the FULL prediction: verdict, confidence, directAnswer, why, financialImpact, recommendation, metrics (before vs after), 7-point timeline, 3-5 alternative scenarios, 2-4 interactive controls.
- NEVER stop at Yes/No. If the answer is negative, the recommendation MUST spell out exactly what needs to change — extra ₹/month income, which categories to cut and by how much, months to wait, whether EMI helps, or a cheaper alternative — with numbers from the user's own data.
- Metrics.before must reflect the user's CURRENT state derived from the data (approximate emergency fund from savings history, health score from savings rate & leak count, etc.). Metrics.after must reflect the decision applied over the horizon.
- Scenarios: give real, differentiated alternatives with concrete monthly-impact numbers. Mark exactly one recommended=true.
- Controls: pick the 2-4 levers most relevant to THIS scenario so the user can experiment. Use sensible min/max/step. value = the assumed baseline you used.
- Timeline notes: one short phrase per point (e.g. "Emergency fund dips to 2.1 months", "EMI ends — savings rebound", "Goal reached").

OUTPUT: Return ONLY a valid minified JSON object. No prose, no markdown, no code fences. The JSON MUST match this shape exactly:

${OUTPUT_SHAPE}`;

function extractJson(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const first = trimmed.indexOf("{");
    const last = trimmed.lastIndexOf("}");
    if (first >= 0 && last > first) {
      return JSON.parse(trimmed.slice(first, last + 1));
    }
    throw new Error("The simulator returned an unreadable response. Please try again.");
  }
}

export const simulateFuture = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("AI service is not configured.");

    const gateway = createLovableAiGatewayProvider(key);
    const model = gateway("google/gemini-3.5-flash");

    const clarifications = data.clarifications?.length
      ? `\n\nPrior clarifications:\n${data.clarifications.map((c) => `Q: ${c.question}\nA: ${c.answer}`).join("\n")}`
      : "";

    const assumptions = Object.keys(data.assumptions ?? {}).length
      ? `\n\nUser-adjusted assumptions (use these values, do NOT ask again): ${JSON.stringify(data.assumptions)}`
      : "";

    const prompt = `${data.financeContext}\n\nUser scenario: ${data.scenario}${clarifications}${assumptions}\n\nProduce the JSON simulation now.`;

    try {
      const { text } = await generateText({ model, system: SYSTEM, prompt });
      const json = extractJson(text) as SimulationResult;
      return json;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (/429|rate/i.test(message)) throw new Error("Rate limit reached. Please try again in a moment.");
      if (/402|credit/i.test(message)) throw new Error("AI credits exhausted. Please add credits in workspace billing.");
      console.error("[simulator] gateway error", err);
      throw new Error("The simulator is temporarily unavailable. Please try again.");
    }
  });
