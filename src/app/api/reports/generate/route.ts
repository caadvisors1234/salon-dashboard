import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/guards";
import { checkOrgAccess } from "@/lib/auth/access";
import { createAdminClient } from "@/lib/supabase/admin";
import { createReportToken } from "@/lib/pdf/token";
import { pdfQueue } from "@/lib/pdf/queue";
import { pdfRateLimit } from "@/lib/pdf/rate-limit";
import { generateStorePdf, generateClientZip } from "@/lib/pdf/generator";
import { getOrgLocations, getOrgName } from "@/lib/pdf/report-queries";

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
    return NextResponse.json({ error: "未認証です" }, { status: 401 });
  }

  // リクエストボディのバリデーション
  let body: RequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "不正なリクエストボディです" }, { status: 400 });
  }

  const { type, locationId, orgId, startMonth, endMonth } = body;

  if (!type || !["store", "client"].includes(type)) {
    return NextResponse.json({ error: "type は 'store' または 'client' を指定してください" }, { status: 400 });
  }

  if (!startMonth || !endMonth || !/^\d{4}-\d{2}$/.test(startMonth) || !/^\d{4}-\d{2}$/.test(endMonth)) {
    return NextResponse.json({ error: "startMonth, endMonth は YYYY-MM 形式で指定してください" }, { status: 400 });
  }

  if (startMonth > endMonth) {
    return NextResponse.json({ error: "startMonth は endMonth 以前の日付にしてください" }, { status: 400 });
  }

  // 権限チェック + ファイル名用データ取得
  let locationOrgName: string | undefined;
  let locationName: string | undefined;

  if (type === "store") {
    if (!locationId) {
      return NextResponse.json({ error: "locationId は必須です" }, { status: 400 });
    }

    // locationId の org_id を取得して権限確認 + ファイル名用データ取得
    const supabase = createAdminClient();
    const { data: location } = await supabase
      .from("locations")
      .select("name, org_id")
      .eq("id", locationId)
      .single();

    if (!location) {
      return NextResponse.json({ error: "店舗が見つかりません" }, { status: 400 });
    }

    const hasAccess = await checkOrgAccess(user, location.org_id);
    if (!hasAccess) {
      return NextResponse.json({ error: "この店舗のレポート生成権限がありません" }, { status: 403 });
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
      return NextResponse.json({ error: "orgId は必須です" }, { status: 400 });
    }

    const hasAccess = await checkOrgAccess(user, orgId);
    if (!hasAccess) {
      return NextResponse.json({ error: "このクライアントのレポート生成権限がありません" }, { status: 403 });
    }
  }

  // ユーザー単位レート制限チェック
  // NOTE: check()はカウントを消費する（生成成功時ではなく呼出時にカウント）。
  // 後続のキュー満杯や生成失敗でもカウントされるが、乱用防止の観点で許容する。
  const rateCheck = pdfRateLimit.check(user.id);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: "レポート生成の上限に達しました（1時間あたり5件まで）" },
      {
        status: 429,
        headers: {
          "Retry-After": String(
            Math.ceil((rateCheck.resetAt - Date.now()) / 1000)
          ),
        },
      }
    );
  }

  // キュー状態チェック（待ちが多すぎる場合は拒否）
  const status = pdfQueue.getStatus();
  if (status.waiting >= 10) {
    return NextResponse.json(
      { error: "生成キューが満杯です", queuePosition: status.waiting },
      { status: 429 }
    );
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
        return NextResponse.json({ error: "対象店舗がありません" }, { status: 400 });
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

      return new NextResponse(new Uint8Array(zipBuffer), {
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        },
      });
    }
  } catch (err) {
    console.error("レポート生成エラー:", err);
    const message = err instanceof Error ? err.message : "PDF生成に失敗しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
