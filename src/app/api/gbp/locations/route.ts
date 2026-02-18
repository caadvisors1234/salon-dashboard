import { getSession } from "@/lib/auth/guards";
import { apiSuccess, apiError } from "@/lib/api/response";
import { getStoredGbpAccounts, fetchGbpLocations, fetchVoiceOfMerchantState } from "@/lib/gbp/accounts";
import { getValidAccessToken } from "@/lib/gbp/token-store";
import { refreshAccessToken } from "@/lib/gbp/oauth";
import type { GbpLocation, VoiceOfMerchantState, LocationStatus } from "@/lib/gbp/types";

const STATUS_LABELS: Record<LocationStatus, string> = {
  verified: "確認済み",
  duplicate: "重複",
  suspended: "停止中",
  disabled: "無効",
  needs_verification: "オーナー確認が必要",
  verification_pending: "確認中",
  under_review: "審査中",
  ownership_conflict: "オーナー権限の競合",
  closed_permanently: "閉業",
  closed_temporarily: "一時休業中",
  unknown: "不明",
};

function determineStatusFromVoM(vom: VoiceOfMerchantState | null): LocationStatus {
  if (!vom) return "unknown";

  if (vom.complyWithGuidelines) {
    if (vom.complyWithGuidelines.recommendationReason === "BUSINESS_LOCATION_SUSPENDED") {
      return "suspended";
    }
    if (vom.complyWithGuidelines.recommendationReason === "BUSINESS_LOCATION_DISABLED") {
      return "disabled";
    }
    console.warn(
      `Unknown complyWithGuidelines reason: ${vom.complyWithGuidelines.recommendationReason}`
    );
    return "unknown";
  }

  if (vom.verify) {
    return vom.verify.hasPendingVerification ? "verification_pending" : "needs_verification";
  }

  if (vom.waitForVoiceOfMerchant !== undefined) {
    return "under_review";
  }

  if (vom.resolveOwnershipConflict !== undefined) {
    return "ownership_conflict";
  }

  return "unknown";
}

function determineLocationStatus(
  loc: GbpLocation,
  vom: VoiceOfMerchantState | null
): LocationStatus {
  // 1. 閉業/休業チェック
  if (loc.openInfo?.status === "CLOSED_PERMANENTLY") return "closed_permanently";
  if (loc.openInfo?.status === "CLOSED_TEMPORARILY") return "closed_temporarily";

  // 2. 重複チェック
  if (loc.metadata?.duplicateLocation) return "duplicate";

  // 3. VoM確認済みチェック
  if (loc.metadata?.hasVoiceOfMerchant === true) return "verified";

  // 4. Verifications APIの結果で判定
  return determineStatusFromVoM(vom);
}

/**
 * GET /api/gbp/locations
 * 全 GBP アカウントのロケーション一覧を返す。Admin のみ。
 * API を直接呼び出して最新のロケーション情報を取得する。
 */
export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return apiError("この操作は管理者のみ実行できます", 403);
  }

  try {
    const accessToken = await getValidAccessToken(refreshAccessToken);
    if (!accessToken) {
      return apiError("Google アカウントが接続されていません", 400);
    }

    const accounts = await getStoredGbpAccounts();
    if (accounts.length === 0) {
      return apiSuccess({ locations: [] });
    }

    const allLocations: Array<{
      accountId: string;
      accountName: string | null;
      locationId: string;
      locationName: string | null;
      placeId: string | null;
      address: string | null;
      status: LocationStatus;
      statusLabel: string;
    }> = [];

    for (const account of accounts) {
      try {
        const locations = await fetchGbpLocations(
          accessToken,
          account.gbpAccountId
        );

        // VoM未確認のロケーションのみ Verifications API を並列呼び出し
        const nonVomLocations = locations.filter(
          (loc) => loc.metadata?.hasVoiceOfMerchant !== true
        );
        const locationVomMap = new Map<string, VoiceOfMerchantState | null>();
        const vomResults = await Promise.all(
          nonVomLocations.map(async (loc) => {
            const locationId = loc.name.replace("locations/", "");
            const vom = await fetchVoiceOfMerchantState(accessToken, locationId);
            return [loc.name, vom] as const;
          })
        );
        for (const [name, vom] of vomResults) {
          locationVomMap.set(name, vom);
        }

        for (const loc of locations) {
          const locationId = loc.name.replace("locations/", "");
          const addressParts = [
            ...(loc.storefrontAddress?.addressLines || []),
            loc.storefrontAddress?.locality,
            loc.storefrontAddress?.administrativeArea,
          ].filter(Boolean);

          const vom = locationVomMap.get(loc.name) ?? null;
          const status = determineLocationStatus(loc, vom);

          allLocations.push({
            accountId: account.gbpAccountId,
            accountName: account.accountName,
            locationId,
            locationName: loc.title || null,
            placeId: loc.metadata?.placeId || null,
            address: addressParts.length > 0 ? addressParts.join(" ") : null,
            status,
            statusLabel: STATUS_LABELS[status],
          });
        }
      } catch (err) {
        console.error(
          `Failed to fetch locations for ${account.gbpAccountId}:`,
          err
        );
      }
    }

    return apiSuccess({ locations: allLocations });
  } catch (err) {
    console.error("Failed to fetch GBP locations:", err);
    return apiError("GBP ロケーション一覧の取得に失敗しました", 500);
  }
}
