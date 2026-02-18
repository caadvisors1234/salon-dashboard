import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth/guards";
import { apiSuccess, apiError } from "@/lib/api/response";
import { logAudit } from "@/lib/audit/logger";

type DeleteRequest = {
  locationId: string;
  yearMonths: string[];
  reason?: string;
};

const YEAR_MONTH_PATTERN = /^\d{6}$/;

export async function GET(request: NextRequest) {
  // 1. 認証チェック
  const session = await getSession();
  if (!session) {
    return apiError("認証が必要です", 401);
  }

  if (session.role !== "admin" && session.role !== "staff") {
    return apiError("この操作にはAdmin / Staff権限が必要です", 403);
  }

  // 2. パラメータ取得
  const locationId = request.nextUrl.searchParams.get("locationId");
  if (!locationId) {
    return apiError("対象店舗が指定されていません", 400);
  }

  // 3. 店舗の存在確認（RLS経由）
  const supabase = await createClient();

  const { data: location, error: locError } = await supabase
    .from("locations")
    .select("id")
    .eq("id", locationId)
    .single();

  if (locError || !location) {
    return apiError("指定された店舗が見つからないか、アクセス権がありません", 404);
  }

  // 4. 月リスト取得
  const { data: metrics, error: metricsError } = await supabase
    .from("hpb_monthly_metrics")
    .select("year_month")
    .eq("location_id", locationId)
    .order("year_month", { ascending: false });

  if (metricsError) {
    return apiError("データの取得に失敗しました", 500);
  }

  const yearMonths = (metrics ?? []).map((m) => m.year_month);

  return apiSuccess({ yearMonths });
}

export async function DELETE(request: NextRequest) {
  // 1. 認証チェック
  const session = await getSession();
  if (!session) {
    return apiError("認証が必要です", 401);
  }

  if (session.role !== "admin" && session.role !== "staff") {
    return apiError("この操作にはAdmin / Staff権限が必要です", 403);
  }

  // 2. リクエストボディの取得
  let body: DeleteRequest;
  try {
    body = await request.json();
  } catch {
    return apiError("リクエストの解析に失敗しました", 400);
  }

  const { locationId, yearMonths, reason } = body;

  // 3. バリデーション
  if (!locationId || typeof locationId !== "string") {
    return apiError("対象店舗が指定されていません", 400);
  }

  if (!Array.isArray(yearMonths) || yearMonths.length === 0) {
    return apiError("削除対象の年月が指定されていません", 400);
  }

  for (const ym of yearMonths) {
    if (!YEAR_MONTH_PATTERN.test(ym)) {
      return apiError(`年月の形式が不正です: ${ym}（YYYYMM形式で指定してください）`, 400);
    }
  }

  // 4. 店舗の存在確認（RLS経由）
  const supabase = await createClient();

  const { data: location, error: locError } = await supabase
    .from("locations")
    .select("id")
    .eq("id", locationId)
    .single();

  if (locError || !location) {
    return apiError("指定された店舗が見つからないか、アクセス権がありません", 404);
  }

  // 5. 対象レコード存在確認
  const { data: existingRecords, error: checkError } = await supabase
    .from("hpb_monthly_metrics")
    .select("year_month")
    .eq("location_id", locationId)
    .in("year_month", yearMonths);

  if (checkError) {
    return apiError("データの確認に失敗しました", 500);
  }

  if (!existingRecords || existingRecords.length === 0) {
    return apiError("指定された年月のデータが見つかりません", 404);
  }

  const existingYearMonths = existingRecords.map((r) => r.year_month);

  // 6. hpb_monthly_metrics DELETE
  const { error: deleteError } = await supabase
    .from("hpb_monthly_metrics")
    .delete()
    .eq("location_id", locationId)
    .in("year_month", existingYearMonths);

  if (deleteError) {
    console.error("[HPB Data] Delete error:", deleteError);
    return apiError("データの削除に失敗しました", 500);
  }

  // 7. 残データ確認 → 全月削除の場合のみ upload_logs を deleted に更新
  const { data: remainingMetrics } = await supabase
    .from("hpb_monthly_metrics")
    .select("id")
    .eq("location_id", locationId)
    .limit(1);

  if (!remainingMetrics || remainingMetrics.length === 0) {
    const { error: logUpdateError } = await supabase
      .from("hpb_upload_logs")
      .update({ status: "deleted" })
      .eq("location_id", locationId)
      .neq("status", "deleted");

    if (logUpdateError) {
      console.error("Failed to update upload log status:", logUpdateError);
    }
  }

  // 8. hpb_deletion_logs INSERT（監査ログ）
  const { error: auditLogError } = await supabase
    .from("hpb_deletion_logs")
    .insert({
      location_id: locationId,
      deleted_by: session.id,
      year_months: existingYearMonths,
      record_count: existingRecords.length,
      reason: reason || null,
    });

  if (auditLogError) {
    console.error("Failed to insert deletion log:", auditLogError);
  }

  logAudit({
    userId: session.id,
    action: "hpb.delete",
    resourceType: "hpb_data",
    resourceId: locationId,
    metadata: { yearMonths: existingYearMonths, deletedCount: existingRecords.length },
    ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined,
  });

  return apiSuccess({ deletedCount: existingRecords.length });
}
