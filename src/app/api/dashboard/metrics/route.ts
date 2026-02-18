import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/guards";
import { checkLocationAccess } from "@/lib/auth/access";
import { getMetricsTimeSeries, getDeviceBreakdown } from "@/lib/dashboard/queries";
import { getCurrentMonth } from "@/lib/utils";
import { apiSuccess, apiError } from "@/lib/api/response";
import { createLogger } from "@/lib/logger";

const log = createLogger("DashboardMetrics");

export async function GET(request: NextRequest) {
  const user = await getSession();
  if (!user) {
    return apiError("Unauthorized", 401);
  }

  const { searchParams } = request.nextUrl;
  const locationId = searchParams.get("locationId");
  const startMonth = searchParams.get("startMonth");
  const endMonth = searchParams.get("endMonth");

  if (!locationId || !startMonth || !endMonth) {
    return apiError("Missing parameters", 400);
  }

  // 認可チェック: ユーザーがこの店舗にアクセスできるか確認
  const hasAccess = await checkLocationAccess(user, locationId);
  if (!hasAccess) {
    return apiError("Forbidden", 403);
  }

  try {
    const [timeSeries, deviceBreakdown] = await Promise.all([
      getMetricsTimeSeries(locationId, startMonth, endMonth),
      getDeviceBreakdown(locationId, endMonth),
    ]);

    const [y, m] = endMonth.split("-").map(Number);
    const deviceMonthLabel = `${y}年${m}月`;

    // サーバーTZ基準で当月判定。TZ差で数時間のずれが生じうるが、
    // private キャッシュなのでブラウザリロードで解消される。
    const isCurrentMonth = endMonth === getCurrentMonth();
    const maxAge = isCurrentMonth ? 300 : 3600;

    return apiSuccess(
      { timeSeries, deviceBreakdown, deviceMonthLabel },
      { headers: { "Cache-Control": `private, max-age=${maxAge}` } }
    );
  } catch (err) {
    log.error({ err }, "Error fetching metrics");
    return apiError("メトリクスの取得に失敗しました", 500);
  }
}
