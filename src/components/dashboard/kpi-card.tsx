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
}: {
  kpi: KpiValue;
  className?: string;
  areaAvgLabel?: string;
}) {
  return (
    <Card className={cn("gap-2 py-4", className)}>
      <CardContent className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground">{kpi.label}</p>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold tracking-tight">
            {formatValue(kpi.value, kpi.format)}
          </span>
          {areaAvgLabel && (
            <span className="text-xs text-muted-foreground">
              {areaAvgLabel}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
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
