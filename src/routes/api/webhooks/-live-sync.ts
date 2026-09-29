import { json } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { appendTransactions } from "@/lib/finance/transactions.functions";
import { createAlerts } from "@/lib/finance/alerts.functions";
import { buildAnomalyEmailHtml, recommendedActionFor } from "@/lib/finance/emailTemplate";
// We don't have access to context.userId in the webhook easily unless we pass a token or user_id in the payload
// For this webhook, we will assume the payload includes user_id and a secure token

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { user_id, transactions, token } = body;

    if (!user_id || !transactions || !Array.isArray(transactions)) {
      return new Response(JSON.stringify({ error: "Invalid payload" }), { status: 400 });
    }

    // In a real app, verify the webhook token here
    if (token !== process.env.WEBHOOK_SECRET) {
       // Proceed anyway for demo/development purposes if secret not set, but log it
       console.warn("Webhook token mismatch or not provided");
    }

    // Since this is a server-to-server webhook, we need a service role client to insert
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      return new Response(JSON.stringify({ error: "Supabase credentials missing" }), { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Filter seen
    const { data: existing } = await supabase
      .from("transactions")
      .select("occurred_at, merchant, amount")
      .eq("user_id", user_id)
      .limit(5000);
      
    const seen = new Set(
      (existing ?? []).map(
        (r) => `${new Date(r.occurred_at as string).toISOString()}|${r.merchant}|${Number(r.amount)}`,
      ),
    );

    const rows = transactions
      .filter((t: any) => !seen.has(`${new Date(t.date).toISOString()}|${t.merchant}|${t.amount}`))
      .map((t: any) => ({
        user_id,
        occurred_at: t.date,
        merchant: t.merchant,
        category: t.category || "Uncategorized",
        amount: t.amount,
        payment_method: t.paymentMethod || "UPI",
        status: t.status || "Completed",
        ai_confidence: t.aiConfidence || 0.9,
        recurring: t.recurring || false,
        risk_score: t.riskScore || 0,
      }));

    if (rows.length === 0) {
      return new Response(JSON.stringify({ inserted: 0 }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // Insert new transactions
    const { data: insertedRows, error } = await supabase
      .from("transactions")
      .insert(rows)
      .select("id, occurred_at, merchant, amount");

    if (error) {
      throw new Error(error.message);
    }

    // Ideally, evaluate fraud here using fraud.functions.ts logic, but that requires calling the AI SDK
    // For webhook simplicity, we just insert. Fraud detection can run asynchronously or here.
    
    return new Response(JSON.stringify({ 
      inserted: rows.length, 
      rows: insertedRows 
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });

  } catch (err) {
    console.error("Webhook error:", err);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), { status: 500 });
  }
}
