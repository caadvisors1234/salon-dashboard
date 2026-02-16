"use client";

import {
  PieChart,
  Pie,
  Cell,
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
import type { DeviceBreakdownItem } from "@/types/dashboard";

const chartConfig = {
  desktopSearch: {
    label: "Google検索 (PC)",
    color: "var(--color-chart-1)",
  },
  mobileSearch: {
    label: "Google検索 (モバイル)",
    color: "var(--color-chart-2)",
  },
  desktopMaps: {
    label: "Googleマップ (PC)",
    color: "var(--color-chart-3)",
  },
  mobileMaps: {
    label: "Googleマップ (モバイル)",
    color: "var(--color-chart-4)",
  },
} satisfies ChartConfig;

const NAME_TO_KEY: Record<string, string> = {
  "Google検索 (PC)": "desktopSearch",
  "Google検索 (モバイル)": "mobileSearch",
  "Googleマップ (PC)": "desktopMaps",
  "Googleマップ (モバイル)": "mobileMaps",
};

export function DeviceBreakdownChart({ data, monthLabel }: { data: DeviceBreakdownItem[]; monthLabel: string }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const chartData = data.map((item) => ({
    ...item,
    key: NAME_TO_KEY[item.name] ?? item.name,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">デバイス内訳（{monthLabel}）</CardTitle>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">データがありません</p>
        ) : (
          <ChartContainer config={chartConfig} className="h-[280px] w-full">
            <PieChart accessibilityLayer>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                dataKey="value"
                nameKey="key"
                label={(props) => {
                  const percent = (props as { percent?: number }).percent ?? 0;
                  return `${(percent * 100).toFixed(1)}%`;
                }}
              >
                {chartData.map((item, index) => (
                  <Cell key={index} fill={`var(--color-${item.key})`} />
                ))}
              </Pie>
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    nameKey="key"
                    formatter={(value) =>
                      typeof value === "number" ? value.toLocaleString("ja-JP") : value
                    }
                  />
                }
              />
              <ChartLegend content={<ChartLegendContent nameKey="key" />} />
            </PieChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
