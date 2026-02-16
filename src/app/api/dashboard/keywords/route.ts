import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/guards";
import { checkLocationAccess } from "@/lib/auth/access";
import { getKeywordRanking } from "@/lib/dashboard/queries";

export async function GET(request: NextRequest) {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const locationId = searchParams.get("locationId");
  const yearMonth = searchParams.get("yearMonth");
  const page = parseInt(searchParams.get("page") || "1", 10);
  const pageSize = parseInt(searchParams.get("pageSize") || "20", 10);

  if (!locationId || !yearMonth) {
    return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
  }

  // 認可チェック: ユーザーがこの店舗にアクセスできるか確認
  const hasAccess = await checkLocationAccess(user, locationId);
  if (!hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await getKeywordRanking(locationId, yearMonth, page, pageSize);
  return NextResponse.json(result);
}
