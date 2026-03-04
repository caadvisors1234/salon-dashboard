"use client";

import { useState, useCallback, useMemo } from "react";
import { BarChart3, TrendingUp } from "lucide-react";
import { PeriodSelector, getDefaultPeriodRange } from "./period-selector";
import { SectionHeader } from "./section-header";
import { GbpKpiCards } from "./gbp-kpi-cards";
import { ImpressionsChart } from "./impressions-chart";
import { ActionsChart } from "./actions-chart";
import { DeviceBreakdownChart } from "./device-breakdown-chart";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPeriodRangeLabel, formatYearMonthLabel } from "@/lib/dashboard/utils";
import type {
  GbpKpiData,
  MonthlyMetricPoint,
  DeviceBreakdownItem,
  PeriodRange,
} from "@/types/dashboard";

type LocationDashboardProps = {
  gbpKpi: GbpKpiData;
  initialTimeSeries: MonthlyMetricPoint[];
  initialDeviceBreakdown: DeviceBreakdownItem[];
  initialDeviceMonthLabel: string;
  locationId: string;
  /** 全期間の時系列データ（デモモード用）。指定時はAPI fetchをスキップしクライアント側でフィルタリング */
  demoTimeSeries?: MonthlyMetricPoint[];
  /** キーワードとHPBは別コンポーネントから描画されるため children で受け取る */
  children: React.ReactNode;
};

function filterTimeSeriesByPeriod(
  allData: MonthlyMetricPoint[],
  period: PeriodRange
): { timeSeries: MonthlyMetricPoint[]; deviceBreakdown: DeviceBreakdownItem[]; deviceMonthLabel: string } {
  const filtered = allData.filter(
    (d) => d.yearMonth >= period.startMonth && d.yearMonth <= period.endMonth
  );
  const last = filtered[filtered.length - 1];
  const deviceBreakdown: DeviceBreakdownItem[] = last
    ? (() => {
        const total = last.impressionsMobileSearch + last.impressionsMobileMaps + last.impressionsDesktopSearch + last.impressionsDesktopMaps;
        return [
          { name: "モバイル検索", value: last.impressionsMobileSearch, percentage: Math.round((last.impressionsMobileSearch / total) * 1000) / 10 },
          { name: "モバイルマップ", value: last.impressionsMobileMaps, percentage: Math.round((last.impressionsMobileMaps / total) * 1000) / 10 },
          { name: "PC検索", value: last.impressionsDesktopSearch, percentage: Math.round((last.impressionsDesktopSearch / total) * 1000) / 10 },
          { name: "PCマップ", value: last.impressionsDesktopMaps, percentage: Math.round((last.impressionsDesktopMaps / total) * 1000) / 10 },
        ];
      })()
    : [];
  const deviceMonthLabel = last ? formatYearMonthLabel(last.yearMonth) : "";
  return { timeSeries: filtered, deviceBreakdown, deviceMonthLabel };
}

export function LocationDashboard({
  gbpKpi,
  initialTimeSeries,
  initialDeviceBreakdown,
  initialDeviceMonthLabel,
  locationId,
  demoTimeSeries,
  children,
}: LocationDashboardProps) {
  const isDemo = !!demoTimeSeries;
  const [period, setPeriod] = useState<PeriodRange>(getDefaultPeriodRange());
  const [timeSeries, setTimeSeries] = useState(initialTimeSeries);
  const [deviceBreakdown, setDeviceBreakdown] = useState(initialDeviceBreakdown);
  const [deviceMonthLabel, setDeviceMonthLabel] = useState(initialDeviceMonthLabel);
  const [loading, setLoading] = useState(false);

  const handlePeriodChange = useCallback(
    async (newPeriod: PeriodRange) => {
      setPeriod(newPeriod);

      if (demoTimeSeries) {
        const result = filterTimeSeriesByPeriod(demoTimeSeries, newPeriod);
        setTimeSeries(result.timeSeries);
        setDeviceBreakdown(result.deviceBreakdown);
        setDeviceMonthLabel(result.deviceMonthLabel);
        return;
      }

      setLoading(true);
      try {
        const params = new URLSearchParams({
          locationId,
          startMonth: newPeriod.startMonth,
          endMonth: newPeriod.endMonth,
        });
        const res = await fetch(`/api/dashboard/metrics?${params}`);
        if (res.ok) {
          const json = await res.json();
          setTimeSeries(json.data.timeSeries);
          setDeviceBreakdown(json.data.deviceBreakdown);
          setDeviceMonthLabel(json.data.deviceMonthLabel);
        }
      } finally {
        setLoading(false);
      }
    },
    [locationId, demoTimeSeries]
  );

  return (
    <div className="space-y-8">
      {/* GBP KPI カード */}
      <section>
        <SectionHeader
          title="GBP パフォーマンス"
          description={gbpKpi.periodInfo?.description ?? "Google ビジネス プロフィールの主要指標"}
          icon={<BarChart3 className="h-5 w-5" />}
        />
        <div className="mt-4">
          <GbpKpiCards data={gbpKpi} />
        </div>
      </section>

      {/* 期間選択 + グラフ */}
      <section className="space-y-4">
        <SectionHeader
          title="推移グラフ"
          description={formatPeriodRangeLabel(period.startMonth, period.endMonth)}
          icon={<TrendingUp className="h-5 w-5" />}
          action={<PeriodSelector value={period} onChange={handlePeriodChange} />}
        />

        {loading ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card className="lg:col-span-2">
              <CardHeader>
                <Skeleton className="h-5 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-[300px] w-full" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <Skeleton className="h-5 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-[300px] w-full" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <Skeleton className="h-5 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-[280px] w-full" />
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="lg:col-span-2">
              <ImpressionsChart data={timeSeries} />
            </div>
            <div className="lg:col-span-1">
              <ActionsChart data={timeSeries} />
            </div>
            <div className="lg:col-span-1">
              <DeviceBreakdownChart data={deviceBreakdown} monthLabel={deviceMonthLabel} />
            </div>
          </div>
        )}
      </section>

      {/* キーワードテーブル + HPBセクション（children で挿入） */}
      {children}
    </div>
  );
}
