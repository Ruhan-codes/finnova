// Multi-device realtime: subscribe to Postgres changes on the current
// user's transactions, alerts, and notifications, and invalidate the
// corresponding React Query caches so every open device stays in sync.
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/lib/finance/auth";

export function useRealtimeSync() {
  const { user } = useCurrentUser();
  const qc = useQueryClient();

  useEffect(() => {
    if (!user?.id) return;
    const userFilter = `user_id=eq.${user.id}`;
    const channel = supabase
      .channel(`fg-user-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "transactions", filter: userFilter },
        () => {
          qc.invalidateQueries({ queryKey: ["transactions"] });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "alerts", filter: userFilter },
        () => {
          qc.invalidateQueries({ queryKey: ["alerts"] });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: userFilter },
        () => {
          qc.invalidateQueries({ queryKey: ["notifications"] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, qc]);
}
