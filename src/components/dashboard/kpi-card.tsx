"use client";

import { Card, CardContent } from "@/components/ui/card";
import { TrendBadge } from "./trend-badge";
import { cn } from "@/lib/utils";
import type { KpiValue } from "@/types/dashboard";

function formatValue(value: number | string, format: KpiValue["format"]): string {
  if (typeof value === "string") return value;
  switch (format) {
    case "integer":
      return value.toLocaleString("ja-JP");
    case "decimal1":
      return value.toLocaleString("ja-JP", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    case "percent1":
      return `${value.toLocaleString("ja-JP", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
    case "rating":
      return `★ ${value.toLocaleString("ja-JP", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`;
    default:
      return String(value);
  }
}

export function KpiCard({
  kpi,
  className,
  /** エリア平均の補足表示（HPBカード用） */
  areaAvgLabel,
  icon,
  accentColor,
}: {
  kpi: KpiValue;
  className?: string;
  areaAvgLabel?: string;
  icon?: React.ReactNode;
  /** アイコンの色。hex, rgb(), oklch() 等どの形式でも可 */
  accentColor?: string;
}) {
  return (
    <Card className={cn("gap-2 py-4 transition-shadow hover:shadow-md", className)}>
      <CardContent className="space-y-1">
        <div className="flex items-start justify-between">
          <p className="text-xs font-medium text-muted-foreground">{kpi.label}</p>
          {icon && (
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
              style={{
                backgroundColor: accentColor
                  ? `color-mix(in srgb, ${accentColor} 12%, transparent)`
                  : undefined,
                color: accentColor,
              }}
            >
              {icon}
            </div>
          )}
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold tabular-nums tracking-tight">
            {formatValue(kpi.value, kpi.format)}
          </span>
          {areaAvgLabel && (
            <span className="text-xs text-muted-foreground">
              {areaAvgLabel}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {(kpi.trend.direction === "up" || kpi.trend.direction === "down" || kpi.trend.direction === "flat") && (
            <span className="text-xs text-muted-foreground">前月比</span>
          )}
          <TrendBadge trend={kpi.trend} />
          {kpi.periodLabel && (
            <span className="text-xs text-muted-foreground">
              {kpi.periodLabel}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
