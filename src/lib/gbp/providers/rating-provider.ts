import type { RatingData } from "../types";

/**
 * 評価・レビュー数取得の抽象化インターフェース。
 * v4.9 Reviews 廃止時に Places API 実装に差し替え可能。
 */
export interface RatingProvider {
  getRating(gbpLocationId: string, gbpAccountId?: string): Promise<RatingData>;
}

/**
 * RatingProvider のファクトリ関数。
 * 現時点では GBP Reviews v4.9 のみ。将来 Places API 版を追加した場合、
 * 環境変数や設定テーブルで切替可能にする。
 */
export async function createRatingProvider(): Promise<RatingProvider> {
  // 将来: if (process.env.RATING_PROVIDER === 'places_api') { ... }
  const { GbpReviewsRatingProvider } = await import("./gbp-reviews-provider");
  return new GbpReviewsRatingProvider();
}
