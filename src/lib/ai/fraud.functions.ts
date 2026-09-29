import { createServerFn } from "@tanstack/react-start";
import { generateObject, embed } from "ai";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

const FraudEvaluationSchema = z.object({
  fraudScore: z.number().min(0).max(100),
  severity: z.enum(["Low", "Medium", "High"]),
  reason: z.string(),
  explanation: z.string(),
});

const InputSchema = z.object({
  transaction: z.object({
    merchant: z.string(),
    amount: z.number(),
    date: z.string(),
    category: z.string(),
  }),
});

export const evaluateTransactionFraud = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("AI service is not configured.");

    const gateway = createLovableAiGatewayProvider(key);
    
    // 1. Generate embedding for the transaction
    const txStr = `${data.transaction.merchant} ${data.transaction.category} ${data.transaction.amount}`;
    const { embedding } = await embed({
      model: gateway.textEmbeddingModel("openai/text-embedding-3-small"),
      value: txStr,
    }).catch(() => {
      // Fallback if embedding fails
      return { embedding: null };
    });

    // 2. Fetch context (Contextual RAG)
    let contextStr = "No previous context.";
    if (embedding) {
      // Find similar transactions
      // Note: In a real implementation, we'd use a postgres function for vector similarity, e.g., match_transactions
      // For now, we will just fetch recent transactions for this merchant as context
      const { data: recentTxs } = await context.supabase
        .from("transactions")
        .select("merchant, amount, occurred_at")
        .eq("user_id", context.userId)
        .order("occurred_at", { ascending: false })
        .limit(20);
        
      if (recentTxs && recentTxs.length > 0) {
        contextStr = recentTxs.map(t => `${t.merchant}: ₹${t.amount} on ${new Date(t.occurred_at).toLocaleDateString()}`).join("\n");
      }
    }

    // 3. Evaluate fraud
    const prompt = `
You are an expert fraud detection AI. Evaluate the following transaction for a user based on their recent transaction history context.

Incoming Transaction:
Merchant: ${data.transaction.merchant}
Amount: ₹${data.transaction.amount}
Date: ${data.transaction.date}
Category: ${data.transaction.category}

User's Recent Transaction Context:
${contextStr}

Determine if this new transaction is anomalous or suspicious.
Provide a fraudScore (0-100), severity (Low, Medium, High), reason (short), and a full explanation for the user.
`;

    try {
      const result = await generateObject({
        model: gateway("google/gemini-3.5-flash"),
        schema: FraudEvaluationSchema,
        prompt,
      });

      return result.object;
    } catch (err) {
      console.error("[fraud-evaluation] AI evaluation failed", err);
      // Fallback response if AI fails
      return {
        fraudScore: 0,
        severity: "Low",
        reason: "Evaluation failed",
        explanation: "The AI service was unavailable to evaluate this transaction.",
      };
    }
  });
