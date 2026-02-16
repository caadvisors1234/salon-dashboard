import { createAdminClient } from "@/lib/supabase/admin";
import type { GbpApiClient } from "./client";
import {
  GBP_API,
  type KeywordResult,
  type SearchKeywordsResponse,
} from "./types";

/**
 * Search Keywords API で月次検索キーワードを取得する（ページネーション対応）
 */
export async function fetchMonthlyKeywords(
  client: GbpApiClient,
  gbpLocationId: string,
  year: number,
  month: number
): Promise<KeywordResult[]> {
  const results: KeywordResult[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      "monthlyRange.startMonth.year": String(year),
      "monthlyRange.startMonth.month": String(month),
      "monthlyRange.endMonth.year": String(year),
      "monthlyRange.endMonth.month": String(month),
      pageSize: "100",
    });

    if (pageToken) {
      params.set("pageToken", pageToken);
    }

    const url = `${GBP_API.PERFORMANCE_BASE}/locations/${gbpLocationId}/searchkeywords/impressions/monthly?${params.toString()}`;

    const response = await client.get<SearchKeywordsResponse>(url);

    if (response.searchKeywordsCounts) {
      for (const item of response.searchKeywordsCounts) {
        const iv = item.insightsValue;

        if (iv.value !== undefined) {
          results.push({
            keyword: item.searchKeyword,
            insightsValueType: "VALUE",
            insightsValue: parseInt(iv.value, 10) || 0,
            insightsThreshold: null,
          });
        } else if (iv.threshold !== undefined) {
          results.push({
            keyword: item.searchKeyword,
            insightsValueType: "THRESHOLD",
            insightsValue: null,
            insightsThreshold: parseInt(iv.threshold, 10) || 0,
          });
        }
      }
    }

    pageToken = response.nextPageToken;
  } while (pageToken);

  return results;
}

/**
 * 月次キーワードを monthly_keywords テーブルに UPSERT する
 */
export async function saveMonthlyKeywords(
  locationUuid: string,
  yearMonth: string,
  results: KeywordResult[]
): Promise<number> {
  if (results.length === 0) return 0;

  const supabase = createAdminClient();

  const rows = results.map((r) => ({
    location_id: locationUuid,
    year_month: yearMonth,
    keyword: r.keyword,
    insights_value: r.insightsValue,
    insights_threshold: r.insightsThreshold,
    insights_value_type: r.insightsValueType,
  }));

  const { error, count } = await supabase
    .from("monthly_keywords")
    .upsert(rows, {
      onConflict: "location_id,year_month,keyword",
      count: "exact",
    });

  if (error) {
    throw new Error(`Failed to save monthly keywords: ${error.message}`);
  }

  return count || rows.length;
}
