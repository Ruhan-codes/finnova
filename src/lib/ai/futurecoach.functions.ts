import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

const InputSchema = z.object({
  context: z.string().min(1).max(8000),
  question: z.string().max(400).optional(),
});

const SYSTEM = `You are FinGuard AI, an honest, sharp personal financial planner inside the user's finance app. Currency is INR (₹), Indian number formatting.

You are given a fully computed future simulation of ONE financial decision. Never invent numbers beyond those supplied — reuse them exactly.

When there is no user question, reply in markdown with exactly these sections:
**Why I recommend this** (2 sentences referencing the user's own spending behaviour)
**Effect on your future savings** (1 sentence with the rupee numbers)
**Effect on your SmartSave Journey** (1 sentence with the goal date shift)
**Effect on Financial Health & Leak Score** (1 sentence with both before → after values)
**Be honest** (1 short sentence naming the real trade-off)

When there IS a user question, answer it directly in under 110 words, grounded in the simulation numbers, with **bold** key figures. Be candid — say no when the numbers say no. Never give generic advice.`;

export const coachFuture = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("AI service is not configured.");

    const gateway = createLovableAiGatewayProvider(key);
    const model = gateway("google/gemini-3.5-flash");

    const prompt = data.question
      ? `${data.context}\n\nUser question: ${data.question}`
      : `${data.context}\n\nExplain this recommendation.`;

    try {
      const { text } = await generateText({ model, system: SYSTEM, prompt });
      return { text };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (/429|rate/i.test(message)) throw new Error("Rate limit reached. Please try again in a moment.");
      if (/402|credit/i.test(message)) throw new Error("AI credits exhausted. Please add credits in workspace billing.");
      console.error("[futurecoach] gateway error", err);
      throw new Error("The AI planner is temporarily unavailable. Please try again.");
    }
  });
