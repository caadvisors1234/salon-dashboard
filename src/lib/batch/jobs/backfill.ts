/**
 * バックフィルジョブ（デフォルト30日、指定日数まで対応）
 * - 指定期間の欠損日を検出
 * - 欠損データを API から取得して補完（日付範囲一括取得で最適化）
 * - 指定日数超欠損はアラート発行
 */
import pLimit from "p-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createGbpClient } from "@/lib/gbp/client";
import { fetchDailyMetrics, saveDailyMetrics } from "@/lib/gbp/performance";
import { fetchRatingSnapshot, saveRatingSnapshot } from "@/lib/gbp/reviews";
import { DAILY_METRIC_TYPES } from "@/lib/gbp/types";
import {
  getTargetLocations,
  getGbpAccountId,
  type LocationTarget,
} from "./daily";

const CONCURRENCY_LIMIT = 5;

export interface BackfillLocationResult {
  locationId: string;
  locationName: string;
  missingMetricDays: number;
  missingRatingDays: number;
  filledMetricDays: number;
  filledRatingDays: number;
  errors: string[];
}

export interface OverdueLocation {
  locationId: string;
  locationName: string;
  lastMetricDate: string | null;
  lastRatingDate: string | null;
  metricGapDays: number;
  ratingGapDays: number;
}

export interface BackfillJobResult {
  backfillDays: number;
  totalLocations: number;
  totalMetricDaysFilled: number;
  totalRatingDaysFilled: number;
  overdueLocations: OverdueLocation[];
  results: BackfillLocationResult[];
}

/**
 * 連続する日付をグループ化する
 * 例: ["2025-08-01", "2025-08-02", "2025-08-03", "2025-08-10"] →
 *     [{ start: "2025-08-01", end: "2025-08-03" }, { start: "2025-08-10", end: "2025-08-10" }]
 */
export function groupConsecutiveDates(
  dates: string[]
): { start: string; end: string }[] {
  if (dates.length === 0) return [];

  const sorted = [...dates].sort();
  const groups: { start: string; end: string }[] = [];
  let start = sorted[0];
  let prev = sorted[0];

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const prevDate = new Date(prev + "T00:00:00");
    const currDate = new Date(current + "T00:00:00");
    const diffDays =
      (currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24);

    if (diffDays === 1) {
      prev = current;
    } else {
      groups.push({ start, end: prev });
      start = current;
      prev = current;
    }
  }
  groups.push({ start, end: prev });

  return groups;
}

/**
 * 指定期間の日付リストを生成する（YYYY-MM-DD）
 */
