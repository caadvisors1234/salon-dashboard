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

function HpbLineChart({
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
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">データがありません</p>
        ) : (
          <ChartContainer config={config} className="h-[250px] w-full">
            <LineChart accessibilityLayer data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} label={yAxisLabel ? { value: yAxisLabel, angle: -90, position: "insideLeft", style: { fontSize: 11 } } : undefined} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Line
                type="monotone"
                dataKey={dataKey}
                stroke={`var(--color-${String(dataKey)})`}
                strokeWidth={2}
                dot={{ r: 3 }}
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
            </LineChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}

export function HpbTrendCharts({ data }: { data: HpbMonthlyPoint[] }) {
  return (
    <div className="space-y-4">
      <HpbLineChart
        data={data}
        title="サロン情報PV数推移"
        dataKey="salonPv"
        areaAvgKey="salonPvAreaAvg"
        yAxisLabel="PV数"
        config={pvChartConfig}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <HpbLineChart
          data={data}
          title="CVR推移"
          dataKey="cvr"
          areaAvgKey="cvrAreaAvg"
          yAxisLabel="%"
          config={cvrChartConfig}
        />
        <HpbLineChart
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
