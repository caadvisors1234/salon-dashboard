import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSession } from "@/lib/auth/guards";
import { generateState, getAuthorizationUrl } from "@/lib/gbp/oauth";

/**
 * GET /api/oauth/google
 * OAuth認証フロー開始。Google認可画面にリダイレクトする。
 * Admin のみ実行可能。
 */
export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json(
      { error: "この操作は管理者のみ実行できます" },
      { status: 403 }
    );
  }

  const state = generateState();

  // state を cookie に保存（CSRF対策）
  const cookieStore = await cookies();
  cookieStore.set("google_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 600, // 10分
    path: "/",
    sameSite: "lax",
  });

  const authUrl = getAuthorizationUrl(state);
  return NextResponse.redirect(authUrl);
}
