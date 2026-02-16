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
  callClicks: {
    label: "通話クリック",
    color: "var(--color-chart-1)",
  },
  directionRequests: {
    label: "ルート検索",
    color: "var(--color-chart-2)",
  },
  websiteClicks: {
    label: "Webサイトクリック",
    color: "var(--color-chart-3)",
  },
} satisfies ChartConfig;

const SERIES = [
  { key: "callClicks" },
  { key: "directionRequests" },
  { key: "websiteClicks" },
] as const;

export function ActionsChart({ data }: { data: MonthlyMetricPoint[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">アクション指標推移</CardTitle>
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
