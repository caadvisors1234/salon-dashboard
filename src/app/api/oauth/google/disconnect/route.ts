import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/guards";
import { deleteAllTokens } from "@/lib/gbp/token-store";
import { apiSuccess, apiError } from "@/lib/api/response";
import { logAudit } from "@/lib/audit/logger";

/**
 * POST /api/oauth/google/disconnect
 * OAuth 接続を解除する（トークン + GBP アカウント情報を削除）。
 * Admin のみ実行可能。
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return apiError("この操作は管理者のみ実行できます", 403);
  }

  try {
    await deleteAllTokens();

    logAudit({
      userId: session.id,
      action: "oauth.disconnect",
      resourceType: "oauth_token",
      ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined,
    });

    return apiSuccess({
      message: "Google アカウントの接続を解除しました",
    });
  } catch (err) {
    console.error("OAuth disconnect error:", err);
    return apiError("接続解除に失敗しました", 500);
  }
}
