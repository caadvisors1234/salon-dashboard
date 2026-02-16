import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { createGbpClient } from "@/lib/gbp/client";
import { fetchDailyMetrics, saveDailyMetrics } from "@/lib/gbp/performance";
import { fetchMonthlyKeywords, saveMonthlyKeywords } from "@/lib/gbp/keywords";
import { fetchRatingSnapshot, saveRatingSnapshot } from "@/lib/gbp/reviews";

/**
 * POST /api/gbp/test-fetch
 * 指定ロケーションの直近1日分の全指標を即時取得する。Admin のみ。
 *
 * Body: { locationId: string } (locations テーブルの UUID)
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json(
      { error: "この操作は管理者のみ実行できます" },
      { status: 403 }
    );
  }

  let body: { locationId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "リクエストの解析に失敗しました" },
      { status: 400 }
    );
  }
  const { locationId } = body;

  if (!locationId) {
    return NextResponse.json(
      { error: "locationId は必須です" },
      { status: 400 }
    );
  }

  // locations テーブルから gbp_location_id を取得
  const supabase = createAdminClient();
  const { data: location, error: locError } = await supabase
    .from("locations")
    .select("id, gbp_location_id, name")
    .eq("id", locationId)
    .single();

  if (locError || !location) {
    return NextResponse.json(
      { error: "指定されたロケーションが見つかりません" },
      { status: 404 }
    );
  }

  if (!location.gbp_location_id) {
    return NextResponse.json(
      { error: "このロケーションに GBP Location ID が設定されていません" },
      { status: 400 }
    );
  }

  // GBP アカウント ID を取得（Reviews API 用）
  const { data: accounts } = await supabase
    .from("gbp_accounts")
    .select("gbp_account_id")
    .limit(1)
    .single();

  const gbpAccountId = accounts?.gbp_account_id || null;

  const client = createGbpClient();
  const today = new Date().toISOString().split("T")[0];
  const now = new Date();
  const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;

  const results: Record<string, Record<string, string | number | boolean | null>> = {};

  // 1. 日次パフォーマンス指標
  try {
    const metrics = await fetchDailyMetrics(
      client,
      location.gbp_location_id,
      today,
      today
    );
    const savedCount = await saveDailyMetrics(location.id, metrics);
    results.dailyMetrics = { success: true, count: savedCount };
  } catch (err) {
    results.dailyMetrics = {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  // 2. 評価・レビュー数スナップショット
  if (gbpAccountId) {
    try {
      const rating = await fetchRatingSnapshot(
        client,
        gbpAccountId,
        location.gbp_location_id
      );
      await saveRatingSnapshot(location.id, today, rating);
      results.ratingSnapshot = {
        success: true,
        averageRating: rating.averageRating,
        totalReviewCount: rating.totalReviewCount,
      };
    } catch (err) {
      results.ratingSnapshot = {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  } else {
    results.ratingSnapshot = {
      success: false,
      error: "GBP アカウント情報がありません。Google アカウントを再接続してください。",
    };
  }

  // 3. 月次検索キーワード
  try {
    const keywords = await fetchMonthlyKeywords(
      client,
      location.gbp_location_id,
      now.getFullYear(),
      now.getMonth() + 1
    );
    const savedCount = await saveMonthlyKeywords(
      location.id,
      yearMonth,
      keywords
    );
    results.monthlyKeywords = { success: true, count: savedCount };
  } catch (err) {
    results.monthlyKeywords = {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  // batch_logs に記録
  await supabase.from("batch_logs").insert({
    job_type: "test_fetch",
    status: Object.values(results).every(
      (r) => (r as { success: boolean }).success
    )
      ? "success"
      : "failure",
    metadata: {
      location_id: locationId,
      location_name: location.name,
      results,
    },
  });

  return NextResponse.json({
    locationId: location.id,
    locationName: location.name,
    gbpLocationId: location.gbp_location_id,
    fetchDate: today,
    results,
  });
}
