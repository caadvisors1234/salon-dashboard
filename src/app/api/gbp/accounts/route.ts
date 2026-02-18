import { getSession } from "@/lib/auth/guards";
import { getStoredGbpAccounts } from "@/lib/gbp/accounts";
import { apiSuccess, apiError } from "@/lib/api/response";

/**
 * GET /api/gbp/accounts
 * DB に保存済みの GBP アカウント一覧を返す。Admin のみ。
 */
export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return apiError("この操作は管理者のみ実行できます", 403);
  }

  try {
    const accounts = await getStoredGbpAccounts();
    return apiSuccess({ accounts });
  } catch (err) {
    console.error("Failed to fetch GBP accounts:", err);
    return apiError("GBP アカウント一覧の取得に失敗しました", 500);
  }
}
