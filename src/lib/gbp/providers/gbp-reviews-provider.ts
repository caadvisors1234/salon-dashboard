import type { RatingProvider } from "./rating-provider";
import type { RatingData } from "../types";
import { createGbpClient } from "../client";
import { fetchRatingSnapshot } from "../reviews";

/**
 * GBP API v4.9 Reviews を使用した RatingProvider 実装。
 * accounts.locations.reviews.list で averageRating / totalReviewCount を取得する。
 */
export class GbpReviewsRatingProvider implements RatingProvider {
  async getRating(
    gbpLocationId: string,
    gbpAccountId?: string
  ): Promise<RatingData> {
    if (!gbpAccountId) {
      throw new Error(
        "gbpAccountId is required for GBP Reviews API v4.9"
      );
    }

    const client = createGbpClient();
    return fetchRatingSnapshot(client, gbpAccountId, gbpLocationId);
  }
}
