import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth/guards";
import {
  getGbpKpiData,
  getMetricsTimeSeries,
  getDeviceBreakdown,
  getLocationInfo,
} from "@/lib/dashboard/queries";
import { Breadcrumb } from "@/components/dashboard/breadcrumb";
import { LocationDashboard } from "@/components/dashboard/location-dashboard";
import { KeywordSection } from "@/components/dashboard/keyword-section";
import { HpbSection } from "@/components/dashboard/hpb-section";
import { ReportDialog } from "@/components/dashboard/report-dialog";

export default async function LocationDetailPage({
  params,
}: {
  params: Promise<{ orgId: string; locationId: string }>;
}) {
  const user = await requireAuth();
  const { orgId, locationId } = await params;

  // Client ロールは自社のみ
  if (user.role === "client" && user.orgId !== orgId) {
    notFound();
  }

  const locationInfo = await getLocationInfo(locationId);
  if (!locationInfo || locationInfo.orgId !== orgId) {
    notFound();
  }

  // 初期データを並行取得（過去6ヶ月）
  const now = new Date();
  const endMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const startDate = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const startMonth = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, "0")}`;

  const [gbpKpi, timeSeries, deviceBreakdown] = await Promise.all([
    getGbpKpiData(locationId),
    getMetricsTimeSeries(locationId, startMonth, endMonth),
    getDeviceBreakdown(locationId, endMonth),
  ]);

  const [ey, em] = endMonth.split("-").map(Number);
  const deviceMonthLabel = `${ey}年${em}月`;

  // キーワードデータは前月分が最新（GBP APIのデータ提供タイミング）
  const prevMonthDate = new Date(Date.UTC(now.getFullYear(), now.getMonth() - 1, 1));
  const keywordYearMonth = `${prevMonthDate.getUTCFullYear()}${String(prevMonthDate.getUTCMonth() + 1).padStart(2, "0")}`;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Breadcrumb
            items={[
              { label: "ダッシュボード", href: "/dashboard" },
              { label: locationInfo.orgName, href: `/dashboard/clients/${orgId}` },
              { label: locationInfo.locationName },
            ]}
          />
          <ReportDialog type="store" locationId={locationId} />
        </div>
        <h1 className="text-2xl font-bold">{locationInfo.locationName}</h1>
      </div>

      <LocationDashboard
        gbpKpi={gbpKpi}
        initialTimeSeries={timeSeries}
        initialDeviceBreakdown={deviceBreakdown}
        initialDeviceMonthLabel={deviceMonthLabel}
        locationId={locationId}
      >
        {/* キーワードセクション */}
        <KeywordSection locationId={locationId} yearMonth={keywordYearMonth} />

        {/* HPBセクション */}
        <HpbSection locationId={locationId} />
      </LocationDashboard>
    </div>
  );
}
