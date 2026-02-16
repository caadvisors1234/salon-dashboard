"use client";

import { useEffect } from "react";
import { ReportGbpSection } from "../../components/report-gbp-section";
import { ReportHpbSection } from "../../components/report-hpb-section";
import type {
  GbpKpiData,
  MonthlyMetricPoint,
  DeviceBreakdownItem,
  KeywordRankingRow,
  HpbKpiData,
  HpbMonthlyPoint,
} from "@/types/dashboard";

declare global {
  interface Window {
    __REPORT_READY?: boolean;
  }
}

type ReportContentProps = {
  kpi: GbpKpiData;
  timeSeries: MonthlyMetricPoint[];
  deviceBreakdown: DeviceBreakdownItem[];
  deviceMonthLabel: string;
  keywords: KeywordRankingRow[];
  hpbData: {
    kpi: HpbKpiData | null;
    timeSeries: HpbMonthlyPoint[];
    hasData: boolean;
  };
};

export function ReportContent({
  kpi,
  timeSeries,
  deviceBreakdown,
  deviceMonthLabel,
  keywords,
  hpbData,
}: ReportContentProps) {
  useEffect(() => {
    const setReady = () => { window.__REPORT_READY = true; };

    // Recharts の SVG レンダリング完了を検知
    const hasCharts = () =>
      document.querySelectorAll(".recharts-surface").length > 0;

    if (hasCharts()) {
      // すでにレンダリング済み → 次のフレームで ready
      let rafId = requestAnimationFrame(() => {
        rafId = requestAnimationFrame(setReady);
      });
      return () => cancelAnimationFrame(rafId);
    }

    // MutationObserver で SVG 出現を監視
    const observer = new MutationObserver(() => {
      if (hasCharts()) {
        observer.disconnect();
        requestAnimationFrame(() => requestAnimationFrame(setReady));
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // フォールバックタイムアウト（5秒）
    const fallback = setTimeout(() => {
      observer.disconnect();
      setReady();
    }, 5000);

    return () => {
      observer.disconnect();
      clearTimeout(fallback);
    };
  }, []);

  return (
    <>
      <ReportGbpSection
        kpi={kpi}
        timeSeries={timeSeries}
        deviceBreakdown={deviceBreakdown}
        deviceMonthLabel={deviceMonthLabel}
        keywords={keywords}
      />

      {hpbData.hasData && hpbData.kpi && (
        <ReportHpbSection kpi={hpbData.kpi} timeSeries={hpbData.timeSeries} />
      )}
    </>
  );
}
