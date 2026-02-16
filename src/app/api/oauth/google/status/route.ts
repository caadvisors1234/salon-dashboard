import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/guards";
import { getStoredToken } from "@/lib/gbp/token-store";

export type OAuthStatus = "connected" | "disconnected" | "invalid";

export interface OAuthStatusResponse {
  status: OAuthStatus;
  googleEmail?: string;
  tokenExpiry?: string;
  scopes?: string;
}

/**
 * GET /api/oauth/google/status
 * OAuth 接続状態を返す。Admin のみ。
 */
export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json(
      { error: "この操作は管理者のみ実行できます" },
      { status: 403 }
    );
  }

  const token = await getStoredToken();

  if (!token) {
    return NextResponse.json<OAuthStatusResponse>({
      status: "disconnected",
    });
  }

  if (!token.isValid) {
    return NextResponse.json<OAuthStatusResponse>({
      status: "invalid",
      googleEmail: token.googleEmail,
    });
  }

  return NextResponse.json<OAuthStatusResponse>({
    status: "connected",
    googleEmail: token.googleEmail,
    tokenExpiry: token.tokenExpiry,
    scopes: token.scopes,
  });
}
