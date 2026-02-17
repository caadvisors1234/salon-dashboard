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
import { KpiCard } from "@/components/dashboard/kpi-card";
import type { HpbKpiData, HpbMonthlyPoint } from "@/types/dashboard";

// --- チャート設定 ---

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

function formatAreaAvg(value: number, format: "integer" | "percent1"): string {
  if (format === "percent1") {
    return `エリア平均: ${value.toFixed(1)}%`;
  }
  return `エリア平均: ${value.toLocaleString("ja-JP")}`;
}

// --- 内部チャートコンポーネント ---

function HpbLineChart({
  data,
  title,
  dataKey,
  areaAvgKey,
  yAxisLabel,
  config,
  height = 180,
}: {
  data: HpbMonthlyPoint[];
  title: string;
  dataKey: keyof HpbMonthlyPoint;
  areaAvgKey: keyof HpbMonthlyPoint;
  yAxisLabel?: string;
  config: ChartConfig;
  height?: number;
}) {
  return (
    <Card className="border-none shadow-none">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground">データなし</p>
        ) : (
          <ChartContainer config={config} className="w-full" style={{ height }}>
            <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={0} />
              <YAxis
                tick={{ fontSize: 10 }}
                label={
                  yAxisLabel
                    ? { value: yAxisLabel, angle: -90, position: "insideLeft", style: { fontSize: 10 } }
                    : undefined
                }
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Line
                type="monotone"
                dataKey={dataKey}
                stroke={`var(--color-${String(dataKey)})`}
                strokeWidth={2}
                dot={{ r: 2 }}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey={areaAvgKey}
                stroke={`var(--color-${String(areaAvgKey)})`}
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={{ r: 2 }}
                opacity={0.6}
                isAnimationActive={false}
              />
            </LineChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}

// --- Props ---

type ReportHpbSectionProps = {
  kpi: HpbKpiData;
  timeSeries: HpbMonthlyPoint[];
  latestMonthLabel?: string;
};

export function ReportHpbSection({ kpi, timeSeries, latestMonthLabel }: ReportHpbSectionProps) {
  return (
    <div className="space-y-5">
      <h2 className="text-lg font-bold border-b pb-2">
        HPB パフォーマンス{latestMonthLabel && `（最新: ${latestMonthLabel}）`}
      </h2>

      {/* KPI カード */}
      <div className="grid grid-cols-3 gap-3">
        <KpiCard
          kpi={kpi.salonPv}
          areaAvgLabel={formatAreaAvg(kpi.salonPv.areaAvg, "integer")}
          className="border-none shadow-none"
        />
        <KpiCard
          kpi={kpi.cvr}
          areaAvgLabel={formatAreaAvg(kpi.cvr.areaAvg, "percent1")}
          className="border-none shadow-none"
        />
        <KpiCard
          kpi={kpi.acr}
          areaAvgLabel={formatAreaAvg(kpi.acr.areaAvg, "percent1")}
          className="border-none shadow-none"
        />
      </div>

      {/* 推移グラフ */}
      <HpbLineChart
        data={timeSeries}
        title="サロン情報PV数推移"
        dataKey="salonPv"
        areaAvgKey="salonPvAreaAvg"
        yAxisLabel="PV数"
        config={pvChartConfig}
      />

      <div className="grid grid-cols-2 gap-4">
        <HpbLineChart
          data={timeSeries}
          title="CVR推移"
          dataKey="cvr"
          areaAvgKey="cvrAreaAvg"
          yAxisLabel="%"
          config={cvrChartConfig}
        />
        <HpbLineChart
          data={timeSeries}
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
