"use client";

import { TrendingUp, TrendingDown, Minus, HelpCircle, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TrendData, TrendDirection } from "@/types/dashboard";

const STYLE_MAP: Record<TrendDirection, { color: string; Icon: React.ElementType }> = {
  up: { color: "text-emerald-600", Icon: TrendingUp },
  down: { color: "text-red-600", Icon: TrendingDown },
  flat: { color: "text-muted-foreground", Icon: Minus },
  unavailable: { color: "text-muted-foreground", Icon: HelpCircle },
  new: { color: "text-blue-600", Icon: Sparkles },
};

export function TrendBadge({
  trend,
  className,
}: {
  trend: TrendData;
  className?: string;
}) {
  const { color, Icon } = STYLE_MAP[trend.direction];

  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-medium", color, className)}>
      <Icon className="h-3 w-3" />
      <span>{trend.label}</span>
    </span>
  );
}
