/**
 * 日次バッチジョブ
 * - Performance API v1 で前日の日次パフォーマンス指標（7指標）を取得
 * - Reviews API v4.9 で評価・レビュー数スナップショットを取得
 */
import pLimit from "p-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createGbpClient } from "@/lib/gbp/client";
import { fetchDailyMetrics, saveDailyMetrics } from "@/lib/gbp/performance";
import { fetchRatingSnapshot, saveRatingSnapshot } from "@/lib/gbp/reviews";
import { sleep } from "@/lib/utils";
import { shouldProcess, recordSuccess, recordFailure } from "@/lib/batch/circuit-breaker";
import { createLogger } from "@/lib/logger";

const log = createLogger("DailyJob");

const CONCURRENCY_LIMIT = 5;

const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000;

export interface LocationTarget {
  id: string;
  name: string;
  gbpLocationId: string;
}

export interface JobLocationResult {
  locationId: string;
  locationName: string;
  success: boolean;
  skipped?: boolean;
  metricsCount?: number;
  error?: string;
}

export interface DailyJobResult {
  targetDate: string;
  totalLocations: number;
  successCount: number;
  failureCount: number;
  skippedCount: number;
  skippedLocations: { id: string; name: string }[];
  results: JobLocationResult[];
}

/**
 * 対象店舗を取得する（gbp_location_id 設定済み + is_active）
 */
export async function getTargetLocations(): Promise<LocationTarget[]> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("locations")
    .select("id, name, gbp_location_id")
    .eq("is_active", true)
    .not("gbp_location_id", "is", null);

  if (error) {
    throw new Error(`Failed to fetch target locations: ${error.message}`);
  }

  return (data || []).map((loc) => ({
    id: loc.id,
    name: loc.name,
    gbpLocationId: loc.gbp_location_id!,
  }));
}

/**
 * GBP アカウント ID を取得する（Reviews API 用）
 */
export async function getGbpAccountId(): Promise<string | null> {
  const supabase = createAdminClient();

  const { data } = await supabase
    .from("gbp_accounts")
    .select("gbp_account_id")
    .limit(1)
    .single();

  return data?.gbp_account_id ?? null;
}

/**
 * 1店舗の日次データを取得する（リトライ付き）
 */
async function processLocation(
  location: LocationTarget,
  targetDate: string,
  gbpAccountId: string | null
): Promise<JobLocationResult> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const client = createGbpClient();

      // 日次パフォーマンス指標
      const metrics = await fetchDailyMetrics(
        client,
        location.gbpLocationId,
        targetDate,
        targetDate
      );
      const savedCount = await saveDailyMetrics(location.id, metrics);

      // 評価・レビュー数スナップショット
      if (gbpAccountId) {
        const rating = await fetchRatingSnapshot(
          client,
          gbpAccountId,
          location.gbpLocationId
        );
        await saveRatingSnapshot(location.id, targetDate, rating);
      }

      return {
        locationId: location.id,
        locationName: location.name,
        success: true,
        metricsCount: savedCount,
      };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      if (attempt < MAX_RETRIES - 1) {
        const backoffMs = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
        log.warn(
          { attempt: attempt + 1, maxRetries: MAX_RETRIES, location: location.name, error: lastError.message, backoffMs },
          "Retry after error"
        );
        await sleep(backoffMs);
      }
    }
  }

  return {
    locationId: location.id,
    locationName: location.name,
    success: false,
    error: lastError?.message || "Unknown error",
  };
}

/**
 * 日次バッチジョブを実行する
 * @param targetDate 取得対象日（YYYY-MM-DD）。省略時は前日
 */
export async function runDailyJob(targetDate?: string): Promise<DailyJobResult> {
  const date = targetDate || getYesterday();
  log.info({ date }, "Starting daily batch");

  const locations = await getTargetLocations();
  if (locations.length === 0) {
    log.info("No target locations found");
    return {
      targetDate: date,
      totalLocations: 0,
      successCount: 0,
      failureCount: 0,
      skippedCount: 0,
      skippedLocations: [],
      results: [],
    };
  }

  const gbpAccountId = await getGbpAccountId();
  if (!gbpAccountId) {
    log.warn("No GBP account found. Rating snapshots will be skipped.");
  }

  log.info({ locationCount: locations.length, concurrency: CONCURRENCY_LIMIT }, "Processing locations");

  const limit = pLimit(CONCURRENCY_LIMIT);

  const settled = await Promise.allSettled(
    locations.map((location) =>
      limit(async () => {
        // サーキットブレーカー: 連続失敗が閾値を超えた店舗はスキップ
        const canProcess = await shouldProcess(location.id);
        if (!canProcess) {
          log.warn({ location: location.name }, "Skipped by circuit breaker");
          return {
            locationId: location.id,
            locationName: location.name,
            success: false,
            skipped: true,
            error: "Circuit breaker: skipped due to consecutive failures",
          } satisfies JobLocationResult;
        }

        const result = await processLocation(location, date, gbpAccountId);

        // サーキットブレーカー: 成功/失敗を記録
        if (result.success) {
          await recordSuccess(location.id);
          log.info({ location: location.name, metricsCount: result.metricsCount }, "Location processed successfully");
        } else {
          await recordFailure(location.id, result.error || "Unknown error");
          log.error({ location: location.name, error: result.error }, "Location processing failed");
        }
        return result;
      })
    )
  );

  const results: JobLocationResult[] = settled.map((r, i) =>
    r.status === "fulfilled"
      ? r.value
      : {
          locationId: locations[i].id,
          locationName: locations[i].name,
          success: false,
          error: r.reason?.message ?? String(r.reason),
        }
  );

  const successCount = results.filter((r) => r.success).length;
  const skippedCount = results.filter((r) => r.skipped).length;
  const failureCount = results.filter((r) => !r.success && !r.skipped).length;

  log.info(
    { successCount, failureCount, skippedCount, totalLocations: locations.length },
    "Completed"
  );

  const skippedLocations = results
    .filter((r) => r.skipped)
    .map((r) => ({ id: r.locationId, name: r.locationName }));

  if (skippedLocations.length > 0) {
    log.warn(
      { skippedLocations: skippedLocations.map((l) => l.name) },
      "Skipped locations"
    );
  }

  return {
    targetDate: date,
    totalLocations: locations.length,
    successCount,
    failureCount,
    skippedCount,
    skippedLocations,
    results,
  };
}

function getYesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split("T")[0];
}
