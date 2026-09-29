// Client-side query wrappers around the alerts server fns.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listAlerts,
  createAlerts,
  resolveAlert,
  retryAlertEmail,
  type PersistedAlert,
} from "./alerts.functions";

const KEY = ["alerts"] as const;

export type AlertInsertInput = {
  transactionId: string | null;
  fingerprint?: string | null;
  merchant: string;
  actual: number;
  expected: number;
  deviation: number;
  confidence: number;
  severity: "Low" | "Medium" | "High";
  reason: string;
  aiExplanation: string;
  notificationHtml: string;
};

export function useAlerts() {
  const fetch = useServerFn(listAlerts);
  return useQuery<PersistedAlert[]>({
    queryKey: KEY,
    queryFn: () => fetch(),
    staleTime: 5_000,
    refetchOnWindowFocus: true,
  });
}

export function useCreateAlerts() {
  const qc = useQueryClient();
  const save = useServerFn(createAlerts);
  return useMutation({
    mutationFn: (alerts: AlertInsertInput[]) => save({ data: { alerts } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ["transactions"] });
    },
  });
}

export function useResolveAlert() {
  const qc = useQueryClient();
  const save = useServerFn(resolveAlert);
  return useMutation({
    mutationFn: (input: { alertId: string; transactionId: string | null; decision: "confirmed" | "disputed" }) =>
      save({ data: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ["transactions"] });
    },
  });
}

export function useRetryAlertEmail() {
  const qc = useQueryClient();
  const run = useServerFn(retryAlertEmail);
  return useMutation({
    mutationFn: (alertId: string) => run({ data: { alertId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
