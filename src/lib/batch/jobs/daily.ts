/**
 * 日次バッチジョブ
 * - Performance API v1 で前日の日次パフォーマンス指標（7指標）を取得
 * - Reviews API v4.9 で評価・レビュー数スナップショットを取得
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { createGbpClient } from "@/lib/gbp/client";
import { fetchDailyMetrics, saveDailyMetrics } from "@/lib/gbp/performance";
import { fetchRatingSnapshot, saveRatingSnapshot } from "@/lib/gbp/reviews";

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
  metricsCount?: number;
  error?: string;
}

export interface DailyJobResult {
  targetDate: string;
  totalLocations: number;
  successCount: number;
  failureCount: number;
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
        console.warn(
          `[DailyJob] Retry ${attempt + 1}/${MAX_RETRIES} for ${location.name}: ${lastError.message}. Waiting ${backoffMs}ms`
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
  console.log(`[DailyJob] Starting daily batch for ${date}`);

  const locations = await getTargetLocations();
  if (locations.length === 0) {
    console.log("[DailyJob] No target locations found");
    return {
      targetDate: date,
      totalLocations: 0,
      successCount: 0,
      failureCount: 0,
      results: [],
    };
  }

  const gbpAccountId = await getGbpAccountId();
  if (!gbpAccountId) {
    console.warn("[DailyJob] No GBP account found. Rating snapshots will be skipped.");
  }

  console.log(`[DailyJob] Processing ${locations.length} locations`);

  const results: JobLocationResult[] = [];
  for (const location of locations) {
    const result = await processLocation(location, date, gbpAccountId);
    results.push(result);

    if (result.success) {
      console.log(`[DailyJob] ✓ ${location.name} (${result.metricsCount} metrics)`);
    } else {
      console.error(`[DailyJob] ✗ ${location.name}: ${result.error}`);
    }
  }

  const successCount = results.filter((r) => r.success).length;
  const failureCount = results.filter((r) => !r.success).length;

  console.log(
    `[DailyJob] Completed: ${successCount} success, ${failureCount} failure out of ${locations.length}`
  );

  return {
    targetDate: date,
    totalLocations: locations.length,
    successCount,
    failureCount,
    results,
  };
}

function getYesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split("T")[0];
}
