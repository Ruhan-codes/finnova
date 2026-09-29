import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { AuthShell, Input } from "./login";
import { auth } from "@/lib/finance/auth";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Set a new password — FinGuard AI" },
      { name: "description", content: "Choose a new password for your FinGuard AI account." },
      { property: "og:title", content: "Set a new password — FinGuard AI" },
      { property: "og:description", content: "Update your FinGuard AI password." },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const nav = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords don't match");
      return;
    }
    setLoading(true);
    try {
      await auth.updatePassword(password);
      toast.success("Password updated");
      nav({ to: "/app/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Set a new password" subtitle="Choose a strong password you'll remember">
      <form onSubmit={submit} className="space-y-3">
        <Input label="New password" type="password" value={password} onChange={setPassword} required />
        <Input label="Confirm password" type="password" value={confirm} onChange={setConfirm} required />
        <button
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-xl gradient-brand py-2.5 text-sm font-medium text-white disabled:opacity-60"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />} Update password
        </button>
      </form>
      <p className="mt-6 text-center text-xs text-muted-foreground">
        <Link to="/login" className="text-brand hover:underline">
          Back to sign in
        </Link>
      </p>
    </AuthShell>
  );
}
