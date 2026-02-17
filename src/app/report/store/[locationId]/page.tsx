import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { verifyReportToken } from "@/lib/pdf/token";
import { formatYearMonthLabel } from "@/lib/dashboard/utils";
import {
  getReportLocationInfo,
  getReportGbpKpiData,
  getReportMetricsTimeSeries,
  getReportDeviceBreakdown,
  getReportKeywordRanking,
  getReportHpbData,
} from "@/lib/pdf/report-queries";
import { ReportHeader } from "../../components/report-header";
import { ReportFooter } from "../../components/report-footer";
import { ReportGbpCharts, ReportGbpDetails } from "../../components/report-gbp-section";
import { ReportHpbSection } from "../../components/report-hpb-section";
import { ReportReadySignal } from "../../components/report-ready-signal";

type Props = {
  params: Promise<{ locationId: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
};

export default async function StoreReportPage({ params, searchParams }: Props) {
  const { locationId } = await params;
  const { from, to } = await searchParams;

  // トークン検証（cookieから取得）
  const cookieStore = await cookies();
  const token = cookieStore.get("report_token")?.value;

  if (!token) {
    return (
      <div className="p-8 text-center text-red-600">
        認証トークンが必要です（403）
      </div>
    );
  }

  try {
    await verifyReportToken(token);
  } catch {
    return (
      <div className="p-8 text-center text-red-600">
        無効または期限切れのトークンです（403）
      </div>
    );
  }

  // パラメータ検証
  if (!from || !to) {
    return (
      <div className="p-8 text-center text-red-600">
        期間パラメータ（from, to）が必要です
      </div>
    );
  }

  // キーワードデータは前月分が最新（GBP APIのデータ提供タイミング）
  const [toYear, toMonth] = to.split("-").map(Number);
  const kwPrevDate = new Date(Date.UTC(toYear, toMonth - 2, 1));
  const keywordYearMonth = `${kwPrevDate.getUTCFullYear()}-${String(kwPrevDate.getUTCMonth() + 1).padStart(2, "0")}`;

  // データ取得（並列）
  const [locationInfo, kpiData, timeSeries, deviceBreakdown, keywords, hpbData] =
    await Promise.all([
      getReportLocationInfo(locationId),
      getReportGbpKpiData(locationId, to),
      getReportMetricsTimeSeries(locationId, from, to),
      getReportDeviceBreakdown(locationId, to),
      getReportKeywordRanking(locationId, keywordYearMonth),
      getReportHpbData(locationId),
    ]);

  if (!locationInfo) {
    notFound();
  }

  const periodLabel = `${formatYearMonthLabel(from)} 〜 ${formatYearMonthLabel(to)}`;
  const deviceMonthLabel = formatYearMonthLabel(to);
  const hasHpb = hpbData.hasData && hpbData.kpi != null;

  // 期間情報ラベル
  const kpiPeriodDesc = kpiData.periodInfo?.description;
  const keywordMonthLabel = formatYearMonthLabel(keywordYearMonth);
  const hpbLatestMonthLabel = hpbData.latestMonthLabel;

  return (
    <div className="bg-white">
      {/* Page 1: ヘッダー + GBP上部（KPI + 折れ線チャート） */}
      <div data-pdf-page className="report-page p-6">
        <ReportHeader
          orgName={locationInfo.orgName}
          locationName={locationInfo.locationName}
          periodLabel={periodLabel}
        />
        <ReportGbpCharts kpi={kpiData} timeSeries={timeSeries} periodDescription={kpiPeriodDesc} />
      </div>

      {/* Page 2: GBP下部（デバイス内訳 + キーワード） */}
      <div data-pdf-page className="report-page p-6">
        <ReportGbpDetails
          deviceBreakdown={deviceBreakdown}
          deviceMonthLabel={deviceMonthLabel}
          keywords={keywords}
          keywordMonthLabel={keywordMonthLabel}
        />
        {!hasHpb && <ReportFooter />}
      </div>

      {/* Page 3: HPBセクション（データありの場合のみ） */}
      {hasHpb && (
        <div data-pdf-page className="report-page p-6">
          <ReportHpbSection kpi={hpbData.kpi!} timeSeries={hpbData.timeSeries} latestMonthLabel={hpbLatestMonthLabel} />
          <ReportFooter />
        </div>
      )}

      <ReportReadySignal />
    </div>
  );
}
