import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/guards";
import { checkLocationAccess } from "@/lib/auth/access";
import { getMetricsTimeSeries, getDeviceBreakdown } from "@/lib/dashboard/queries";

export async function GET(request: NextRequest) {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const locationId = searchParams.get("locationId");
  const startMonth = searchParams.get("startMonth");
  const endMonth = searchParams.get("endMonth");

  if (!locationId || !startMonth || !endMonth) {
    return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
  }

  // 認可チェック: ユーザーがこの店舗にアクセスできるか確認
  const hasAccess = await checkLocationAccess(user, locationId);
  if (!hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [timeSeries, deviceBreakdown] = await Promise.all([
    getMetricsTimeSeries(locationId, startMonth, endMonth),
    getDeviceBreakdown(locationId, endMonth),
  ]);

  const [y, m] = endMonth.split("-").map(Number);
  const deviceMonthLabel = `${y}年${m}月`;

  return NextResponse.json({ timeSeries, deviceBreakdown, deviceMonthLabel });
}
