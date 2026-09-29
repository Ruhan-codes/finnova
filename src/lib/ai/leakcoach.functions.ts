import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

const InputSchema = z.object({
  merchant: z.string().min(1).max(200),
  category: z.string().min(1).max(80),
  reason: z.string().max(300),
  monthlyAmount: z.number().finite(),
  potentialMonthlySaving: z.number().finite(),
  severity: z.string().max(30),
  spendShare: z.number().finite(),
  monthlySpend: z.number().finite(),
});

export const explainLeak = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("AI service is not configured.");

    const gateway = createLovableAiGatewayProvider(key);
    const model = gateway("google/gemini-3.5-flash");

    const system = `You are FinGuard AI, a sharp, warm personal finance coach. Currency is INR (₹), Indian number formatting.
Given ONE detected money leak, reply in markdown with exactly three short sections:
**Why this is a leak** (1–2 sentences grounded in the numbers given)
**Do this week** (2 bullet points, each concrete and doable)
**If you stick with it** (1 sentence with the yearly rupee impact)
Never invent transactions or numbers beyond the ones supplied. Keep the whole answer under 110 words.`;

    const prompt = `Leak: ${data.merchant}
Category: ${data.category}
Detection reason: ${data.reason}
Monthly amount: ₹${Math.round(data.monthlyAmount)}
Recoverable per month: ₹${Math.round(data.potentialMonthlySaving)}
Severity: ${data.severity}
Share of monthly spending: ${Math.round(data.spendShare)}%
User's average monthly spend: ₹${Math.round(data.monthlySpend)}`;

    try {
      const { text } = await generateText({ model, system, prompt });
      return { text };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (/429|rate/i.test(message)) throw new Error("Rate limit reached. Please try again in a moment.");
      if (/402|credit/i.test(message)) throw new Error("AI credits exhausted. Please add credits in workspace billing.");
      console.error("[leakcoach] gateway error", err);
      throw new Error("The AI coach is temporarily unavailable. Please try again.");
    }
  });