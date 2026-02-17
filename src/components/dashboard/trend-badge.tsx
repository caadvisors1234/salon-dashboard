"use client";

import { TrendingUp, TrendingDown, Minus, HelpCircle, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TrendData, TrendDirection } from "@/types/dashboard";

const STYLE_MAP: Record<TrendDirection, { bg: string; text: string; Icon: React.ElementType }> = {
  up: { bg: "bg-emerald-50", text: "text-emerald-700", Icon: TrendingUp },
  down: { bg: "bg-red-50", text: "text-red-700", Icon: TrendingDown },
  flat: { bg: "bg-muted", text: "text-muted-foreground", Icon: Minus },
  unavailable: { bg: "bg-muted", text: "text-muted-foreground", Icon: HelpCircle },
  new: { bg: "bg-blue-50", text: "text-blue-700", Icon: Sparkles },
};

export function TrendBadge({
  trend,
  className,
}: {
  trend: TrendData;
  className?: string;
}) {
  const { bg, text, Icon } = STYLE_MAP[trend.direction];

  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", bg, text, className)}>
      <Icon className="h-3 w-3" />
      <span>{trend.label}</span>
    </span>
  );
}
