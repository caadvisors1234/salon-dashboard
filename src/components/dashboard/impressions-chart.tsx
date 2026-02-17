"use client";

import { useId } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart";
import { ChartEmptyState } from "./chart-empty-state";
import type { MonthlyMetricPoint } from "@/types/dashboard";

const chartConfig = {
  impressionsDesktopSearch: {
    label: "Google検索 (PC)",
    color: "var(--color-chart-1)",
  },
  impressionsMobileSearch: {
    label: "Google検索 (モバイル)",
    color: "var(--color-chart-2)",
  },
  impressionsDesktopMaps: {
    label: "Googleマップ (PC)",
    color: "var(--color-chart-3)",
  },
  impressionsMobileMaps: {
    label: "Googleマップ (モバイル)",
    color: "var(--color-chart-4)",
  },
} satisfies ChartConfig;

const SERIES = [
  { key: "impressionsDesktopSearch" },
  { key: "impressionsMobileSearch" },
  { key: "impressionsDesktopMaps" },
  { key: "impressionsMobileMaps" },
] as const;

export function ImpressionsChart({ data }: { data: MonthlyMetricPoint[] }) {
  const uid = useId().replace(/:/g, "");

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardHeader>
        <CardTitle className="text-base">閲覧数推移</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <ChartEmptyState />
        ) : (
          <ChartContainer config={chartConfig} className="h-[300px] w-full">
            <AreaChart accessibilityLayer data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <defs>
                {SERIES.map((s) => (
                  <linearGradient key={s.key} id={`${uid}-fill-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={`var(--color-${s.key})`} stopOpacity={0.15} />
                    <stop offset="100%" stopColor={`var(--color-${s.key})`} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid vertical={false} strokeOpacity={0.5} />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
              {SERIES.map((s) => (
                <Area
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  stroke={`var(--color-${s.key})`}
                  fill={`url(#${uid}-fill-${s.key})`}
                  strokeWidth={2}
                  dot={{ r: 3, fill: "var(--color-background)" }}
                  activeDot={{ r: 6, strokeWidth: 2 }}
                />
              ))}
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
