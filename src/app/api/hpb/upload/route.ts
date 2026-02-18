import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth/guards";
import { parseHpbCsv } from "@/lib/hpb/csv-parser";
import { MAX_FILE_SIZE, type ParseMessage } from "@/lib/hpb/constants";

type UploadSuccessResponse = {
  success: true;
  data: {
    recordCount: number;
    skippedRows: number;
    warnings: ParseMessage[];
    duplicateMonths: string[];
  };
};

type UploadConfirmResponse = {
  success: false;
  needsConfirmation: true;
  duplicateMonths: string[];
  warnings: ParseMessage[];
  skippedRows: number;
  validRowCount: number;
};

type UploadErrorResponse = {
  success: false;
  error: string;
  details?: ParseMessage[];
};

type UploadResponse =
  | UploadSuccessResponse
  | UploadConfirmResponse
  | UploadErrorResponse;

export async function POST(
  request: NextRequest
): Promise<NextResponse<UploadResponse>> {
  // 1. 認証・権限チェック
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

  // 2. FormData 取得
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { success: false, error: "リクエストの解析に失敗しました" },
      { status: 400 }
    );
  }

  const file = formData.get("file") as File | null;
  const locationId = formData.get("locationId") as string | null;
  const overwrite = formData.get("overwrite") === "true";

  if (!file) {
    return NextResponse.json(
      { success: false, error: "CSVファイルが指定されていません" },
      { status: 400 }
    );
  }

  if (!file.name.toLowerCase().endsWith(".csv")) {
    return NextResponse.json(
      { success: false, error: "CSVファイルのみアップロード可能です" },
      { status: 400 }
    );
  }

  // MIMEタイプ検証（ブラウザがMIMEを設定しない場合は空のため許可）
  const allowedMimeTypes = [
    "text/csv",
    "text/plain",
    "application/csv",
    "application/vnd.ms-excel",
  ];
  if (file.type && !allowedMimeTypes.includes(file.type)) {
    return NextResponse.json(
      { success: false, error: "許可されていないファイル形式です" },
      { status: 400 }
    );
  }

  if (!locationId) {
    return NextResponse.json(
      { success: false, error: "対象店舗が指定されていません" },
      { status: 400 }
    );
  }

  // 3. ファイルサイズチェック
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      {
        success: false,
        error: `ファイルサイズが上限（5MB）を超えています（${(file.size / 1024 / 1024).toFixed(1)}MB）`,
      },
      { status: 400 }
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
    return NextResponse.json(
      {
        success: false,
        error: "指定された店舗が見つからないか、アクセス権がありません",
      },
      { status: 404 }
    );
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

  // パースエラーがあれば返却
  if (parseResult.errors.length > 0) {
    return NextResponse.json(
      {
        success: false,
        error: parseResult.errors[0].message,
        details: parseResult.errors,
      },
      { status: 400 }
    );
  }

  if (parseResult.rows.length === 0) {
    return NextResponse.json(
      { success: false, error: "取り込み可能なデータ行がありません" },
      { status: 400 }
    );
  }

  // 6. 重複チェック
  const yearMonths = parseResult.rows.map((r) => r.year_month);
  const { data: existingRecords } = await supabase
    .from("hpb_monthly_metrics")
    .select("year_month")
    .eq("location_id", locationId)
    .in("year_month", yearMonths);

  const duplicateMonths = (existingRecords ?? []).map((r) => r.year_month);

  // 7. 重複ありかつ上書き未確認 → 確認レスポンス
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
      message: `CSV原本の保存に失敗しました: ${storageError.message}`,
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
    return NextResponse.json(
      {
        success: false,
        error: `データの保存に失敗しました: ${upsertError.message}`,
      },
      { status: 500 }
    );
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

  // 11. 結果レスポンス
  return NextResponse.json({
    success: true,
    data: {
      recordCount: parseResult.rows.length,
      skippedRows: parseResult.skippedRows,
      warnings: parseResult.warnings,
      duplicateMonths,
    },
  });
}
