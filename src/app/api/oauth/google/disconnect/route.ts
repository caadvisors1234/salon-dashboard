import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/guards";
import { deleteAllTokens } from "@/lib/gbp/token-store";

/**
 * POST /api/oauth/google/disconnect
 * OAuth 接続を解除する（トークン + GBP アカウント情報を削除）。
 * Admin のみ実行可能。
 */
export async function POST() {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json(
      { error: "この操作は管理者のみ実行できます" },
      { status: 403 }
    );
  }

  try {
    await deleteAllTokens();

    return NextResponse.json({
      message: "Google アカウントの接続を解除しました",
    });
  } catch (err) {
    console.error("OAuth disconnect error:", err);
    return NextResponse.json(
      { error: "接続解除に失敗しました" },
      { status: 500 }
    );
  }
}
