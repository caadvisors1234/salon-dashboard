import { Search, Sparkles } from "lucide-react";
import { LocationDashboard } from "@/components/dashboard/location-dashboard";
import { KeywordRankingTable } from "@/components/dashboard/keyword-ranking-table";
import { HpbKpiCards } from "@/components/dashboard/hpb-kpi-cards";
import { HpbTrendCharts } from "@/components/dashboard/hpb-trend-charts";
import { SectionHeader } from "@/components/dashboard/section-header";
import { Badge } from "@/components/ui/badge";
import {
  DEMO_LOCATION_NAME,
  DEMO_ORG_NAME,
  DEMO_GBP_KPI,
  DEMO_TIME_SERIES,
  DEMO_DEVICE_BREAKDOWN,
  DEMO_DEVICE_MONTH_LABEL,
  DEMO_KEYWORD_RANKING,
  DEMO_HPB_DATA,
} from "@/lib/demo/data";
import { formatYearMonthLabel } from "@/lib/dashboard/utils";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "デモダッシュボード | GBP Dashboard",
  description: "GBP Dashboardのデモ画面です。架空のサロンデータで機能をお試しいただけます。",
};

// 初期表示は過去6ヶ月分
const initialTimeSeries = DEMO_TIME_SERIES.slice(-6);

export default function DemoPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <nav className="flex items-center text-sm text-muted-foreground">
            <span>{DEMO_ORG_NAME}</span>
            <span className="mx-2">/</span>
            <span className="text-foreground">{DEMO_LOCATION_NAME}</span>
          </nav>
          <Badge variant="outline" className="text-xs">
            デモデータ
          </Badge>
        </div>
        <h1 className="text-2xl font-bold tracking-tight">{DEMO_LOCATION_NAME}</h1>
      </div>

      <LocationDashboard
        gbpKpi={DEMO_GBP_KPI}
        initialTimeSeries={initialTimeSeries}
        initialDeviceBreakdown={DEMO_DEVICE_BREAKDOWN}
        initialDeviceMonthLabel={DEMO_DEVICE_MONTH_LABEL}
        locationId="demo"
        demoTimeSeries={DEMO_TIME_SERIES}
      >
        {/* キーワードセクション */}
        <section className="space-y-4">
          <SectionHeader
            title="検索キーワードランキング"
            description={`${formatYearMonthLabel(DEMO_KEYWORD_RANKING.yearMonth)}のデータ`}
            icon={<Search className="h-5 w-5" />}
          />
          <KeywordRankingTable result={DEMO_KEYWORD_RANKING} />
        </section>

        {/* HPBセクション */}
        <section className="space-y-4">
          <SectionHeader
            title="HPB パフォーマンス"
            description={`Hot Pepper Beauty の主要指標（最新: ${DEMO_HPB_DATA.latestMonthLabel}）`}
            icon={<Sparkles className="h-5 w-5" />}
          />
          <div className="space-y-4">
            {DEMO_HPB_DATA.kpi && <HpbKpiCards data={DEMO_HPB_DATA.kpi} />}
            <HpbTrendCharts data={DEMO_HPB_DATA.timeSeries} />
          </div>
        </section>
      </LocationDashboard>
    </div>
  );
}
