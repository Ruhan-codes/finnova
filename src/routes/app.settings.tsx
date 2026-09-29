import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut, Moon, RotateCcw, Smartphone, Sun } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { GlassCard } from "@/components/finance/GlassCard";
import { auth, useCurrentUser } from "@/lib/finance/auth";
import { useTheme } from "@/lib/finance/theme";
import { useReplaceTransactions } from "@/lib/finance/store";

export const Route = createFileRoute("/app/settings")({
  head: () => ({ meta: [{ title: "Settings — FinGuard AI" }, { name: "description", content: "Your account settings." }] }),
  component: Settings,
});

function Settings() {
  const nav = useNavigate();
  const queryClient = useQueryClient();
  const { theme, setTheme } = useTheme();
  const { user } = useCurrentUser();
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [pushAlerts, setPushAlerts] = useState(true);
  const [lang, setLang] = useState("en");
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);
  const replace = useReplaceTransactions();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage your profile and preferences.</p>
      </div>

      <GlassCard>
        <h3 className="mb-4 text-sm font-semibold">Profile</h3>
        <div className="flex items-center gap-4">
          <div className="grid h-14 w-14 place-items-center rounded-full gradient-brand text-lg font-semibold text-white">
            {(user?.firstName ?? "A")[0]}{(user?.lastName ?? "K")[0]}
          </div>
          <div>
            <p className="font-semibold">{user?.firstName ?? "Alex"} {user?.lastName ?? "Kumar"}</p>
            <p className="text-sm text-muted-foreground">{user?.email ?? "alex@example.com"}</p>
          </div>
        </div>
      </GlassCard>

      <GlassCard>
        <h3 className="mb-4 text-sm font-semibold">Theme</h3>
        <div className="flex gap-2">
          <button onClick={() => setTheme("light")} className={`flex flex-1 items-center justify-center gap-2 rounded-xl border py-2.5 text-sm ${theme === "light" ? "border-brand bg-brand/5" : ""}`}>
            <Sun className="h-4 w-4" /> Light
          </button>
          <button onClick={() => setTheme("dark")} className={`flex flex-1 items-center justify-center gap-2 rounded-xl border py-2.5 text-sm ${theme === "dark" ? "border-brand bg-brand/5" : ""}`}>
            <Moon className="h-4 w-4" /> Dark
          </button>
        </div>
      </GlassCard>

      <GlassCard>
        <h3 className="mb-4 text-sm font-semibold">Notifications</h3>
        <ToggleRow label="Email alerts" desc="Anomaly & weekly digests" checked={emailAlerts} onChange={setEmailAlerts} />
        <ToggleRow label="Push notifications" desc="Real-time alerts on device" checked={pushAlerts} onChange={setPushAlerts} />
      </GlassCard>

      <GlassCard>
        <h3 className="mb-4 text-sm font-semibold">Language</h3>
        <select value={lang} onChange={(e) => setLang(e.target.value)} className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm">
          <option value="en">English</option><option value="hi">हिन्दी</option><option value="ta">தமிழ்</option>
        </select>
      </GlassCard>

      <GlassCard>
        <h3 className="mb-4 text-sm font-semibold">Security · Connected Devices</h3>
        <div className="space-y-2">
          {["iPhone 15 Pro", "MacBook Pro"].map((d) => (
            <div key={d} className="flex items-center justify-between rounded-xl border bg-card/50 p-3 text-sm">
              <div className="flex items-center gap-2"><Smartphone className="h-4 w-4 text-brand" /> {d}</div>
              <button className="text-xs text-destructive hover:underline">Revoke</button>
            </div>
          ))}
        </div>
      </GlassCard>

      <button
        onClick={async () => {
          await queryClient.cancelQueries();
          queryClient.clear();
          await auth.signOut();
          nav({ to: "/login", replace: true });
        }}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-destructive/40 bg-destructive/5 py-3 text-sm font-medium text-destructive hover:bg-destructive/10"
      >
        <LogOut className="h-4 w-4" /> Sign out
      </button>

      <GlassCard>
        <h3 className="mb-2 text-sm font-semibold">Reset &amp; Start Over</h3>
        <p className="text-xs text-muted-foreground">Return FinGuard AI to its first-launch state. All imported transactions, alerts, insights and behaviour baselines will be removed.</p>
        <button
          onClick={() => setConfirmReset(true)}
          className="mt-3 inline-flex items-center gap-2 rounded-xl border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/10"
        >
          <RotateCcw className="h-4 w-4" /> Reset &amp; Start Over
        </button>
      </GlassCard>

      {confirmReset && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-sm" onClick={() => !resetting && setConfirmReset(false)}>
          <div onClick={(e) => e.stopPropagation()} className="glass w-full max-w-md rounded-3xl p-6">
            <h2 className="text-lg font-semibold">Reset FinGuard AI?</h2>
            <p className="mt-2 text-sm text-muted-foreground">This removes Imported Transactions, AI History, Charts, Insights, Alerts, Calendar, Financial Score, Behaviour Profile and Live Sync Baseline.</p>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setConfirmReset(false)} disabled={resetting} className="rounded-xl border px-4 py-2 text-sm hover:bg-secondary">Cancel</button>
              <button
                disabled={resetting}
                onClick={async () => {
                  setResetting(true);
                  try {
                    await replace.mutateAsync([]);
                    toast.success("FinGuard AI has been reset.");
                    nav({ to: "/import" });
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Reset failed.");
                    setResetting(false);
                  }
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-destructive px-4 py-2 text-sm font-medium text-white shadow disabled:opacity-60"
              >
                <RotateCcw className="h-4 w-4" /> {resetting ? "Resetting…" : "Reset & Start Over"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ToggleRow({ label, desc, checked, onChange }: { label: string; desc: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between border-b py-3 last:border-none">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
      <button onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 rounded-full transition ${checked ? "gradient-brand" : "bg-secondary"}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${checked ? "left-5" : "left-0.5"}`} />
      </button>
    </div>
  );
}
