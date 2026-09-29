import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

export function GlassCard({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "glass rounded-2xl shadow-[0_10px_40px_-20px_color-mix(in_oklab,var(--brand)_35%,transparent)] p-6",
        className,
      )}
      {...props}
    />
  );
}