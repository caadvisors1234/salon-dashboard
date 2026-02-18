import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth/guards";
import { parseHpbCsv } from "@/lib/hpb/csv-parser";
import { MAX_FILE_SIZE } from "@/lib/hpb/constants";
import { apiSuccess, apiError } from "@/lib/api/response";
import { logAudit } from "@/lib/audit/logger";

export async function POST(request: NextRequest) {
  // 1. 認証・権限チェック
  const session = await getSession();
  if (!session) {
    return apiError("認証が必要です", 401);
  }

  if (session.role !== "admin" && session.role !== "staff") {
    return apiError("この操作にはAdmin / Staff権限が必要です", 403);
  }

  // 2. FormData 取得
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return apiError("リクエストの解析に失敗しました", 400);
  }

  const file = formData.get("file") as File | null;
  const locationId = formData.get("locationId") as string | null;
  const overwrite = formData.get("overwrite") === "true";

  if (!file) {
    return apiError("CSVファイルが指定されていません", 400);
  }

  if (!file.name.toLowerCase().endsWith(".csv")) {
    return apiError("CSVファイルのみアップロード可能です", 400);
  }

  // MIMEタイプ検証（ブラウザがMIMEを設定しない場合は空のため許可）
  const allowedMimeTypes = [
    "text/csv",
    "text/plain",
    "application/csv",
    "application/vnd.ms-excel",
  ];
  if (file.type && !allowedMimeTypes.includes(file.type)) {
    return apiError("許可されていないファイル形式です", 400);
  }

  if (!locationId) {
    return apiError("対象店舗が指定されていません", 400);
  }

  // 3. ファイルサイズチェック
  if (file.size > MAX_FILE_SIZE) {
    return apiError(
      `ファイルサイズが上限（5MB）を超えています（${(file.size / 1024 / 1024).toFixed(1)}MB）`,
      400
    );
  }

  // 4. 店舗の存在確認 + アクセス権チェック（RLS経由）
  const supabase = await createClient();

  const { data: location, error: locError } = await supabase
    .from("locations")
    .select("id, org_id, name")
    .eq("id", locationId)
    .single();

  if (locError || !location) {
    return apiError("指定された店舗が見つからないか、アクセス権がありません", 404);
  }

  // 5. CSVパース
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // マジックバイトチェック（バイナリファイルの誤アップロードを防止）
  if (buffer.length >= 4) {
    const head = buffer.subarray(0, 4);
    const blockedSignatures: { sig: number[]; label: string }[] = [
      { sig: [0x4d, 0x5a], label: "EXE" }, // MZ (Windows executable)
      { sig: [0x7f, 0x45, 0x4c, 0x46], label: "ELF" }, // ELF (Linux binary)
      { sig: [0x50, 0x4b, 0x03, 0x04], label: "ZIP" }, // ZIP archive
      { sig: [0x25, 0x50, 0x44, 0x46], label: "PDF" }, // %PDF
      { sig: [0x89, 0x50, 0x4e, 0x47], label: "PNG" }, // PNG image
    ];
    for (const { sig, label } of blockedSignatures) {
      if (sig.every((b, i) => head[i] === b)) {
        return NextResponse.json(
          {
            success: false,
            error: `CSVファイルではありません（${label}ファイルが検出されました）`,
          },
          { status: 400 }
        );
      }
    }
  }

  const parseResult = parseHpbCsv(buffer);

  // パースエラーがあれば返却（details フィールドを含むため apiError ではなく直接構築）
  if (parseResult.errors.length > 0) {
    return NextResponse.json(
      { success: false, error: parseResult.errors[0].message, details: parseResult.errors },
      { status: 400 }
    );
  }

  if (parseResult.rows.length === 0) {
    return apiError("取り込み可能なデータ行がありません", 400);
  }

  // 6. 重複チェック
  const yearMonths = parseResult.rows.map((r) => r.year_month);
  const { data: existingRecords } = await supabase
    .from("hpb_monthly_metrics")
    .select("year_month")
    .eq("location_id", locationId)
    .in("year_month", yearMonths);

  const duplicateMonths = (existingRecords ?? []).map((r) => r.year_month);

  // 7. 重複ありかつ上書き未確認 → 確認レスポンス（needsConfirmation を含む特殊形式のため直接構築）
  if (duplicateMonths.length > 0 && !overwrite) {
    return NextResponse.json({
      success: false,
      needsConfirmation: true,
      duplicateMonths,
      warnings: parseResult.warnings,
      skippedRows: parseResult.skippedRows,
      validRowCount: parseResult.rows.length,
    });
  }

  // 8. Supabase Storage にCSV原本をアップロード
  const timestamp = Date.now();
  const sanitizedName = file.name
    .replace(/[/\\]/g, "_")
    .replace(/\.\./g, "_")
    .replace(/[^\w.\-\u3000-\u9fff\uff00-\uffef\uac00-\ud7af]/g, "_")
    .slice(0, 100);
  const storagePath = `${location.org_id}/${locationId}/${timestamp}_${sanitizedName}`;

  const { error: storageError } = await supabase.storage
    .from("hpb-csv")
    .upload(storagePath, buffer, {
      contentType: file.type || "text/csv",
      upsert: false,
    });

  if (storageError) {
    console.error("Storage upload error:", storageError);
    // Storage保存失敗はワーニングとして続行（データ格納は実行する）
    parseResult.warnings.push({
      level: "warning",
      message: "CSV原本の保存に失敗しました",
    });
  }

  // 9. hpb_monthly_metrics へ UPSERT
  const upsertRows = parseResult.rows.map((row) => ({
    location_id: locationId,
    ...row,
  }));

  const { error: upsertError } = await supabase
    .from("hpb_monthly_metrics")
    .upsert(upsertRows, { onConflict: "location_id,year_month" });

  if (upsertError) {
    console.error("[HPB Upload] Upsert error:", upsertError);
    return apiError("データの保存に失敗しました", 500);
  }

  // 10. hpb_upload_logs にログ記録
  const logStatus =
    parseResult.skippedRows > 0 || parseResult.warnings.length > 0
      ? "partial"
      : "success";

  await supabase.from("hpb_upload_logs").insert({
    location_id: locationId,
    uploaded_by: session.id,
    file_name: file.name,
    file_path: storageError ? null : storagePath,
    record_count: parseResult.rows.length,
    status: logStatus,
    error_message:
      parseResult.warnings.length > 0
        ? parseResult.warnings.map((w) => w.message).join("; ")
        : null,
  });

  // 11. 監査ログ
  logAudit({
    userId: session.id,
    action: "hpb.upload",
    resourceType: "hpb_data",
    resourceId: locationId,
    metadata: { recordCount: parseResult.rows.length, fileName: file.name },
    ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined,
  });

  // 12. 結果レスポンス
  return apiSuccess({
    recordCount: parseResult.rows.length,
    skippedRows: parseResult.skippedRows,
    warnings: parseResult.warnings,
    duplicateMonths,
  });
}
