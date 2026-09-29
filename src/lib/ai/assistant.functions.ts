import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

const MessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(8000),
});

const InputSchema = z.object({
  messages: z.array(MessageSchema).min(1).max(40),
  financeContext: z.string().max(20000),
  mode: z.enum(["assistant", "advisor"]).optional().default("assistant"),
});

const CORE_RULES = `You are FinGuard AI, a warm, sharp, honest personal financial planner built into the user's finance dashboard.

You have access to the user's REAL financial data below. Ground EVERY answer in that data. Never invent transactions, merchants, or numbers. If the data doesn't cover the question, say so clearly and ask what would help.

Currency is INR (₹). Use ₹ and Indian number formatting (₹1,50,000 not ₹150,000).

## Absolute rules
- NEVER stop at "Yes" or "No". Every answer must be actionable.
- If the answer is No / Not right now / Not comfortable, you MUST explain exactly what would need to change to make it feasible — with concrete rupee amounts drawn from the user's own numbers.
- Never generic advice. Every recommendation must reference the user's actual income, spending, subscriptions, savings rate, or category totals.
- Reason from: savings rate, disposable income, recurring commitments, emergency fund (target ≈ 6× avg monthly spend), category trends, subscriptions, and recent behaviour.
- Be candid — say no when the numbers say no. Suggest better alternatives when relevant.

## Response format (STRICT — use these markdown headings, in this order, nothing else)

**Direct Answer**
One decisive sentence. If negative, say "Not right now" / "Not comfortably" instead of a bare "No".

**Why**
2–3 short bullets grounded in the user's own numbers (income, savings rate, category share, subscription total, etc.).

**Financial Impact**
Concrete rupee numbers: months of runway affected, emergency-fund delta, savings-goal delay in months, EMI vs full-payment if relevant.

**Recommendation**
A specific plan. When the answer is No, this section MUST include AT LEAST TWO of:
- exact additional monthly income required
- exact monthly spending cut required and WHICH categories to cut first
- which subscriptions to cancel (name them from the data)
- how many months to wait
- emergency fund to build first
- whether EMI or full payment is better
- a cheaper alternative product/budget that fits

Close with a single line: \`Confidence: <XX>% · <one-line reasoning>\`

Keep the whole reply scannable in 15 seconds. No essays. No repetition. No filler.`;

export const chatWithAssistant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("AI service is not configured.");

    const gateway = createLovableAiGatewayProvider(key);
    const model = gateway("google/gemini-3.5-flash");

    const modeSuffix =
      data.mode === "advisor"
        ? `\n\n## Mode: Life-Decision Advisor\nThe user is asking about a real-life financial decision (a purchase, a trip, a job change, an EMI, a goal). Treat every question this way, remember earlier turns in the conversation, and reason across income, savings, emergency fund, subscriptions and goals.`
        : "";

    const system = `${CORE_RULES}${modeSuffix}\n\n${data.financeContext}`;

    try {
      const { text } = await generateText({
        model,
        system,
        messages: data.messages,
      });
      return { text };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (/429|rate/i.test(message)) {
        throw new Error("Rate limit reached. Please wait a moment and try again.");
      }
      if (/402|credit/i.test(message)) {
        throw new Error("AI credits exhausted. Please add credits in workspace billing.");
      }
      console.error("[assistant] gateway error", err);
      throw new Error("The AI service is temporarily unavailable. Please try again.");
    }
  });
