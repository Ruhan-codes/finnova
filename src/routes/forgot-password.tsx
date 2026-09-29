import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { AuthShell, Input } from "./login";
import { auth } from "@/lib/finance/auth";
import { toast } from "sonner";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Reset password — FinGuard AI" },
      { name: "description", content: "Reset your FinGuard AI password." },
      { property: "og:title", content: "Reset password — FinGuard AI" },
      { property: "og:description", content: "Recover access to your FinGuard AI account." },
    ],
  }),
  component: Forgot,
});

function Forgot() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await auth.sendPasswordReset(email);
      setSent(true);
      toast.success("Reset link sent");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send reset link");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Reset password" subtitle="We'll send you a reset link">
      {sent ? (
        <div className="rounded-xl border bg-secondary/50 p-4 text-sm">
          If <b>{email}</b> is registered, a reset link is on the way. Check your inbox and spam folder.
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <Input label="Email" type="email" value={email} onChange={setEmail} required />
          <button
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl gradient-brand py-2.5 text-sm font-medium text-white disabled:opacity-60"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />} Send reset link
          </button>
        </form>
      )}
      <p className="mt-6 text-center text-xs text-muted-foreground">
        <Link to="/login" className="text-brand hover:underline">
          Back to sign in
        </Link>
      </p>
    </AuthShell>
  );
}
