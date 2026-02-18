import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/guards";
import { checkOrgAccess } from "@/lib/auth/access";
import { createAdminClient } from "@/lib/supabase/admin";
import { createReportToken } from "@/lib/pdf/token";
import { pdfQueue } from "@/lib/pdf/queue";
import { pdfRateLimit } from "@/lib/pdf/rate-limit";
import { generateStorePdf, generateClientZip } from "@/lib/pdf/generator";
import { getOrgLocations, getOrgName } from "@/lib/pdf/report-queries";
import { apiError } from "@/lib/api/response";
import { logAudit } from "@/lib/audit/logger";
import { createLogger } from "@/lib/logger";

const log = createLogger("ReportGenerate");

// Next.js API Route のタイムアウト設定
export const maxDuration = 300; // 5分（クライアント単位を考慮）

type RequestBody = {
  type: "store" | "client";
  locationId?: string;
  orgId?: string;
  startMonth: string;
  endMonth: string;
};

export async function POST(request: NextRequest) {
  // 認証チェック
  const user = await getSession();
  if (!user) {
    return apiError("未認証です", 401);
  }

  // リクエストボディのバリデーション
  let body: RequestBody;
  try {
    body = await request.json();
  } catch {
    return apiError("不正なリクエストボディです", 400);
  }

  const { type, locationId, orgId, startMonth, endMonth } = body;

  if (!type || !["store", "client"].includes(type)) {
    return apiError("type は 'store' または 'client' を指定してください", 400);
  }

  if (!startMonth || !endMonth || !/^\d{4}-\d{2}$/.test(startMonth) || !/^\d{4}-\d{2}$/.test(endMonth)) {
    return apiError("startMonth, endMonth は YYYY-MM 形式で指定してください", 400);
  }

  if (startMonth > endMonth) {
    return apiError("startMonth は endMonth 以前の日付にしてください", 400);
  }

  // 権限チェック + ファイル名用データ取得
  let locationOrgName: string | undefined;
  let locationName: string | undefined;

  if (type === "store") {
    if (!locationId) {
      return apiError("locationId は必須です", 400);
    }

    // locationId の org_id を取得して権限確認 + ファイル名用データ取得
    const supabase = createAdminClient();
    const { data: location } = await supabase
      .from("locations")
      .select("name, org_id")
      .eq("id", locationId)
      .single();

    if (!location) {
      return apiError("店舗が見つかりません", 400);
    }

    const hasAccess = await checkOrgAccess(user, location.org_id);
    if (!hasAccess) {
      return apiError("この店舗のレポート生成権限がありません", 403);
    }

    // ファイル名用に保持（後続のDB問い合わせを削減）
    locationName = location.name;

    const { data: org } = await supabase
      .from("organizations")
      .select("name")
      .eq("id", location.org_id)
      .single();
    locationOrgName = org?.name ?? "クライアント";
  } else {
    // client
    if (!orgId) {
      return apiError("orgId は必須です", 400);
    }

    const hasAccess = await checkOrgAccess(user, orgId);
    if (!hasAccess) {
      return apiError("このクライアントのレポート生成権限がありません", 403);
    }
  }

  // ユーザー単位レート制限チェック
  const rateCheck = pdfRateLimit.check(user.id);
  if (!rateCheck.allowed) {
    return apiError(
      "レポート生成の上限に達しました（1時間あたり5件まで）",
      429,
      { "Retry-After": String(Math.ceil((rateCheck.resetAt - Date.now()) / 1000)) }
    );
  }

  // キュー状態チェック（待ちが多すぎる場合は拒否）
  const status = pdfQueue.getStatus();
  if (status.waiting >= 10) {
    log.warn({ waiting: status.waiting }, "Queue full");
    return apiError("生成キューが満杯です", 429);
  }

  try {
    if (type === "store") {
      // 店舗単位PDF生成
      const token = await createReportToken(user.id, {
        type: "store",
        locationId: locationId!,
      });

      const pdfBuffer = await pdfQueue.enqueue((signal) =>
        generateStorePdf(locationId!, startMonth, endMonth, token, signal)
      );

      // 権限チェック時に取得したデータを再利用
      const orgName = (locationOrgName ?? "クライアント").replace(/[/\\?%*:|"<>]/g, "_");
      const locName = (locationName ?? "店舗").replace(/[/\\?%*:|"<>]/g, "_");
      const fileName = `${orgName}_${locName}_${startMonth}-${endMonth}.pdf`;

      logAudit({
        userId: user.id,
        action: "report.generate",
        resourceType: "report",
        resourceId: locationId,
        metadata: { type, startMonth, endMonth },
        ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined,
      });

      return new NextResponse(new Uint8Array(pdfBuffer), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        },
      });
    } else {
      // クライアント単位ZIP生成
      const token = await createReportToken(user.id, {
        type: "client",
        orgId: orgId!,
      });

      const locations = await getOrgLocations(orgId!);
      if (locations.length === 0) {
        return apiError("対象店舗がありません", 400);
      }

      const orgName = await getOrgName(orgId!);
      const safeOrgName = orgName.replace(/[/\\?%*:|"<>]/g, "_");

      // 各店舗のPDF生成をキュー経由で個別に実行（1スロット占有し続けない）
      const zipBuffer = await generateClientZip(
        safeOrgName,
        startMonth,
        endMonth,
        token,
        locations,
        (job) => pdfQueue.enqueue(job)
      );

      const fileName = `${safeOrgName}_レポート_${startMonth}-${endMonth}.zip`;

      logAudit({
        userId: user.id,
        action: "report.generate",
        resourceType: "report",
        resourceId: orgId,
        metadata: { type, startMonth, endMonth },
        ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined,
      });

      return new NextResponse(new Uint8Array(zipBuffer), {
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        },
      });
    }
  } catch (err) {
    log.error({ err }, "Error generating PDF");
    return apiError("PDF生成に失敗しました", 500);
  }
}
