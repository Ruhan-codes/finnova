import { createFileRoute, Navigate, Outlet } from "@tanstack/react-router";
import { AppShell } from "@/components/finance/AppShell";
import { AnomalyModal } from "@/components/finance/AnomalyModal";
import { useCurrentUser } from "@/lib/finance/auth";
import { useRealtimeSync } from "@/lib/finance/realtime";
import { I18nProvider } from "@/lib/i18n";

export const Route = createFileRoute("/app")({
  ssr: false,
  component: AppLayout,
});

function AppLayout() {
  const { user, loading } = useCurrentUser();
  useRealtimeSync();
  if (loading) return null;
  if (!user) return <Navigate to="/login" />;
  return (
    <I18nProvider>
      <AppShell />
      <AnomalyModal />
    </I18nProvider>
  );
}

export function _NestedOutlet() {
  return <Outlet />;
}
