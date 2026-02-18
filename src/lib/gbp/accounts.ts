import { createAdminClient } from "@/lib/supabase/admin";
import { GBP_API, type GbpAccount, type AccountsListResponse, type GbpLocation, type LocationsListResponse, type VoiceOfMerchantState } from "./types";
import { createLogger } from "@/lib/logger";

const log = createLogger("GBPAccounts");

/**
 * GBP アカウント一覧を取得して gbp_accounts テーブルに保存する
 */
export async function fetchAndSaveGbpAccounts(
  accessToken: string,
  tokenId: string
): Promise<GbpAccount[]> {
  const response = await fetch(`${GBP_API.ACCOUNTS_BASE}/accounts`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to fetch GBP accounts: ${response.status} ${error}`);
  }

  const data: AccountsListResponse = await response.json();
  const accounts = data.accounts || [];

  if (accounts.length === 0) {
    return [];
  }

  const supabase = createAdminClient();

  // 既存アカウントを削除（token_id に紐づくもの）
  await supabase
    .from("gbp_accounts")
    .delete()
    .eq("google_oauth_token_id", tokenId);

  // 新しいアカウントを保存
  const rows = accounts.map((account) => ({
    google_oauth_token_id: tokenId,
    gbp_account_id: account.name,
    account_name: account.accountName || null,
  }));

  const { error } = await supabase.from("gbp_accounts").insert(rows);

  if (error) {
    throw new Error(`Failed to save GBP accounts: ${error.message}`);
  }

  return accounts;
}

/**
 * DB に保存済みの GBP アカウント一覧を取得する
 */
export async function getStoredGbpAccounts(): Promise<
  Array<{ id: string; gbpAccountId: string; accountName: string | null }>
> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("gbp_accounts")
    .select("id, gbp_account_id, account_name")
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch stored GBP accounts: ${error.message}`);
  }

  return (data || []).map((row) => ({
    id: row.id,
    gbpAccountId: row.gbp_account_id,
    accountName: row.account_name,
  }));
}

/**
 * GBP アカウント配下のロケーション一覧を取得する（API直接呼び出し）
 */
export async function fetchGbpLocations(
  accessToken: string,
  accountId: string
): Promise<GbpLocation[]> {
  const allLocations: GbpLocation[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({ readMask: "name,title,storefrontAddress,metadata,openInfo" });
    if (pageToken) {
      params.set("pageToken", pageToken);
    }

    const response = await fetch(
      `${GBP_API.BUSINESS_INFO_BASE}/${accountId}/locations?${params.toString()}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to fetch locations for ${accountId}: ${response.status} ${error}`);
    }

    const data: LocationsListResponse = await response.json();
    if (data.locations) {
      allLocations.push(...data.locations);
    }
    pageToken = data.nextPageToken;
  } while (pageToken);

  return allLocations;
}

/**
 * ロケーションの VoiceOfMerchantState を取得する（Verifications API）
 * エラー時は null を返す（安全側に倒す）
 */
export async function fetchVoiceOfMerchantState(
  accessToken: string,
  locationId: string
): Promise<VoiceOfMerchantState | null> {
  try {
    const response = await fetch(
      `${GBP_API.VERIFICATIONS_BASE}/locations/${locationId}/VoiceOfMerchantState`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!response.ok) {
      log.error(
        { locationId, status: response.status },
        "Failed to fetch VoiceOfMerchantState"
      );
      return null;
    }

    return await response.json();
  } catch (err) {
    log.error(
      { err, locationId },
      "Error fetching VoiceOfMerchantState"
    );
    return null;
  }
}
