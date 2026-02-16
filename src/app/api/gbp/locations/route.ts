import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/guards";
import { getStoredGbpAccounts, fetchGbpLocations } from "@/lib/gbp/accounts";
import { getValidAccessToken } from "@/lib/gbp/token-store";
import { refreshAccessToken } from "@/lib/gbp/oauth";

/**
 * GET /api/gbp/locations
 * 全 GBP アカウントのロケーション一覧を返す。Admin のみ。
 * API を直接呼び出して最新のロケーション情報を取得する。
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
    const accessToken = await getValidAccessToken(refreshAccessToken);
    if (!accessToken) {
      return NextResponse.json(
        { error: "Google アカウントが接続されていません" },
        { status: 400 }
      );
    }

    const accounts = await getStoredGbpAccounts();
    if (accounts.length === 0) {
      return NextResponse.json({ locations: [] });
    }

    const allLocations: Array<{
      accountId: string;
      accountName: string | null;
      locationId: string;
      locationName: string | null;
      placeId: string | null;
      address: string | null;
    }> = [];

    for (const account of accounts) {
      try {
        const locations = await fetchGbpLocations(
          accessToken,
          account.gbpAccountId
        );

        for (const loc of locations) {
          // loc.name は "locations/xxx" 形式
          const locationId = loc.name.replace("locations/", "");
          const addressParts = [
            ...(loc.storefrontAddress?.addressLines || []),
            loc.storefrontAddress?.locality,
            loc.storefrontAddress?.administrativeArea,
          ].filter(Boolean);

          allLocations.push({
            accountId: account.gbpAccountId,
            accountName: account.accountName,
            locationId,
            locationName: loc.title || null,
            placeId: loc.metadata?.placeId || null,
            address: addressParts.length > 0 ? addressParts.join(" ") : null,
          });
        }
      } catch (err) {
        console.error(
          `Failed to fetch locations for ${account.gbpAccountId}:`,
          err
        );
      }
    }

    return NextResponse.json({ locations: allLocations });
  } catch (err) {
    console.error("Failed to fetch GBP locations:", err);
    return NextResponse.json(
      { error: "GBP ロケーション一覧の取得に失敗しました" },
      { status: 500 }
    );
  }
}
