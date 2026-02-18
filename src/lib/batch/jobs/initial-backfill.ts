/**
 * 初期バックフィルジョブ
 * ロケーション新規登録時に1年分のデータを一括取得する
 * - 日次メトリクス: 365日分
 * - 月次キーワード: 12ヶ月分
 * - 評価スナップショット: backfill内で当日分のみ（API制約）
 */
import { runBackfillJob, type BackfillJobResult } from "./backfill";
import { runMonthlyJob, type MonthlyJobResult } from "./monthly";
import { createLogger } from "@/lib/logger";

const log = createLogger("InitialBackfill");

const INITIAL_BACKFILL_DAYS = 365;
const INITIAL_BACKFILL_MONTHS = 12;

export interface InitialBackfillResult {
  locationId: string;
  backfill: BackfillJobResult;
  monthlyResults: MonthlyJobResult[];
}

/**
 * 1ロケーションの初期バックフィルを実行する
 * @param locationId 対象ロケーションのID（locationsテーブルのUUID）
 */
export async function runInitialBackfill(
  locationId: string
): Promise<InitialBackfillResult> {
  log.info({ locationId }, "Starting initial backfill");

  // 1. 日次メトリクス + 評価スナップショット（365日）
  const backfill = await runBackfillJob(INITIAL_BACKFILL_DAYS, [locationId]);

  // 2. 月次キーワード（過去12ヶ月分）
  const monthlyResults: MonthlyJobResult[] = [];
  const now = new Date();
  for (let i = 1; i <= INITIAL_BACKFILL_MONTHS; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const result = await runMonthlyJob(d.getFullYear(), d.getMonth() + 1, [
      locationId,
    ]);
    monthlyResults.push(result);
  }

  const totalKeywords = monthlyResults.reduce(
    (sum, r) => sum + r.results.reduce((s, lr) => s + (lr.keywordCount ?? 0), 0),
    0
  );

  log.info(
    { locationId, metricDaysFilled: backfill.totalMetricDaysFilled, ratingDaysFilled: backfill.totalRatingDaysFilled, totalKeywords, months: monthlyResults.length },
    "Completed initial backfill"
  );

  return { locationId, backfill, monthlyResults };
}
