import { motion } from "framer-motion";
import { GlassCard } from "./GlassCard";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function StatCard({
  label, value, delta, icon, tone = "default", className,
}: {
  label: string; value: ReactNode; delta?: string; icon?: ReactNode;
  tone?: "default" | "success" | "warning" | "danger"; className?: string;
}) {
  const toneClass = {
    default: "text-brand",
    success: "text-success",
    warning: "text-warning",
    danger: "text-destructive",
  }[tone];
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
    >
      <GlassCard className={cn("relative overflow-hidden", className)}>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
            <p className="mt-2 text-2xl font-semibold">{value}</p>
            {delta && <p className={cn("mt-1 text-xs font-medium", toneClass)}>{delta}</p>}
          </div>
          {icon && <div className={cn("rounded-xl bg-secondary p-2", toneClass)}>{icon}</div>}
        </div>
      </GlassCard>
    </motion.div>
  );
}