function generateDateRange(startDate: Date, endDate: Date): string[] {
  const dates: string[] = [];
  const current = new Date(startDate);
  while (current <= endDate) {
    dates.push(current.toISOString().split("T")[0]);
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

/**
 * 店舗の daily_metrics の欠損日を検出する
 */
async function findMissingMetricDates(
  locationId: string,
  expectedDates: string[]
): Promise<string[]> {
  const supabase = createAdminClient();
  const metricTypeCount = DAILY_METRIC_TYPES.length;

  // 各日付のレコード数を集計
  const { data, error } = await supabase
    .from("daily_metrics")
    .select("date")
    .eq("location_id", locationId)
    .in("date", expectedDates);

  if (error) {
    throw new Error(`Failed to query daily_metrics: ${error.message}`);
  }

  // 日付ごとのレコード数をカウント
  const dateCounts = new Map<string, number>();
  for (const row of data || []) {
    dateCounts.set(row.date, (dateCounts.get(row.date) || 0) + 1);
  }

  // 7指標すべてが揃っていない日を欠損とみなす
  return expectedDates.filter(
    (date) => (dateCounts.get(date) || 0) < metricTypeCount
  );
}

/**
 * 店舗の rating_snapshots の欠損日を検出する
 */
async function findMissingRatingDates(
  locationId: string,
  expectedDates: string[]
): Promise<string[]> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("rating_snapshots")
    .select("date")
    .eq("location_id", locationId)
    .in("date", expectedDates);

  if (error) {
    throw new Error(`Failed to query rating_snapshots: ${error.message}`);
  }

  const existingDates = new Set((data || []).map((r) => r.date));
  return expectedDates.filter((date) => !existingDates.has(date));
}

/**
 * 店舗の最終取得日を取得する（30日超欠損の検出用）
 */
async function getLastDataDates(
  locationId: string
): Promise<{ lastMetricDate: string | null; lastRatingDate: string | null }> {
  const supabase = createAdminClient();

  const [metricResult, ratingResult] = await Promise.all([
    supabase
      .from("daily_metrics")
      .select("date")
      .eq("location_id", locationId)
      .order("date", { ascending: false })
      .limit(1)
      .single(),
    supabase
      .from("rating_snapshots")
      .select("date")
      .eq("location_id", locationId)
      .order("date", { ascending: false })
      .limit(1)
      .single(),
  ]);

  return {
    lastMetricDate: metricResult.data?.date ?? null,
    lastRatingDate: ratingResult.data?.date ?? null,
  };
}

/**
 * 1店舗のバックフィルを実行する
 */
async function processLocation(
  location: LocationTarget,
  expectedDates: string[],
  gbpAccountId: string | null,
  backfillDays: number
): Promise<{ result: BackfillLocationResult; overdue: OverdueLocation | null }> {
  const errors: string[] = [];
  let filledMetricDays = 0;
  let filledRatingDays = 0;

  // 欠損日を検出
  const missingMetricDates = await findMissingMetricDates(location.id, expectedDates);
  const missingRatingDates = await findMissingRatingDates(location.id, expectedDates);

  // 30日超欠損チェック
  let overdue: OverdueLocation | null = null;
  const { lastMetricDate, lastRatingDate } = await getLastDataDates(location.id);
  const today = new Date();

  const metricGapDays = lastMetricDate
    ? Math.floor((today.getTime() - new Date(lastMetricDate).getTime()) / (1000 * 60 * 60 * 24))
    : Infinity;
  const ratingGapDays = lastRatingDate
    ? Math.floor((today.getTime() - new Date(lastRatingDate).getTime()) / (1000 * 60 * 60 * 24))
    : Infinity;

  if (metricGapDays > backfillDays || ratingGapDays > backfillDays) {
    overdue = {
      locationId: location.id,
      locationName: location.name,
      lastMetricDate,
      lastRatingDate,
      metricGapDays: metricGapDays === Infinity ? -1 : metricGapDays,
      ratingGapDays: ratingGapDays === Infinity ? -1 : ratingGapDays,
    };
  }

  // daily_metrics のバックフィル（連続日付を範囲グループ化して一括取得）
  const metricRanges = groupConsecutiveDates(missingMetricDates);
  for (const range of metricRanges) {
    try {
      const client = createGbpClient();
      const metrics = await fetchDailyMetrics(
        client,
        location.gbpLocationId,
        range.start,
        range.end
      );
      await saveDailyMetrics(location.id, metrics);
      // API が返した実際のユニーク日付数をカウント
      const uniqueDates = new Set(metrics.map((m) => m.date));
      filledMetricDays += uniqueDates.size;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`metrics ${range.start}~${range.end}: ${msg}`);
    }
  }

  // rating_snapshots のバックフィル（1回だけAPI呼び出し、全欠損日に同じ値を保存）
  if (gbpAccountId && missingRatingDates.length > 0) {
    try {
      const client = createGbpClient();
      const rating = await fetchRatingSnapshot(
        client,
        gbpAccountId,
        location.gbpLocationId
      );
      for (const date of missingRatingDates) {
        try {
          await saveRatingSnapshot(location.id, date, rating);
          filledRatingDays++;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          errors.push(`rating ${date}: ${msg}`);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`rating fetch: ${msg}`);
    }
  }

  return {
    result: {
      locationId: location.id,
      locationName: location.name,
      missingMetricDays: missingMetricDates.length,
      missingRatingDays: missingRatingDates.length,
      filledMetricDays,
      filledRatingDays,
      errors,
    },
    overdue,
  };
}

/**
 * バックフィルジョブを実行する
 * @param backfillDaysOverride バックフィル対象日数（デフォルト: 30）
 * @param targetLocationIds 指定時は対象ロケーションをフィルタリング
 */
export async function runBackfillJob(
  backfillDaysOverride?: number,
  targetLocationIds?: string[]
): Promise<BackfillJobResult> {
  const backfillDays = backfillDaysOverride ?? 30;

  console.log(`[BackfillJob] Starting backfill for last ${backfillDays} days`);

  let locations = await getTargetLocations();
  if (targetLocationIds && targetLocationIds.length > 0) {
    locations = locations.filter((l) => targetLocationIds.includes(l.id));
  }
  if (locations.length === 0) {
    console.log("[BackfillJob] No target locations found");
    return {
      backfillDays,
      totalLocations: 0,
      totalMetricDaysFilled: 0,
      totalRatingDaysFilled: 0,
      overdueLocations: [],
      results: [],
    };
  }

  const gbpAccountId = await getGbpAccountId();

  // 期待される日付範囲を算出（今日 - backfillDays 〜 昨日）
  const endDate = new Date();
  endDate.setDate(endDate.getDate() - 1); // 昨日
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - backfillDays);
  const expectedDates = generateDateRange(startDate, endDate);

  console.log(
    `[BackfillJob] Checking ${locations.length} locations for ${expectedDates.length} days (${expectedDates[0]} to ${expectedDates[expectedDates.length - 1]}) (concurrency: ${CONCURRENCY_LIMIT})`
  );

  let totalMetricDaysFilled = 0;
  let totalRatingDaysFilled = 0;

  const limit = pLimit(CONCURRENCY_LIMIT);
  const settled = await Promise.allSettled(
    locations.map((location) =>
      limit(async () => {
        console.log(`[BackfillJob] Checking ${location.name}...`);
        const { result, overdue } = await processLocation(
          location,
          expectedDates,
          gbpAccountId,
          backfillDays
        );

        if (overdue) {
          console.warn(
            `[BackfillJob] ⚠ ${location.name}: ${backfillDays}日超の欠損あり (metrics: ${overdue.lastMetricDate || "データなし"}, rating: ${overdue.lastRatingDate || "データなし"})`
          );
        }

        if (result.filledMetricDays > 0 || result.filledRatingDays > 0) {
          console.log(
            `[BackfillJob] ✓ ${location.name}: metrics=${result.filledMetricDays}/${result.missingMetricDays}, rating=${result.filledRatingDays}/${result.missingRatingDays}`
          );
        }

        if (result.errors.length > 0) {
          console.warn(
            `[BackfillJob] ⚠ ${location.name}: ${result.errors.length} errors`
          );
        }

        return { result, overdue };
      })
    )
  );

  // 並列処理完了後にまとめて集計（共有配列への並行pushを回避）
  const results: BackfillLocationResult[] = [];
  const overdueLocations: OverdueLocation[] = [];

  for (let i = 0; i < settled.length; i++) {
    const s = settled[i];
    if (s.status === "fulfilled") {
      results.push(s.value.result);
      if (s.value.overdue) {
        overdueLocations.push(s.value.overdue);
      }
    } else {
      results.push({
        locationId: locations[i].id,
        locationName: locations[i].name,
        missingMetricDays: 0,
        missingRatingDays: 0,
        filledMetricDays: 0,
        filledRatingDays: 0,
        errors: [s.reason?.message ?? String(s.reason)],
      });
    }
  }

  for (const result of results) {
    totalMetricDaysFilled += result.filledMetricDays;
    totalRatingDaysFilled += result.filledRatingDays;
  }

  console.log(
    `[BackfillJob] Completed: ${totalMetricDaysFilled} metric days + ${totalRatingDaysFilled} rating days filled. ${overdueLocations.length} overdue locations.`
  );

  return {
    backfillDays,
    totalLocations: locations.length,
    totalMetricDaysFilled,
    totalRatingDaysFilled,
    overdueLocations,
    results,
  };
}
