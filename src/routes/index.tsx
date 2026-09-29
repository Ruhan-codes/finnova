import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useEffect } from "react";
import {
  Sparkles, ShieldCheck, LineChart, Bot, Zap, Lock, ArrowRight,
  PieChart, Bell, Wallet,
} from "lucide-react";
import { auth, subscribeAuth } from "@/lib/finance/auth";
import { listTransactions } from "@/lib/finance/transactions.functions";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "FinGuard AI — AI-powered Personal Finance Assistant" },
      { name: "description", content: "Detect anomalies, forecast spending, and get proactive AI insights on your money." },
      { property: "og:title", content: "FinGuard AI — AI-powered Personal Finance Assistant" },
      { property: "og:description", content: "Detect anomalies, forecast spending, and get proactive AI insights on your money." },
    ],
  }),
  component: Landing,
});

async function ensureProfileAndRoute(nav: (opts: { to: string; replace?: boolean }) => void) {
  await auth.ensureProfile();
  const onboarded = await auth.isOnboarded();
  if (!onboarded) {
    nav({ to: "/onboarding", replace: true });
    return;
  }
  try {
    const txs = await listTransactions();
    if (txs.length === 0) {
      nav({ to: "/import", replace: true });
      return;
    }
  } catch (e) {
    // Ignore and proceed to dashboard if check fails
  }
  nav({ to: "/app/dashboard", replace: true });
}

