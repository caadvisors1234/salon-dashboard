"use client";

import { useId } from "react";
import {
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ComposedChart,
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
import type { HpbMonthlyPoint } from "@/types/dashboard";

const pvChartConfig = {
  salonPv: { label: "自店", color: "var(--color-chart-1)" },
  salonPvAreaAvg: { label: "エリア平均", color: "var(--color-chart-1)" },
} satisfies ChartConfig;

const cvrChartConfig = {
  cvr: { label: "自店", color: "var(--color-chart-2)" },
  cvrAreaAvg: { label: "エリア平均", color: "var(--color-chart-2)" },
} satisfies ChartConfig;

const acrChartConfig = {
  acr: { label: "自店", color: "var(--color-chart-3)" },
  acrAreaAvg: { label: "エリア平均", color: "var(--color-chart-3)" },
} satisfies ChartConfig;

function HpbComposedChart({
  data,
  title,
  dataKey,
  areaAvgKey,
  yAxisLabel,
  config,
}: {
  data: HpbMonthlyPoint[];
  title: string;
  dataKey: keyof HpbMonthlyPoint;
  areaAvgKey: keyof HpbMonthlyPoint;
  yAxisLabel?: string;
  config: ChartConfig;
}) {
  const uid = useId().replace(/:/g, "");
  const gradientId = `${uid}-fill-${String(dataKey)}`;

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <ChartEmptyState />
        ) : (
          <ChartContainer config={config} className="h-[250px] w-full">
            <ComposedChart accessibilityLayer data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={`var(--color-${String(dataKey)})`} stopOpacity={0.15} />
                  <stop offset="100%" stopColor={`var(--color-${String(dataKey)})`} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeOpacity={0.5} />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} label={yAxisLabel ? { value: yAxisLabel, angle: -90, position: "insideLeft", style: { fontSize: 11 } } : undefined} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Area
                type="monotone"
                dataKey={dataKey}
                stroke={`var(--color-${String(dataKey)})`}
                fill={`url(#${gradientId})`}
                strokeWidth={2}
                dot={{ r: 3, fill: "var(--color-background)" }}
                activeDot={{ r: 6, strokeWidth: 2 }}
              />
              <Line
                type="monotone"
                dataKey={areaAvgKey}
                stroke={`var(--color-${String(areaAvgKey)})`}
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={{ r: 3 }}
                opacity={0.6}
              />
            </ComposedChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}

export function HpbTrendCharts({ data }: { data: HpbMonthlyPoint[] }) {
  return (
    <div className="space-y-4">
      <HpbComposedChart
        data={data}
        title="サロン情報PV数推移"
        dataKey="salonPv"
        areaAvgKey="salonPvAreaAvg"
        yAxisLabel="PV数"
        config={pvChartConfig}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <HpbComposedChart
          data={data}
          title="CVR推移"
          dataKey="cvr"
          areaAvgKey="cvrAreaAvg"
          yAxisLabel="%"
          config={cvrChartConfig}
        />
        <HpbComposedChart
          data={data}
          title="ACR推移"
          dataKey="acr"
          areaAvgKey="acrAreaAvg"
          yAxisLabel="%"
          config={acrChartConfig}
        />
      </div>
    </div>
  );
}
