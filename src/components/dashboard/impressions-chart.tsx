"use client";

import {
  LineChart,
  Line,
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
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">閲覧数推移</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">データがありません</p>
        ) : (
          <ChartContainer config={chartConfig} className="h-[300px] w-full">
            <LineChart accessibilityLayer data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
              {SERIES.map((s) => (
                <Line
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  stroke={`var(--color-${s.key})`}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              ))}
            </LineChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
