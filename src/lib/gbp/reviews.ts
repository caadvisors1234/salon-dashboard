import { createAdminClient } from "@/lib/supabase/admin";
import type { GbpApiClient } from "./client";
import {
  GBP_API,
  type RatingData,
  type ReviewsListResponse,
} from "./types";

/**
 * Reviews API v4.9 で評価・レビュー数を取得する
 * pageSize=1 で最小データ量の取得（averageRating / totalReviewCount のみ使用）
 */
export async function fetchRatingSnapshot(
  client: GbpApiClient,
  gbpAccountId: string,
  gbpLocationId: string
): Promise<RatingData> {
  // gbpAccountId: "accounts/xxx", gbpLocationId: "xxx" (locations/ なし)
  const parent = `${gbpAccountId}/locations/${gbpLocationId}`;
  const url = `${GBP_API.REVIEWS_BASE}/${parent}/reviews?pageSize=1`;

  const response = await client.get<ReviewsListResponse>(url);

  return {
    averageRating: response.averageRating ?? null,
    totalReviewCount: response.totalReviewCount ?? null,
    fetchedAt: new Date(),
  };
}

/**
 * 評価・レビュー数スナップショットを rating_snapshots テーブルに UPSERT する
 */
export async function saveRatingSnapshot(
  locationUuid: string,
  date: string,
  data: RatingData
): Promise<void> {
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("rating_snapshots")
    .upsert(
      {
        location_id: locationUuid,
        date,
        rating: data.averageRating,
        review_count: data.totalReviewCount,
      },
      { onConflict: "location_id,date" }
    );

  if (error) {
    throw new Error(`Failed to save rating snapshot: ${error.message}`);
  }
}
