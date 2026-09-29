import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  LayoutDashboard, Receipt, Bot, PieChart, Wallet, ShieldAlert,
  Activity, Bell, Settings, LogOut, Moon, Sun, Sparkles, Radio, CalendarDays,
  Flame, Menu, X, Droplet, Beaker, Globe, ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { auth, useCurrentUser } from "@/lib/finance/auth";
import { useTheme } from "@/lib/finance/theme";
import { useI18n, LANGUAGES, type Lang } from "@/lib/i18n";
import { FloatingAssistant } from "./FloatingAssistant";

export function AppShell() {
  const nav = useNavigate();
  const queryClient = useQueryClient();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { theme, toggle } = useTheme();
  const { user } = useCurrentUser();
  const { t, lang, setLang } = useI18n();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);

  useEffect(() => { setMobileOpen(false); setLangOpen(false); }, [path]);

  const NAV = [
    { to: "/app/dashboard", label: t("dashboard"), icon: LayoutDashboard },
    { to: "/app/smartsave", label: t("smartsave"), icon: Flame },
    { to: "/app/transactions", label: t("transactions"), icon: Receipt },
    { to: "/app/livesync", label: t("livesync"), icon: Radio },
    { to: "/app/assistant", label: t("assistant"), icon: Bot },
    { to: "/app/insights", label: t("insights"), icon: PieChart },
    { to: "/app/budget", label: t("budget"), icon: Wallet },
    { to: "/app/moneyleaks", label: t("moneyleaks"), icon: Droplet },
    { to: "/app/simulator", label: t("simulator"), icon: Beaker },
    { to: "/app/anomalies", label: t("anomalies"), icon: ShieldAlert },
    { to: "/app/monitor", label: t("monitor"), icon: Activity },
    { to: "/app/alerts", label: t("alerts"), icon: Bell },
    { to: "/app/calendar", label: t("calendar"), icon: CalendarDays },
    { to: "/app/settings", label: t("settings"), icon: Settings },
  ] as const;

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await auth.signOut();
    nav({ to: "/login", replace: true });
  };

  const LangSelector = ({ compact }: { compact?: boolean }) => {
    const cur = LANGUAGES.find((l) => l.code === lang) ?? LANGUAGES[0];
    return (
      <div className="relative">
        <button
          onClick={() => setLangOpen((v) => !v)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg border bg-card px-2.5 py-1.5 text-xs font-medium hover:bg-secondary",
            compact ? "" : "",
          )}
          aria-label="Change language"
        >
          <Globe className="h-3.5 w-3.5" />
          <span>{cur.native}</span>
          <ChevronDown className="h-3 w-3 opacity-60" />
        </button>
        {langOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setLangOpen(false)} />
            <div className="absolute right-0 top-full z-50 mt-1 w-40 overflow-hidden rounded-lg border bg-popover shadow-lg">
              {LANGUAGES.map((l) => (
                <button
                  key={l.code}
                  onClick={() => { setLang(l.code as Lang); setLangOpen(false); }}
                  className={cn(
                    "flex w-full items-center justify-between px-3 py-2 text-xs hover:bg-secondary",
                    l.code === lang && "bg-brand/10 text-brand font-medium",
                  )}
                >
                  <span>{l.native}</span>
                  <span className="text-[10px] uppercase text-muted-foreground">{l.code}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    );
  };

  const SidebarBody = (
    <>
      <div className="flex items-center gap-2 px-5 pt-5">
        <div className="grid h-9 w-9 place-items-center rounded-xl gradient-brand text-white">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-tight">FinGuard AI</p>
          <p className="text-[10px] text-muted-foreground">Personal Finance</p>
        </div>
      </div>
      <nav className="mt-6 flex-1 space-y-0.5 overflow-y-auto px-3 pb-3">
        {NAV.map(({ to, label, icon: Icon }) => {
          const active = path === to;
          return (
            <Link
              key={to}
              to={to}
              className={cn(
                "group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-all",
                active
                  ? "bg-brand text-brand-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="border-t p-3">
        <div className="mb-2 flex items-center gap-2 rounded-xl bg-secondary/60 p-2">
          <div className="grid h-8 w-8 place-items-center rounded-full gradient-brand text-xs font-semibold text-white">
            {(user?.firstName ?? "A")[0]}{(user?.lastName ?? "K")[0]}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium">{user?.firstName ?? "User"} {user?.lastName ?? ""}</p>
            <p className="truncate text-[10px] text-muted-foreground">{user?.email ?? ""}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={toggle}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg border px-2 py-1.5 text-xs hover:bg-secondary"
          >
            {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
            {theme === "dark" ? "Light" : "Dark"}
          </button>
          <button
            onClick={signOut}
            className="flex items-center justify-center rounded-lg border px-2 py-1.5 text-xs hover:bg-destructive/10 hover:text-destructive"
            aria-label="Log out"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Mobile top bar */}
      <header className="sticky top-0 z-40 flex items-center justify-between gap-2 border-b bg-card/80 px-4 py-3 backdrop-blur md:hidden">
        <div className="flex min-w-0 items-center gap-2">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg gradient-brand text-white">
            <Sparkles className="h-4 w-4" />
          </div>
          <p className="truncate text-sm font-semibold">FinGuard AI</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <LangSelector compact />
          <button
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
            className="grid h-9 w-9 place-items-center rounded-lg border"
          >
            <Menu className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            aria-label="Close menu"
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute left-0 top-0 flex h-full w-72 max-w-[85vw] flex-col border-r bg-card shadow-xl">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-lg border"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
            {SidebarBody}
          </aside>
        </div>
      )}

      <div className="flex">
        <aside className="sticky top-0 hidden h-screen w-64 flex-col border-r bg-card/50 backdrop-blur-md md:flex">
          {SidebarBody}
        </aside>

        <main className="min-w-0 flex-1 overflow-x-hidden">
          {/* Desktop top bar with language selector */}
          <div className="sticky top-0 z-30 hidden items-center justify-end gap-2 border-b bg-background/60 px-4 py-2 backdrop-blur md:flex md:px-8">
            <LangSelector />
          </div>
          <div className="mx-auto max-w-7xl px-3 py-4 sm:px-4 sm:py-6 md:px-8 md:py-8">
            <Outlet />
          </div>
        </main>
      </div>
      <FloatingAssistant />
    </div>
  );
}