function Landing() {
  const nav = useNavigate();

  useEffect(() => {
    let cancelled = false;
    // On mount: if the user is already authenticated (e.g. returning from
    // OAuth callback which lands on origin), skip the marketing page and
    // route them straight into the app. Prevents redirect loops by using
    // history.replace.
    void (async () => {
      const session = await auth.getSession();
      if (!cancelled && session) await ensureProfileAndRoute(nav);
    })();
    // Also handle the OAuth flow that hydrates the session slightly after
    // mount (setSession() from broker completes async).
    const unsub = subscribeAuth((session) => {
      if (!cancelled && session) void ensureProfileAndRoute(nav);
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, [nav]);

  return (
    <div className="min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-x-0 top-[-200px] h-[500px] bg-[radial-gradient(ellipse_at_center,color-mix(in_oklab,var(--brand)_25%,transparent),transparent_70%)]" />
      <Nav />
      <Hero />
      <Features />
      <AssistantPreview />
      <Testimonials />
      <SecuritySection />
      <Footer />
    </div>
  );
}

function Nav() {
  return (
    <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
      <Link to="/" className="flex items-center gap-2">
        <div className="grid h-9 w-9 place-items-center rounded-xl gradient-brand text-white">
          <Sparkles className="h-5 w-5" />
        </div>
        <span className="text-lg font-semibold tracking-tight">FinGuard AI</span>
      </Link>
      <nav className="hidden gap-8 text-sm text-muted-foreground md:flex">
        <a href="#features" className="hover:text-foreground">Features</a>
        <a href="#assistant" className="hover:text-foreground">AI Assistant</a>
        <a href="#security" className="hover:text-foreground">Security</a>
      </nav>
      <div className="flex items-center gap-2">
        <Link to="/login" className="rounded-lg px-3 py-1.5 text-sm font-medium hover:bg-secondary">Login</Link>
        <Link
          to="/signup"
          className="rounded-lg gradient-brand px-4 py-1.5 text-sm font-medium text-white shadow-md transition hover:opacity-90"
        >
          Get Started
        </Link>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative mx-auto max-w-7xl px-6 pb-24 pt-16 text-center">
      <motion.div
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
        className="mx-auto inline-flex items-center gap-2 rounded-full border bg-card/60 px-3 py-1 text-xs backdrop-blur"
      >
        <span className="grid h-4 w-4 place-items-center rounded-full gradient-brand text-white">
          <Sparkles className="h-2.5 w-2.5" />
        </span>
        Introducing AI-powered financial intelligence
      </motion.div>
      <motion.h1
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, delay: 0.05 }}
        className="mx-auto mt-6 max-w-3xl text-5xl font-semibold tracking-tight md:text-6xl"
      >
        Your money, <span className="text-gradient-brand">understood</span>.
      </motion.h1>
      <motion.p
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, delay: 0.15 }}
        className="mx-auto mt-5 max-w-xl text-lg text-muted-foreground"
      >
        FinGuard AI analyzes your transactions, detects unusual spending, predicts expenses and delivers proactive insights — automatically.
      </motion.p>
      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}
        className="mt-8 flex flex-wrap items-center justify-center gap-3"
      >
        <Link
          to="/signup"
          className="group inline-flex items-center gap-2 rounded-full gradient-brand px-6 py-3 text-sm font-medium text-white shadow-lg"
        >
          Get started free <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
        </Link>
        <Link
          to="/login"
          className="inline-flex items-center gap-2 rounded-full border bg-card/70 px-6 py-3 text-sm font-medium backdrop-blur hover:bg-secondary"
        >
          Sign in
        </Link>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.25 }}
        className="relative mx-auto mt-16 max-w-5xl"
      >
        <div className="glass rounded-3xl p-4 shadow-2xl">
          <div className="grid gap-4 md:grid-cols-3">
            {[
              { icon: PieChart, label: "Monthly Spend", val: "₹58,420", tone: "text-brand" },
              { icon: Wallet, label: "Savings", val: "₹23,600", tone: "text-success" },
              { icon: Bell, label: "Anomalies", val: "3 detected", tone: "text-warning" },
            ].map((c) => (
              <div key={c.label} className="rounded-2xl border bg-card/70 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase text-muted-foreground">{c.label}</span>
                  <c.icon className={`h-4 w-4 ${c.tone}`} />
                </div>
                <p className="mt-3 text-2xl font-semibold">{c.val}</p>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </section>
  );
}

function Features() {
  const items = [
    { icon: Bot, title: "AI Categorization", desc: "Every transaction auto-categorized with confidence scores." },
    { icon: LineChart, title: "Spending Forecasts", desc: "Predict next month's expenses before they happen." },
    { icon: ShieldCheck, title: "Anomaly Detection", desc: "Get alerts the moment spending drifts from your pattern." },
    { icon: Zap, title: "Proactive Insights", desc: "Personalized nudges to help you save more, faster." },
    { icon: PieChart, title: "Live Analytics", desc: "Beautiful, real-time charts on every dimension of your money." },
    { icon: Lock, title: "Private by design", desc: "Your data is encrypted end-to-end and never sold." },
  ];
  return (
    <section id="features" className="mx-auto max-w-7xl px-6 py-24">
      <div className="mx-auto max-w-xl text-center">
        <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">Everything you need. Nothing you don't.</h2>
        <p className="mt-3 text-muted-foreground">A complete AI toolkit for personal finance.</p>
      </div>
      <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {items.map((f, i) => (
          <motion.div
            key={f.title}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: i * 0.05 }}
            className="glass rounded-2xl p-6 transition hover:-translate-y-0.5 hover:shadow-xl"
          >
            <div className="mb-4 grid h-10 w-10 place-items-center rounded-xl gradient-brand text-white">
              <f.icon className="h-5 w-5" />
            </div>
            <h3 className="font-semibold">{f.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

function AssistantPreview() {
  const msgs = [
    { role: "user", text: "Where am I spending the most?" },
    { role: "ai", text: "Your top category is Food at ₹18,240 (31% of spend). You spend 34% more on weekends." },
    { role: "user", text: "Can I save ₹5,000?" },
    { role: "ai", text: "Trimming 15% on Food + Shopping saves ~₹5,400 monthly. Want me to draft a plan?" },
  ];
  return (
    <section id="assistant" className="mx-auto max-w-7xl px-6 py-24">
      <div className="grid items-center gap-12 md:grid-cols-2">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs">
            <Bot className="h-3 w-3 text-brand" /> AI Assistant
          </div>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight md:text-4xl">Chat with your finances</h2>
          <p className="mt-4 text-muted-foreground">
            Ask anything — from "where did my money go this month" to "can I afford this trip". FinGuard reads your data and answers instantly.
          </p>
        </div>
        <div className="glass rounded-3xl p-4 shadow-2xl">
          <div className="space-y-2">
            {msgs.map((m, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 6 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className={m.role === "user" ? "flex justify-end" : "flex justify-start"}
              >
                <div className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm ${m.role === "user" ? "bg-brand text-brand-foreground rounded-br-sm" : "bg-secondary rounded-bl-sm"}`}>
                  {m.text}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function Testimonials() {
  const ts = [
    { name: "Priya S.", role: "Product Designer", text: "I finally know where my money goes. The weekly insights are eerily accurate." },
    { name: "Rahul K.", role: "Engineer", text: "The anomaly alerts caught a duplicate charge in my first week. Worth it already." },
    { name: "Meera J.", role: "Founder", text: "Feels like Notion for money. Clean, fast, and genuinely helpful." },
  ];
  return (
    <section className="mx-auto max-w-7xl px-6 py-24">
      <h2 className="text-center text-3xl font-semibold tracking-tight md:text-4xl">Loved by early users</h2>
      <div className="mt-12 grid gap-4 md:grid-cols-3">
        {ts.map((t) => (
          <div key={t.name} className="glass rounded-2xl p-6">
            <p className="text-sm">"{t.text}"</p>
            <div className="mt-4 flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-full gradient-brand text-xs font-semibold text-white">
                {t.name[0]}
              </div>
              <div>
                <p className="text-sm font-medium">{t.name}</p>
                <p className="text-xs text-muted-foreground">{t.role}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function SecuritySection() {
  return (
    <section id="security" className="mx-auto max-w-7xl px-6 py-24">
      <div className="glass grid gap-8 rounded-3xl p-10 md:grid-cols-2">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs">
            <Lock className="h-3 w-3 text-brand" /> Security
          </div>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight">Bank-grade security, by default</h2>
          <p className="mt-4 text-muted-foreground">
            End-to-end encryption. Zero data selling. Local-first analysis whenever possible. Your money data stays yours.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {["256-bit AES","SOC 2 aligned","Read-only access","No selling"].map((b) => (
            <div key={b} className="rounded-2xl border bg-card/60 p-4 text-sm">
              <ShieldCheck className="mb-2 h-5 w-5 text-success" />
              {b}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 py-8 md:flex-row">
        <div className="flex items-center gap-2">
          <div className="grid h-7 w-7 place-items-center rounded-lg gradient-brand text-white">
            <Sparkles className="h-3.5 w-3.5" />
          </div>
          <span className="text-sm font-medium">FinGuard AI</span>
        </div>
        <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} FinGuard AI. Built for the future of personal finance.</p>
      </div>
    </footer>
  );
}
