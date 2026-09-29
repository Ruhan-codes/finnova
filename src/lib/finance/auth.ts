// Real Supabase-backed auth adapter for FinGuard AI.
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import type { Session, User as SbUser } from "@supabase/supabase-js";

// Verbose auth diagnostics — visible in the browser console.
const AUTH_LOG = "[auth]";
const log = (...args: unknown[]) => console.info(AUTH_LOG, ...args);
const logErr = (...args: unknown[]) => console.error(AUTH_LOG, ...args);

export type User = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  verified: boolean;
  avatarUrl?: string;
  onboarded?: boolean;
};

export type SignUpResult = {
  user: User | null;
  needsConfirmation: boolean;
  email: string;
};

function toUser(sb: SbUser | null | undefined, onboarded?: boolean): User | null {
  if (!sb) return null;
  const meta = (sb.user_metadata ?? {}) as Record<string, unknown>;
  const first =
    (meta.first_name as string) ||
    (meta.given_name as string) ||
    ((meta.full_name as string) ?? "").split(" ")[0] ||
    ((meta.name as string) ?? "").split(" ")[0] ||
    (sb.email ?? "user").split("@")[0];
  const last =
    (meta.last_name as string) ||
    (meta.family_name as string) ||
    ((meta.full_name as string) ?? "").split(" ").slice(1).join(" ") ||
    "";
  return {
    id: sb.id,
    email: sb.email ?? "",
    firstName: first,
    lastName: last,
    verified: !!sb.email_confirmed_at || sb.app_metadata?.provider !== "email",
    avatarUrl: (meta.avatar_url as string) || (meta.picture as string) || undefined,
    onboarded,
  };
}

async function ensureProfileForUser(user?: SbUser | null) {
  const target = user ?? (await supabase.auth.getUser()).data.user;
  if (!target) return;
  const meta = (target.user_metadata ?? {}) as Record<string, unknown>;
  const first =
    (meta.first_name as string) ||
    (meta.given_name as string) ||
    ((meta.full_name as string) ?? "").split(" ")[0] ||
    ((meta.name as string) ?? "").split(" ")[0] ||
    (target.email ?? "user").split("@")[0];
  const last =
    (meta.last_name as string) ||
    (meta.family_name as string) ||
    ((meta.full_name as string) ?? "").split(" ").slice(1).join(" ") ||
    "";
  const { error } = await supabase.from("profiles").upsert(
    {
      id: target.id,
      first_name: first,
      last_name: last,
      avatar_url: (meta.avatar_url as string) || (meta.picture as string) || null,
      email: target.email ?? null,
    },
    { onConflict: "id" },
  );
  if (error) logErr("ensureProfile warning:", error.message);
}

export const auth = {
  async getSession(): Promise<Session | null> {
    const { data } = await supabase.auth.getSession();
    return data.session;
  },
  async currentUser(): Promise<User | null> {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return null;
    // Try to read onboarded flag from profile (best effort).
    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarded, first_name, last_name, avatar_url")
      .eq("id", data.user.id)
      .maybeSingle();
    const u = toUser(data.user, profile?.onboarded ?? false);
    if (u && profile) {
      if (profile.first_name) u.firstName = profile.first_name;
      if (profile.last_name) u.lastName = profile.last_name;
      if (profile.avatar_url) u.avatarUrl = profile.avatar_url;
    }
    return u;
  },
  async signInWithPassword(email: string, password: string) {
    log("signInWithPassword start", { email });
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      logErr("signInWithPassword failed:", error.message);
      throw error;
    }
    log("signInWithPassword success", { userId: data.user?.id });
    await ensureProfileForUser(data.user);
    return toUser(data.user);
  },
  async signUp(input: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
  }): Promise<SignUpResult> {
    log("signUp start", { email: input.email });
    const emailRedirectTo =
      typeof window !== "undefined" ? `${window.location.origin}/auth/callback` : undefined;
    const { data, error } = await supabase.auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        emailRedirectTo,
        data: {
          first_name: input.firstName,
          last_name: input.lastName,
          full_name: `${input.firstName} ${input.lastName}`.trim(),
        },
      },
    });
    if (error) {
      logErr("signUp failed:", error.message);
      throw error;
    }
    log("signUp success", {
      userId: data.user?.id,
      session: !!data.session,
      needsConfirmation: !data.session,
    });
    if (data.session?.user) {
      await ensureProfileForUser(data.session.user);
    }
    return {
      user: toUser(data.user),
      needsConfirmation: !data.session,
      email: input.email,
    };
  },
  async signInWithGoogle() {
    // Lovable Cloud managed Google OAuth. The broker handles the popup,
    // web_message response, and setSession — nothing else to configure.
    const redirectUri =
      typeof window !== "undefined" ? `${window.location.origin}/auth/callback` : undefined;
    log("google OAuth (managed) start", { redirectUri });
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: redirectUri,
      extraParams: { prompt: "select_account" },
    });
    if (result.error) {
      logErr("google OAuth failed:", result.error);
      throw result.error instanceof Error ? result.error : new Error(String(result.error));
    }
    if (!result.redirected) {
      await ensureProfileForUser();
    }
    log("google OAuth result", { redirected: !!result.redirected });
    return result;
  },
  async resendVerification(email: string) {
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: {
        emailRedirectTo:
          typeof window !== "undefined" ? `${window.location.origin}/auth/callback` : undefined,
      },
    });
    if (error) throw error;
  },
  async sendPasswordReset(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo:
        typeof window !== "undefined" ? `${window.location.origin}/reset-password` : undefined,
    });
    if (error) throw error;
  },
  async updatePassword(password: string) {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
  },
  async signOut() {
    log("signOut");
    await supabase.auth.signOut();
  },
  async ensureProfile(user?: SbUser | null) {
    await ensureProfileForUser(user);
  },
  async markOnboarded() {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    await supabase.from("profiles").update({ onboarded: true }).eq("id", data.user.id);
  },
  async isOnboarded(): Promise<boolean> {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return false;
    const { data: p } = await supabase
      .from("profiles")
      .select("onboarded")
      .eq("id", data.user.id)
      .maybeSingle();
    return !!p?.onboarded;
  },
};

export function subscribeAuth(cb: (session: Session | null) => void) {
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    log("onAuthStateChange", { event, hasSession: !!session, userId: session?.user?.id });
    cb(session);
  });
  return () => data.subscription.unsubscribe();
}

// React hook: current user, keeps in sync with auth state changes.
import { useEffect, useState } from "react";
export function useCurrentUser() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    auth.currentUser().then((u) => {
      if (!cancelled) {
        setUser(u);
        setLoading(false);
      }
    });
    const unsub = subscribeAuth(async () => {
      const u = await auth.currentUser();
      if (!cancelled) setUser(u);
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);
  return { user, loading };
}
