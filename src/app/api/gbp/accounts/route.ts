import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/guards";
import { getStoredGbpAccounts } from "@/lib/gbp/accounts";

/**
 * GET /api/gbp/accounts
 * DB に保存済みの GBP アカウント一覧を返す。Admin のみ。
 */
export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json(
      { error: "この操作は管理者のみ実行できます" },
      { status: 403 }
    );
  }

  try {
    const accounts = await getStoredGbpAccounts();
    return NextResponse.json({ accounts });
  } catch (err) {
    console.error("Failed to fetch GBP accounts:", err);
    return NextResponse.json(
      { error: "GBP アカウント一覧の取得に失敗しました" },
      { status: 500 }
    );
  }
}
