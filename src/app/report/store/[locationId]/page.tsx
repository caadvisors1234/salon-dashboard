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
import { ReportContent } from "./report-content";

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

  // データ取得（並列）
  const [locationInfo, kpiData, timeSeries, deviceBreakdown, keywords, hpbData] =
    await Promise.all([
      getReportLocationInfo(locationId),
      getReportGbpKpiData(locationId, to),
      getReportMetricsTimeSeries(locationId, from, to),
      getReportDeviceBreakdown(locationId, to),
      getReportKeywordRanking(locationId, to),
      getReportHpbData(locationId),
    ]);

  if (!locationInfo) {
    notFound();
  }

  const periodLabel = `${formatYearMonthLabel(from)} 〜 ${formatYearMonthLabel(to)}`;
  const deviceMonthLabel = formatYearMonthLabel(to);

  return (
    <div className="bg-white">
      <div className="report-page p-6">
        <ReportHeader
          orgName={locationInfo.orgName}
          locationName={locationInfo.locationName}
          periodLabel={periodLabel}
        />
      </div>
      <ReportContent
        kpi={kpiData}
        timeSeries={timeSeries}
        deviceBreakdown={deviceBreakdown}
        deviceMonthLabel={deviceMonthLabel}
        keywords={keywords}
        hpbData={hpbData}
      />
      <div className="report-page p-6">
        <ReportFooter />
      </div>
    </div>
  );
}
