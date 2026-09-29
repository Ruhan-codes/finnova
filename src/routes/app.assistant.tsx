import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { Bot, Send, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { GlassCard } from "@/components/finance/GlassCard";
import { chatWithAssistant } from "@/lib/ai/assistant.functions";
import { buildFinanceSummary, summaryToPrompt } from "@/lib/finance/summary";
import { useTransactions } from "@/lib/finance/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/assistant")({
  head: () => ({
    meta: [
      { title: "AI Assistant — FinGuard AI" },
      { name: "description", content: "Chat with a real AI financial advisor trained on your own transactions." },
    ],
  }),
  component: Assistant,
});

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTED = [
  "Where am I spending the most?",
  "How can I save money?",
  "Predict next month's expenses",
  "Show my subscriptions",
  "Which category increased this month?",
  "Am I overspending?",
  "Can I afford a ₹70,000 phone?",
  "Explain my financial health",
];

function Assistant() {
  const txs = useTransactions();
  const [msgs, setMsgs] = useState<Msg[]>([
    {
      role: "assistant",
      content:
        "Hi 👋 I'm your **FinGuard AI** advisor. I read your imported transactions in real time — ask about spending, savings, subscriptions, affordability, or forecasts.",
    },
  ]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [status, setStatus] = useState("Thinking…");
  const ref = useRef<HTMLDivElement>(null);
  const chat = useServerFn(chatWithAssistant);

  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight, behavior: "smooth" });
  }, [msgs, typing]);

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || typing) return;
    const next: Msg[] = [...msgs, { role: "user", content: q }];
    setMsgs(next);
    setInput("");
    setTyping(true);
    setStatus("Thinking…");
    const t = setTimeout(() => setStatus("Generating insights…"), 1200);
    try {
      const financeContext = summaryToPrompt(buildFinanceSummary(txs));
      const { text: reply } = await chat({
        data: {
          messages: next.map((m) => ({ role: m.role, content: m.content })),
          financeContext,
        },
      });
      setMsgs((m) => [...m, { role: "assistant", content: reply }]);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong.";
      setMsgs((m) => [...m, { role: "assistant", content: `⚠️ ${message}` }]);
    } finally {
      clearTimeout(t);
      setTyping(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-2xl gradient-brand text-white">
          <Sparkles className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-3xl font-semibold">AI Assistant</h1>
          <p className="text-sm text-muted-foreground">
            Your personal finance advisor · analyzing {txs.length} transactions
          </p>
        </div>
      </div>

      <GlassCard className="flex h-[65vh] flex-col p-0">
        <div ref={ref} className="flex-1 space-y-3 overflow-y-auto p-6">
          {msgs.map((m, i) => (
            <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
                  m.role === "user"
                    ? "bg-brand text-brand-foreground rounded-br-sm"
                    : "bg-secondary rounded-bl-sm",
                )}
              >
                {m.role === "assistant" && (
                  <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-brand">
                    <Bot className="h-3 w-3" /> FinGuard AI
                  </div>
                )}
                <div className="prose prose-sm max-w-none dark:prose-invert prose-p:my-1 prose-strong:text-current">
                  <ReactMarkdown>{m.content}</ReactMarkdown>
                </div>
              </motion.div>
            </div>
          ))}
          {typing && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 rounded-2xl bg-secondary px-3 py-2.5">
                {[0, 1, 2].map((i) => (
                  <motion.span
                    key={i}
                    className="h-1.5 w-1.5 rounded-full bg-muted-foreground"
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.15 }}
                  />
                ))}
              </div>
              <span className="text-xs text-muted-foreground">{status}</span>
            </div>
          )}
        </div>

        <div className="border-t p-4">
          <div className="mb-3 flex flex-wrap gap-2">
            {SUGGESTED.map((q) => (
              <button
                key={q}
                onClick={() => send(q)}
                disabled={typing}
                className="rounded-full border bg-card px-3 py-1 text-xs hover:bg-secondary disabled:opacity-50"
              >
                {q}
              </button>
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
            className="flex gap-2"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about your finances…"
              className="flex-1 rounded-full border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand/40"
            />
            <button
              type="submit"
              disabled={!input.trim() || typing}
              className="grid h-10 w-10 place-items-center rounded-full gradient-brand text-white disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      </GlassCard>
    </div>
  );
}
