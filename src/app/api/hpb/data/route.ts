import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth/guards";

type MonthListResponse =
  | { success: true; data: { yearMonths: string[] } }
  | { success: false; error: string };

type DeleteRequest = {
  locationId: string;
  yearMonths: string[];
  reason?: string;
};

type DeleteSuccessResponse = {
  success: true;
  data: { deletedCount: number };
};

type DeleteErrorResponse = {
  success: false;
  error: string;
};

type DeleteResponse = DeleteSuccessResponse | DeleteErrorResponse;

const YEAR_MONTH_PATTERN = /^\d{6}$/;

export async function GET(
  request: NextRequest
): Promise<NextResponse<MonthListResponse>> {
  // 1. 認証チェック
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { success: false, error: "認証が必要です" },
      { status: 401 }
    );
  }

  if (session.role !== "admin" && session.role !== "staff") {
    return NextResponse.json(
      { success: false, error: "この操作にはAdmin / Staff権限が必要です" },
      { status: 403 }
    );
  }

  // 2. パラメータ取得
  const locationId = request.nextUrl.searchParams.get("locationId");
  if (!locationId) {
    return NextResponse.json(
      { success: false, error: "対象店舗が指定されていません" },
      { status: 400 }
    );
  }

  // 3. 店舗の存在確認（RLS経由）
  const supabase = await createClient();

  const { data: location, error: locError } = await supabase
    .from("locations")
    .select("id")
    .eq("id", locationId)
    .single();

  if (locError || !location) {
    return NextResponse.json(
      {
        success: false,
        error: "指定された店舗が見つからないか、アクセス権がありません",
      },
      { status: 404 }
    );
  }

  // 4. 月リスト取得
  const { data: metrics, error: metricsError } = await supabase
    .from("hpb_monthly_metrics")
    .select("year_month")
    .eq("location_id", locationId)
    .order("year_month", { ascending: false });

  if (metricsError) {
    return NextResponse.json(
      { success: false, error: "データの取得に失敗しました" },
      { status: 500 }
    );
  }

  const yearMonths = (metrics ?? []).map((m) => m.year_month);

  return NextResponse.json({ success: true, data: { yearMonths } });
}

export async function DELETE(
  request: NextRequest
): Promise<NextResponse<DeleteResponse>> {
  // 1. 認証チェック
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { success: false, error: "認証が必要です" },
      { status: 401 }
    );
  }

  if (session.role !== "admin" && session.role !== "staff") {
    return NextResponse.json(
      { success: false, error: "この操作にはAdmin / Staff権限が必要です" },
      { status: 403 }
    );
  }

  // 2. リクエストボディの取得
  let body: DeleteRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "リクエストの解析に失敗しました" },
      { status: 400 }
    );
  }

  const { locationId, yearMonths, reason } = body;

  // 3. バリデーション
  if (!locationId || typeof locationId !== "string") {
    return NextResponse.json(
      { success: false, error: "対象店舗が指定されていません" },
      { status: 400 }
    );
  }

  if (!Array.isArray(yearMonths) || yearMonths.length === 0) {
    return NextResponse.json(
      { success: false, error: "削除対象の年月が指定されていません" },
      { status: 400 }
    );
  }

  for (const ym of yearMonths) {
    if (!YEAR_MONTH_PATTERN.test(ym)) {
      return NextResponse.json(
        {
          success: false,
          error: `年月の形式が不正です: ${ym}（YYYYMM形式で指定してください）`,
        },
        { status: 400 }
      );
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
    return NextResponse.json(
      {
        success: false,
        error: "指定された店舗が見つからないか、アクセス権がありません",
      },
      { status: 404 }
    );
  }

  // 5. 対象レコード存在確認
  const { data: existingRecords, error: checkError } = await supabase
    .from("hpb_monthly_metrics")
    .select("year_month")
    .eq("location_id", locationId)
    .in("year_month", yearMonths);

  if (checkError) {
    return NextResponse.json(
      { success: false, error: "データの確認に失敗しました" },
      { status: 500 }
    );
  }

  if (!existingRecords || existingRecords.length === 0) {
    return NextResponse.json(
      { success: false, error: "指定された年月のデータが見つかりません" },
      { status: 404 }
    );
  }

  const existingYearMonths = existingRecords.map((r) => r.year_month);

  // 6. hpb_monthly_metrics DELETE
  const { error: deleteError } = await supabase
    .from("hpb_monthly_metrics")
    .delete()
    .eq("location_id", locationId)
    .in("year_month", existingYearMonths);

  if (deleteError) {
    return NextResponse.json(
      {
        success: false,
        error: `データの削除に失敗しました: ${deleteError.message}`,
      },
      { status: 500 }
    );
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

  return NextResponse.json({
    success: true,
    data: { deletedCount: existingRecords.length },
  });
}
