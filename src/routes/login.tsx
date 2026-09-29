import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Sparkles, Loader2 } from "lucide-react";
import { useState } from "react";
import { auth } from "@/lib/finance/auth";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — FinGuard AI" },
      { name: "description", content: "Sign in to FinGuard AI, your AI financial assistant." },
      { property: "og:title", content: "Sign in — FinGuard AI" },
      { property: "og:description", content: "Sign in to your FinGuard AI account." },
    ],
  }),
  component: Login,
});

function Login() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [needsConfirm, setNeedsConfirm] = useState(false);
  const [resending, setResending] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const routeAfterAuth = async () => {
    const onboarded = await auth.isOnboarded();
    nav({ to: onboarded ? "/app/dashboard" : "/onboarding" });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setNeedsConfirm(false);
    try {
      await auth.signInWithPassword(email, password);
      if (remember && typeof window !== "undefined") {
        localStorage.setItem("fg-remember", "1");
      }
      toast.success("Welcome back");
      await routeAfterAuth();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Sign in failed";
      if (/email.*not.*confirm/i.test(msg)) {
        setNeedsConfirm(true);
        toast.error("Please verify your email to continue.");
      } else {
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    if (!email) {
      toast.error("Enter your email above first");
      return;
    }
    setResending(true);
    try {
      await auth.resendVerification(email);
      toast.success("Confirmation email sent. Check your inbox.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not resend email");
    } finally {
      setResending(false);
    }
  };

  const googleSignIn = async () => {
    setGoogleLoading(true);
    try {
      const result = await auth.signInWithGoogle();
      if (result.redirected) return;
      toast.success("Signed in with Google");
      await routeAfterAuth();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Google sign-in failed");
      setGoogleLoading(false);
    }
  };

  return (
    <AuthShell title="Welcome back" subtitle="Sign in to your FinGuard AI account">
      <button
        type="button"
        onClick={googleSignIn}
        disabled={googleLoading || loading}
        className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl border bg-card px-4 py-2.5 text-sm font-medium hover:bg-secondary disabled:opacity-60"
      >
        {googleLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleIcon />} Continue with Google
      </button>
      <Divider />
      <form onSubmit={submit} className="space-y-3">
        <Input label="Email" type="email" required value={email} onChange={setEmail} />
        <Input label="Password" type="password" required value={password} onChange={setPassword} />
        {needsConfirm && (
          <div className="rounded-xl border border-amber-300/60 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
            Your email isn't verified yet. Check your inbox for the confirmation link, or{" "}
            <button
              type="button"
              onClick={resend}
              disabled={resending}
              className="font-medium underline underline-offset-2 disabled:opacity-60"
            >
              {resending ? "sending…" : "resend it"}
            </button>
            .
          </div>
        )}
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="h-3.5 w-3.5 rounded border"
            />
            Remember me
          </label>
          <Link to="/forgot-password" className="text-xs text-brand hover:underline">
            Forgot password?
          </Link>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-xl gradient-brand py-2.5 text-sm font-medium text-white shadow-md disabled:opacity-60"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />} Sign in
        </button>
      </form>
      <p className="mt-6 text-center text-xs text-muted-foreground">
        New here?{" "}
        <Link to="/signup" className="text-brand hover:underline">
          Create an account
        </Link>
      </p>
    </AuthShell>
  );
}

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-screen bg-background md:grid-cols-2">
      <div className="relative hidden overflow-hidden gradient-brand p-10 text-white md:flex md:flex-col">
        <Link to="/" className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-white/20">
            <Sparkles className="h-5 w-5" />
          </div>
          <span className="text-lg font-semibold">FinGuard AI</span>
        </Link>
        <div className="mt-auto">
          <p className="text-2xl font-semibold leading-snug">
            "FinGuard caught a duplicate charge in my first week — the anomaly detection is scary good."
          </p>
          <p className="mt-4 text-sm opacity-80">— Rahul K., Engineer</p>
        </div>
        <div className="pointer-events-none absolute -bottom-20 -right-20 h-72 w-72 rounded-full bg-white/20 blur-3xl" />
      </div>
      <div className="flex flex-col items-center justify-center px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-sm"
        >
          <div className="md:hidden mb-6 flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-xl gradient-brand text-white">
              <Sparkles className="h-4 w-4" />
            </div>
            <span className="font-semibold">FinGuard AI</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          <div className="mt-8">{children}</div>
        </motion.div>
      </div>
    </div>
  );
}

export function Input({
  label,
  value,
  onChange,
  type = "text",
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <input
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-xl border bg-card px-3 py-2.5 text-sm outline-none transition focus:ring-2 focus:ring-brand/40"
      />
    </label>
  );
}

export function Divider() {
  return (
    <div className="my-4 flex items-center gap-3 text-[10px] uppercase tracking-wider text-muted-foreground">
      <div className="h-px flex-1 bg-border" /> or <div className="h-px flex-1 bg-border" />
    </div>
  );
}

export function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48">
      <path
        fill="#EA4335"
        d="M24 9.5c3.5 0 6.6 1.2 9 3.5l6.7-6.7C35.5 2.4 30.1 0 24 0 14.6 0 6.4 5.4 2.5 13.3l7.9 6.1C12.4 13.1 17.7 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.5 24.5c0-1.6-.1-3.2-.4-4.6H24v9.1h12.7c-.6 3-2.2 5.5-4.7 7.2l7.4 5.8c4.3-4 6.9-9.9 6.9-17.5z"
      />
      <path
        fill="#FBBC05"
        d="M10.4 28.6c-.5-1.5-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C.9 16.8 0 20.3 0 24s.9 7.2 2.5 10.7l7.9-6.1z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.1 0 11.3-2 15-5.5l-7.4-5.8c-2 1.4-4.6 2.2-7.6 2.2-6.3 0-11.6-3.6-13.6-9.4l-7.9 6.1C6.4 42.6 14.6 48 24 48z"
      />
    </svg>
  );
}
