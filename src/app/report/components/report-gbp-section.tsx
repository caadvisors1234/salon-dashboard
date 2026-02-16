"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
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
import { KpiCard } from "@/components/dashboard/kpi-card";
import { TrendBadge } from "@/components/dashboard/trend-badge";
import type {
  GbpKpiData,
  MonthlyMetricPoint,
  DeviceBreakdownItem,
  KeywordRankingRow,
} from "@/types/dashboard";

// --- チャート設定 ---

const impressionChartConfig = {
  impressionsDesktopSearch: { label: "Google検索 (PC)", color: "var(--color-chart-1)" },
  impressionsMobileSearch: { label: "Google検索 (モバイル)", color: "var(--color-chart-2)" },
  impressionsDesktopMaps: { label: "Googleマップ (PC)", color: "var(--color-chart-3)" },
  impressionsMobileMaps: { label: "Googleマップ (モバイル)", color: "var(--color-chart-4)" },
} satisfies ChartConfig;

const IMPRESSION_SERIES = [
  { key: "impressionsDesktopSearch" },
  { key: "impressionsMobileSearch" },
  { key: "impressionsDesktopMaps" },
  { key: "impressionsMobileMaps" },
] as const;

const actionChartConfig = {
  callClicks: { label: "通話クリック", color: "var(--color-chart-1)" },
  directionRequests: { label: "ルート検索", color: "var(--color-chart-2)" },
  websiteClicks: { label: "Webサイトクリック", color: "var(--color-chart-3)" },
} satisfies ChartConfig;

const ACTION_SERIES = [
  { key: "callClicks" },
  { key: "directionRequests" },
  { key: "websiteClicks" },
] as const;

const deviceChartConfig = {
  desktopSearch: { label: "Google検索 (PC)", color: "var(--color-chart-1)" },
  mobileSearch: { label: "Google検索 (モバイル)", color: "var(--color-chart-2)" },
  desktopMaps: { label: "Googleマップ (PC)", color: "var(--color-chart-3)" },
  mobileMaps: { label: "Googleマップ (モバイル)", color: "var(--color-chart-4)" },
} satisfies ChartConfig;

const NAME_TO_KEY: Record<string, string> = {
  "Google検索 (PC)": "desktopSearch",
  "Google検索 (モバイル)": "mobileSearch",
  "Googleマップ (PC)": "desktopMaps",
  "Googleマップ (モバイル)": "mobileMaps",
};

// --- Props ---

type ReportGbpSectionProps = {
  kpi: GbpKpiData;
  timeSeries: MonthlyMetricPoint[];
  deviceBreakdown: DeviceBreakdownItem[];
  deviceMonthLabel: string;
  keywords: KeywordRankingRow[];
};

export function ReportGbpSection({
  kpi,
  timeSeries,
  deviceBreakdown,
  deviceMonthLabel,
  keywords,
}: ReportGbpSectionProps) {
  const deviceData = deviceBreakdown.map((item) => ({
    ...item,
    key: NAME_TO_KEY[item.name] ?? item.name,
  }));
  const deviceTotal = deviceBreakdown.reduce((s, d) => s + d.value, 0);

  return (
    <div className="report-page space-y-5 p-6">
      <h2 className="text-lg font-bold border-b pb-2">GBP パフォーマンス</h2>

      {/* KPI カード */}
      <div className="grid grid-cols-4 gap-3">
        <KpiCard kpi={kpi.rating} />
        <KpiCard kpi={kpi.reviewCount} />
        <KpiCard kpi={kpi.totalImpressions} />
        <KpiCard kpi={kpi.totalActions} />
      </div>

      {/* 閲覧数 + アクション推移グラフ */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">閲覧数推移</CardTitle>
          </CardHeader>
          <CardContent>
            {timeSeries.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">データなし</p>
            ) : (
              <ChartContainer config={impressionChartConfig} className="h-[200px] w-full">
                <LineChart data={timeSeries} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <ChartLegend content={<ChartLegendContent />} />
                  {IMPRESSION_SERIES.map((s) => (
                    <Line
                      key={s.key}
                      type="monotone"
                      dataKey={s.key}
                      stroke={`var(--color-${s.key})`}
                      strokeWidth={2}
                      dot={{ r: 2 }}
                    />
                  ))}
                </LineChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">アクション指標推移</CardTitle>
          </CardHeader>
          <CardContent>
            {timeSeries.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">データなし</p>
            ) : (
              <ChartContainer config={actionChartConfig} className="h-[200px] w-full">
                <LineChart data={timeSeries} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <ChartLegend content={<ChartLegendContent />} />
                  {ACTION_SERIES.map((s) => (
                    <Line
                      key={s.key}
                      type="monotone"
                      dataKey={s.key}
                      stroke={`var(--color-${s.key})`}
                      strokeWidth={2}
                      dot={{ r: 2 }}
                    />
                  ))}
                </LineChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* デバイス内訳 + キーワード */}
      <div className="grid grid-cols-[280px_1fr] gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">デバイス内訳（{deviceMonthLabel}）</CardTitle>
          </CardHeader>
          <CardContent>
            {deviceTotal === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">データなし</p>
            ) : (
              <ChartContainer config={deviceChartConfig} className="h-[200px] w-full">
                <PieChart>
                  <Pie
                    data={deviceData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    paddingAngle={2}
                    dataKey="value"
                    nameKey="key"
                    label={(props) => {
                      const percent = (props as { percent?: number }).percent ?? 0;
                      return `${(percent * 100).toFixed(1)}%`;
                    }}
                  >
                    {deviceData.map((item, index) => (
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

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">検索キーワードランキング（上位20件）</CardTitle>
          </CardHeader>
          <CardContent>
            {keywords.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">データなし</p>
            ) : (
              <div className="overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="py-1 pr-2 w-8">#</th>
                      <th className="py-1 pr-2">キーワード</th>
                      <th className="py-1 pr-2 text-right w-16">指標値</th>
                      <th className="py-1 text-right w-20">前月比</th>
                    </tr>
                  </thead>
                  <tbody>
                    {keywords.map((kw) => (
                      <tr key={kw.rank} className="border-b border-gray-100">
                        <td className="py-0.5 pr-2 text-muted-foreground">{kw.rank}</td>
                        <td className="py-0.5 pr-2 truncate max-w-[200px]">{kw.keyword}</td>
                        <td className="py-0.5 pr-2 text-right">
                          {kw.valueType === "THRESHOLD" ? (
                            <span className="text-muted-foreground">&lt;{kw.insightsValue}</span>
                          ) : (
                            kw.insightsValue.toLocaleString("ja-JP")
                          )}
                        </td>
                        <td className="py-0.5 text-right">
                          <TrendBadge trend={kw.trend} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
