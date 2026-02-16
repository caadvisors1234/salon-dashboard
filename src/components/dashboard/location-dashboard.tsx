"use client";

import { useState, useCallback } from "react";
import { PeriodSelector, getDefaultPeriodRange } from "./period-selector";
import { GbpKpiCards } from "./gbp-kpi-cards";
import { ImpressionsChart } from "./impressions-chart";
import { ActionsChart } from "./actions-chart";
import { DeviceBreakdownChart } from "./device-breakdown-chart";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type {
  GbpKpiData,
  MonthlyMetricPoint,
  DeviceBreakdownItem,
  PeriodRange,
  KeywordRankingResult,
  HpbData,
} from "@/types/dashboard";

type LocationDashboardProps = {
  gbpKpi: GbpKpiData;
  initialTimeSeries: MonthlyMetricPoint[];
  initialDeviceBreakdown: DeviceBreakdownItem[];
  initialDeviceMonthLabel: string;
  locationId: string;
  /** キーワードとHPBは別コンポーネントから描画されるため children で受け取る */
  children: React.ReactNode;
};

export function LocationDashboard({
  gbpKpi,
  initialTimeSeries,
  initialDeviceBreakdown,
  initialDeviceMonthLabel,
  locationId,
  children,
}: LocationDashboardProps) {
  const [period, setPeriod] = useState<PeriodRange>(getDefaultPeriodRange());
  const [timeSeries, setTimeSeries] = useState(initialTimeSeries);
  const [deviceBreakdown, setDeviceBreakdown] = useState(initialDeviceBreakdown);
  const [deviceMonthLabel, setDeviceMonthLabel] = useState(initialDeviceMonthLabel);
  const [loading, setLoading] = useState(false);

  const handlePeriodChange = useCallback(
    async (newPeriod: PeriodRange) => {
      setPeriod(newPeriod);
      setLoading(true);
      try {
        const params = new URLSearchParams({
          locationId,
          startMonth: newPeriod.startMonth,
          endMonth: newPeriod.endMonth,
        });
        const res = await fetch(`/api/dashboard/metrics?${params}`);
        if (res.ok) {
          const data = await res.json();
          setTimeSeries(data.timeSeries);
          setDeviceBreakdown(data.deviceBreakdown);
          setDeviceMonthLabel(data.deviceMonthLabel);
        }
      } finally {
        setLoading(false);
      }
    },
    [locationId]
  );

  return (
    <div className="space-y-6">
      {/* GBP KPI カード */}
      <section>
        <h2 className="mb-4 text-lg font-semibold">GBP パフォーマンス</h2>
        <GbpKpiCards data={gbpKpi} />
      </section>

      {/* 期間選択 + グラフ */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">推移グラフ</h2>
          <PeriodSelector value={period} onChange={handlePeriodChange} />
        </div>

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
