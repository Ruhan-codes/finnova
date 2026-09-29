import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { AuthShell, Input, Divider, GoogleIcon } from "./login";
import { auth } from "@/lib/finance/auth";
import { toast } from "sonner";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Create account — FinGuard AI" },
      { name: "description", content: "Create your FinGuard AI account and understand your money." },
      { property: "og:title", content: "Create account — FinGuard AI" },
      { property: "og:description", content: "Sign up for FinGuard AI." },
    ],
  }),
  component: Signup,
});

function Signup() {
  const nav = useNavigate();
  const search = useSearch({ strict: false }) as { email?: string; sent?: string };
  const [firstName, setFirst] = useState("");
  const [lastName, setLast] = useState("");
  const [email, setEmail] = useState(search.email ?? "");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [verificationSent, setVerificationSent] = useState(search.sent === "1");
  const [resending, setResending] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      toast.error("Passwords don't match");
      return;
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setLoading(true);
    try {
      const result = await auth.signUp({ firstName, lastName, email, password });
      if (result.needsConfirmation) {
        setVerificationSent(true);
        toast.success("Verification email sent successfully.");
        return;
      }
      if (result.user) {
        const onboarded = await auth.isOnboarded();
        toast.success("Account created");
        nav({ to: onboarded ? "/app/dashboard" : "/onboarding" });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign up failed");
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    if (!email) {
      toast.error("Enter your email first");
      return;
    }
    setResending(true);
    try {
      await auth.resendVerification(email);
      toast.success("Verification email sent successfully.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not resend email");
    } finally {
      setResending(false);
    }
  };

  const googleSignUp = async () => {
    setGoogleLoading(true);
    try {
      const result = await auth.signInWithGoogle();
      if (result.redirected) return;
      const onboarded = await auth.isOnboarded();
      nav({ to: onboarded ? "/app/dashboard" : "/onboarding" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Google sign-in failed");
      setGoogleLoading(false);
    }
  };

  if (verificationSent) {
    return (
      <AuthShell title="Verify your email" subtitle="Finish activating your FinGuard AI account">
        <div className="rounded-xl border border-success/30 bg-success/10 p-4 text-sm">
          <p className="font-medium text-foreground">Verification email sent successfully.</p>
          <p className="mt-2 text-muted-foreground">Please verify your email before logging in.</p>
        </div>
        <button
          type="button"
          onClick={resend}
          disabled={resending}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border bg-card px-4 py-2.5 text-sm font-medium hover:bg-secondary disabled:opacity-60"
        >
          {resending && <Loader2 className="h-4 w-4 animate-spin" />} Resend Email
        </button>
        <Link
          to="/login"
          className="mt-3 flex w-full items-center justify-center rounded-xl gradient-brand py-2.5 text-sm font-medium text-white shadow-md"
        >
          Back to Login
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Create your account" subtitle="Start understanding your money in minutes">
      <button
        type="button"
        onClick={googleSignUp}
        disabled={googleLoading || loading}
        className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl border bg-card px-4 py-2.5 text-sm font-medium hover:bg-secondary disabled:opacity-60"
      >
        {googleLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleIcon />} Continue with Google
      </button>
      <Divider />
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Input label="First name" value={firstName} onChange={setFirst} required />
          <Input label="Last name" value={lastName} onChange={setLast} required />
        </div>
        <Input label="Email" type="email" value={email} onChange={setEmail} required />
        <Input label="Password" type="password" value={password} onChange={setPassword} required />
        <Input label="Confirm password" type="password" value={confirm} onChange={setConfirm} required />
        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-xl gradient-brand py-2.5 text-sm font-medium text-white shadow-md disabled:opacity-60"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />} Sign up
        </button>
      </form>
      <p className="mt-6 text-center text-xs text-muted-foreground">
        Already have an account?{" "}
        <Link to="/login" className="text-brand hover:underline">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
