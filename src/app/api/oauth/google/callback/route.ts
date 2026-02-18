import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getSession } from "@/lib/auth/guards";
import { exchangeCodeForTokens, getUserInfo } from "@/lib/gbp/oauth";
import { saveOAuthTokens } from "@/lib/gbp/token-store";
import { fetchAndSaveGbpAccounts } from "@/lib/gbp/accounts";
import { logAudit } from "@/lib/audit/logger";

/**
 * GET /api/oauth/google/callback
 * Google OAuth callback。認可コードをトークンに交換して保存する。
 */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.redirect(
      new URL("/login", process.env.NEXT_PUBLIC_APP_URL!)
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL!;
  const settingsUrl = new URL("/dashboard/admin/settings", baseUrl);

  // エラーチェック
  if (error) {
    settingsUrl.searchParams.set("oauth_error", error);
    return NextResponse.redirect(settingsUrl);
  }

  if (!code || !state) {
    settingsUrl.searchParams.set("oauth_error", "missing_params");
    return NextResponse.redirect(settingsUrl);
  }

  // state 検証（CSRF対策）
  const cookieStore = await cookies();
  const savedState = cookieStore.get("google_oauth_state")?.value;
  cookieStore.delete("google_oauth_state");

  if (!savedState || savedState !== state) {
    settingsUrl.searchParams.set("oauth_error", "invalid_state");
    return NextResponse.redirect(settingsUrl);
  }

  try {
    // トークン交換
    const tokens = await exchangeCodeForTokens(code);

    // ユーザー情報取得
    const userInfo = await getUserInfo(tokens.accessToken);

    // トークン保存
    const tokenId = await saveOAuthTokens(session.id, {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiryDate: tokens.expiryDate,
      scopes: tokens.scopes,
      googleEmail: userInfo.email,
    });

    // GBP アカウント一覧を取得・保存
    try {
      await fetchAndSaveGbpAccounts(tokens.accessToken, tokenId);
    } catch (accountError) {
      console.error("Failed to fetch GBP accounts:", accountError);
      // アカウント取得失敗は致命的ではない（後から再取得可能）
    }

    logAudit({
      userId: session.id,
      action: "oauth.connect",
      resourceType: "oauth_token",
      resourceId: tokenId,
      metadata: { googleEmail: userInfo.email },
      ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined,
    });

    settingsUrl.searchParams.set("oauth_success", "true");
    return NextResponse.redirect(settingsUrl);
  } catch (err) {
    console.error("OAuth callback error:", err);
    settingsUrl.searchParams.set("oauth_error", "token_exchange_failed");
    return NextResponse.redirect(settingsUrl);
  }
}
