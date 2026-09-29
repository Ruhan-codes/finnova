import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, ShieldCheck, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { auth, subscribeAuth } from "@/lib/finance/auth";

// OAuth / email-confirmation return target.
// Supabase JS parses the fragment (implicit) or ?code=... (PKCE) from the
// URL automatically because the client is configured with detectSessionInUrl:true.
// This route waits for that session to hydrate, ensures a profile row exists,
// then routes into the app.
export const Route = createFileRoute("/auth/callback")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Signing you in — FinGuard AI" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AuthCallback,
});

function AuthCallback() {
  const nav = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("Establishing secure session…");

  useEffect(() => {
    let cancelled = false;
    console.info("[auth-callback] mounted", { href: window.location.href });

    // Surface provider errors from the URL (e.g. ?error=access_denied).
    const url = new URL(window.location.href);
    const providerError = url.searchParams.get("error_description") || url.searchParams.get("error");
    if (providerError) {
      console.error("[auth-callback] provider returned error:", providerError);
      setError(providerError);
      return;
    }

    const finish = async () => {
      const { data, error: sessErr } = await supabase.auth.getSession();
      if (sessErr) {
        console.error("[auth-callback] getSession error:", sessErr.message);
        setError(sessErr.message);
        return;
      }
      const user = data.session?.user;
      if (!user) {
        console.info("[auth-callback] no session yet, waiting for onAuthStateChange…");
        return; // wait for the SIGNED_IN event below
      }
      console.info("[auth-callback] session hydrated", { userId: user.id, email: user.email });

      try {
        await auth.ensureProfile(user);
        console.info("[auth-callback] profile ensured");
      } catch (e) {
        console.warn("[auth-callback] profile upsert threw:", e);
      }

      setStatus("Loading your dashboard…");
      const onboarded = await auth.isOnboarded();
      console.info("[auth-callback] routing", { onboarded });
      if (!cancelled) nav({ to: onboarded ? "/app/dashboard" : "/onboarding", replace: true });
    };

    // Attempt an immediate finish (handles hash-flow where the session is
    // already in place by the time we mount), and also listen for the
    // SIGNED_IN event in case detectSessionInUrl is still parsing.
    void finish();
    const unsub = subscribeAuth((session) => {
      if (session && !cancelled) void finish();
    });

    // Safety timeout — if nothing hydrates within 10s, surface an error.
    const t = window.setTimeout(() => {
      if (cancelled) return;
      supabase.auth.getSession().then(({ data }) => {
        if (!data.session) {
          console.error("[auth-callback] timeout — no session after 10s");
          setError(
            "We couldn't complete sign-in. Please return to sign in and try again.",
          );
        }
      });
    }, 10_000);

    return () => {
      cancelled = true;
      window.clearTimeout(t);
      unsub();
    };
  }, [nav]);

  return (
    <div className="grid min-h-screen place-items-center bg-background px-4 text-center">
      <div className="max-w-md">
        {error ? (
          <>
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-destructive/10 text-destructive">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <h1 className="mt-4 text-lg font-semibold">Sign-in didn't complete</h1>
            <p className="mt-2 text-sm text-muted-foreground">{error}</p>
            <button
              onClick={() => nav({ to: "/login", replace: true })}
              className="mt-4 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Back to sign in
            </button>
          </>
        ) : (
          <>
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl gradient-brand text-white">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <h1 className="mt-4 text-lg font-semibold">Securing your session</h1>
            <p className="mt-2 flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {status}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
