import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type LeakDecision = "fixing" | "ignored" | "keep";
export type LeakFeedback = { leakKey: string; decision: LeakDecision };

const DecisionSchema = z.enum(["fixing", "ignored", "keep"]);

export const listLeakFeedback = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<LeakFeedback[]> => {
    const { data, error } = await context.supabase
      .from("leak_feedback")
      .select("leak_key, decision")
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => ({
      leakKey: r.leak_key as string,
      decision: r.decision as LeakDecision,
    }));
  });

export const setLeakFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        leakKey: z.string().min(1).max(200),
        decision: DecisionSchema.nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    if (data.decision === null) {
      const { error } = await context.supabase
        .from("leak_feedback")
        .delete()
        .eq("user_id", context.userId)
        .eq("leak_key", data.leakKey);
      if (error) throw new Error(error.message);
      return { ok: true };
    }
    const { error } = await context.supabase.from("leak_feedback").upsert(
      {
        user_id: context.userId,
        leak_key: data.leakKey,
        decision: data.decision,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,leak_key" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });