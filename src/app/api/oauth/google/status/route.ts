import { apiSuccess, apiError } from "@/lib/api/response";
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
    return apiError("この操作は管理者のみ実行できます", 403);
  }

  const token = await getStoredToken();

  if (!token) {
    return apiSuccess({
      status: "disconnected" as const,
    });
  }

  if (!token.isValid) {
    return apiSuccess({
      status: "invalid" as const,
      googleEmail: token.googleEmail,
    });
  }

  return apiSuccess({
    status: "connected" as const,
    googleEmail: token.googleEmail,
    tokenExpiry: token.tokenExpiry,
    scopes: token.scopes,
  });
}
