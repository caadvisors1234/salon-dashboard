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

// デバイスキー → グローバルCSS変数（ChartContainer外の凡例リスト用）
const DEVICE_COLORS: Record<string, string> = {
  desktopSearch: "var(--color-chart-1)",
  mobileSearch: "var(--color-chart-2)",
  desktopMaps: "var(--color-chart-3)",
  mobileMaps: "var(--color-chart-4)",
};

const NAME_TO_KEY: Record<string, string> = {
  "Google検索 (PC)": "desktopSearch",
  "Google検索 (モバイル)": "mobileSearch",
  "Googleマップ (PC)": "desktopMaps",
  "Googleマップ (モバイル)": "mobileMaps",
};

// --- ReportGbpCharts ---

type ReportGbpChartsProps = {
  kpi: GbpKpiData;
  timeSeries: MonthlyMetricPoint[];
};

export function ReportGbpCharts({ kpi, timeSeries }: ReportGbpChartsProps) {
  return (
    <div className="space-y-5 mt-4">
      <h2 className="text-lg font-bold border-b pb-2">GBP パフォーマンス</h2>

      {/* KPI カード */}
      <div className="grid grid-cols-4 gap-3">
        <KpiCard kpi={kpi.rating} className="border-none shadow-none" />
        <KpiCard kpi={kpi.reviewCount} className="border-none shadow-none" />
        <KpiCard kpi={kpi.totalImpressions} className="border-none shadow-none" />
        <KpiCard kpi={kpi.totalActions} className="border-none shadow-none" />
      </div>

      {/* 閲覧数 + アクション推移グラフ */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="border-none shadow-none">
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
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={0} />
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
                      isAnimationActive={false}
                    />
                  ))}
                </LineChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card className="border-none shadow-none">
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
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={0} />
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
                      isAnimationActive={false}
                    />
                  ))}
                </LineChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// --- ReportGbpDetails ---

type ReportGbpDetailsProps = {
  deviceBreakdown: DeviceBreakdownItem[];
  deviceMonthLabel: string;
  keywords: KeywordRankingRow[];
};

export function ReportGbpDetails({
  deviceBreakdown,
  deviceMonthLabel,
  keywords,
}: ReportGbpDetailsProps) {
  const deviceData = deviceBreakdown.map((item) => ({
    ...item,
    key: NAME_TO_KEY[item.name] ?? item.name,
  }));
  const deviceTotal = deviceBreakdown.reduce((s, d) => s + d.value, 0);

  return (
    <div className="space-y-5">
      <h2 className="text-lg font-bold border-b pb-2">GBP パフォーマンス（続き）</h2>

      {/* デバイス内訳 + キーワード */}
      <div className="grid grid-cols-[280px_1fr] gap-4">
        <Card className="border-none shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">デバイス内訳（{deviceMonthLabel}）</CardTitle>
          </CardHeader>
          <CardContent>
            {deviceTotal === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">データなし</p>
            ) : (
              <div>
                <ChartContainer config={deviceChartConfig} className="aspect-auto h-[140px] w-full">
                  <PieChart>
                    <Pie
                      data={deviceData}
                      cx="50%"
                      cy="50%"
                      innerRadius={25}
                      outerRadius={55}
                      paddingAngle={2}
                      dataKey="value"
                      nameKey="key"
                      isAnimationActive={false}
                    >
                      {deviceData.map((item, index) => (
                        <Cell key={index} fill={`var(--color-${item.key})`} />
                      ))}
                    </Pie>
                  </PieChart>
                </ChartContainer>
                {/* 凡例リスト（ChartContainer外なのでグローバルCSS変数を直接使用） */}
                <ul className="mt-1 space-y-0.5 text-xs">
                  {deviceData.map((item) => {
                    const pct = deviceTotal > 0 ? ((item.value / deviceTotal) * 100).toFixed(1) : "0.0";
                    return (
                      <li key={item.key} className="flex items-center gap-1.5">
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-sm shrink-0"
                          style={{ backgroundColor: DEVICE_COLORS[item.key] }}
                        />
                        <span className="truncate">
                          {deviceChartConfig[item.key as keyof typeof deviceChartConfig]?.label ?? item.name}
                        </span>
                        <span className="ml-auto font-medium">{pct}%</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-none shadow-none">
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
