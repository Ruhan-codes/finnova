import { AnimatePresence, motion } from "framer-motion";
import { Bot, Send, X, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { useServerFn } from "@tanstack/react-start";
import { chatWithAssistant } from "@/lib/ai/assistant.functions";
import { buildFinanceSummary, summaryToPrompt } from "@/lib/finance/summary";
import { useTransactions } from "@/lib/finance/store";
import { cn } from "@/lib/utils";

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTED = [
  "Where am I spending the most?",
  "How can I save money?",
  "Predict next month's expenses",
  "Show my subscriptions",
];

export function FloatingAssistant() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([
    { role: "assistant", content: "Hi! I'm your FinGuard AI. Ask me anything about your spending." },
  ]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const txs = useTransactions();
  const scrollRef = useRef<HTMLDivElement>(null);
  const chat = useServerFn(chatWithAssistant);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, typing, open]);

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || typing) return;
    const next: Msg[] = [...msgs, { role: "user", content: q }];
    setMsgs(next);
    setInput("");
    setTyping(true);
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
      setTyping(false);
    }
  };

  return (
    <>
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-6 right-6 z-40 grid h-14 w-14 place-items-center rounded-full gradient-brand text-white shadow-2xl"
        aria-label="Open AI assistant"
      >
        {open ? <X className="h-6 w-6" /> : <Bot className="h-6 w-6" />}
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.96 }}
            transition={{ type: "spring", damping: 22, stiffness: 260 }}
            className="fixed bottom-24 right-6 z-40 flex h-[560px] w-[380px] max-w-[calc(100vw-2rem)] flex-col rounded-2xl border bg-card shadow-2xl"
          >
            <div className="flex items-center gap-3 rounded-t-2xl border-b gradient-brand px-4 py-3 text-white">
              <div className="grid h-8 w-8 place-items-center rounded-full bg-white/20">
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold">FinGuard AI</p>
                <p className="text-[10px] opacity-80">Analyzing {txs.length} transactions</p>
              </div>
              <button onClick={() => setOpen(false)} className="rounded-lg p-1 hover:bg-white/10">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
              {msgs.map((m, i) => (
                <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                  <div
                    className={cn(
                      "max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed",
                      m.role === "user"
                        ? "bg-brand text-brand-foreground rounded-br-sm"
                        : "bg-secondary text-foreground rounded-bl-sm",
                    )}
                  >
                    <div className="prose prose-sm max-w-none dark:prose-invert prose-p:my-1 prose-strong:text-current">
                      <ReactMarkdown>{m.content}</ReactMarkdown>
                    </div>
                  </div>
                </div>
              ))}
              {typing && (
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 rounded-2xl bg-secondary px-3 py-2">
                    {[0, 1, 2].map((i) => (
                      <motion.span
                        key={i}
                        className="h-1.5 w-1.5 rounded-full bg-muted-foreground"
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.15 }}
                      />
                    ))}
                  </div>
                  <span className="text-[11px] text-muted-foreground">Thinking…</span>
                </div>
              )}
            </div>

            {msgs.length <= 1 && (
              <div className="border-t px-3 py-2">
                <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Suggested
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {SUGGESTED.map((q) => (
                    <button
                      key={q}
                      onClick={() => send(q)}
                      disabled={typing}
                      className="rounded-full border bg-background px-2.5 py-1 text-[11px] hover:bg-secondary disabled:opacity-50"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <form
              onSubmit={(e) => { e.preventDefault(); void send(input); }}
              className="flex items-center gap-2 border-t p-3"
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about your finances…"
                className="flex-1 rounded-full border bg-background px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-brand/40"
              />
              <button
                type="submit"
                className="grid h-9 w-9 place-items-center rounded-full gradient-brand text-white disabled:opacity-50"
                disabled={!input.trim() || typing}
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
