/**
 * 月次バッチジョブ
 * - Search Keywords API で前月の検索キーワードを取得
 */
import pLimit from "p-limit";
import { createGbpClient } from "@/lib/gbp/client";
import { fetchMonthlyKeywords, saveMonthlyKeywords } from "@/lib/gbp/keywords";
import { getTargetLocations, type LocationTarget } from "./daily";
import { sleep } from "@/lib/utils";

const CONCURRENCY_LIMIT = 5;

const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000;

export interface MonthlyLocationResult {
  locationId: string;
  locationName: string;
  success: boolean;
  keywordCount?: number;
  error?: string;
}

export interface MonthlyJobResult {
  targetYearMonth: string;
  totalLocations: number;
  successCount: number;
  failureCount: number;
  results: MonthlyLocationResult[];
}

/**
 * 1店舗の月次キーワードを取得する（リトライ付き）
 */
async function processLocation(
  location: LocationTarget,
  year: number,
  month: number,
  yearMonth: string
): Promise<MonthlyLocationResult> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const client = createGbpClient();

      const keywords = await fetchMonthlyKeywords(
        client,
        location.gbpLocationId,
        year,
        month
      );
      const savedCount = await saveMonthlyKeywords(
        location.id,
        yearMonth,
        keywords
      );

      return {
        locationId: location.id,
        locationName: location.name,
        success: true,
        keywordCount: savedCount,
      };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      if (attempt < MAX_RETRIES - 1) {
        const backoffMs = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
        console.warn(
          `[MonthlyJob] Retry ${attempt + 1}/${MAX_RETRIES} for ${location.name}: ${lastError.message}. Waiting ${backoffMs}ms`
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
 * 前月の年月を算出する
 */
export function getPreviousMonth(now?: Date): { year: number; month: number; yearMonth: string } {
  const d = now || new Date();
  let year = d.getFullYear();
  let month = d.getMonth(); // 0-indexed = 前月

  if (month === 0) {
    year -= 1;
    month = 12;
  }

  const yearMonth = `${year}${String(month).padStart(2, "0")}`;
  return { year, month, yearMonth };
}

/**
 * 月次バッチジョブを実行する
 * @param targetYear 取得対象年。省略時は前月から算出
 * @param targetMonth 取得対象月。省略時は前月から算出
 * @param targetLocationIds 指定時は対象ロケーションをフィルタリング
 */
export async function runMonthlyJob(
  targetYear?: number,
  targetMonth?: number,
  targetLocationIds?: string[]
): Promise<MonthlyJobResult> {
  const prev = getPreviousMonth();
  const year = targetYear ?? prev.year;
  const month = targetMonth ?? prev.month;
  const yearMonth = `${year}${String(month).padStart(2, "0")}`;

  console.log(`[MonthlyJob] Starting monthly batch for ${yearMonth}`);

  let locations = await getTargetLocations();
  if (targetLocationIds && targetLocationIds.length > 0) {
    locations = locations.filter((l) => targetLocationIds.includes(l.id));
  }
  if (locations.length === 0) {
    console.log("[MonthlyJob] No target locations found");
    return {
      targetYearMonth: yearMonth,
      totalLocations: 0,
      successCount: 0,
      failureCount: 0,
      results: [],
    };
  }

  console.log(`[MonthlyJob] Processing ${locations.length} locations (concurrency: ${CONCURRENCY_LIMIT})`);

  const limit = pLimit(CONCURRENCY_LIMIT);
  const settled = await Promise.allSettled(
    locations.map((location) =>
      limit(async () => {
        const result = await processLocation(location, year, month, yearMonth);
        if (result.success) {
          console.log(`[MonthlyJob] ✓ ${location.name} (${result.keywordCount} keywords)`);
        } else {
          console.error(`[MonthlyJob] ✗ ${location.name}: ${result.error}`);
        }
        return result;
      })
    )
  );

  const results: MonthlyLocationResult[] = settled.map((r, i) =>
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
  const failureCount = results.filter((r) => !r.success).length;

  console.log(
    `[MonthlyJob] Completed: ${successCount} success, ${failureCount} failure out of ${locations.length}`
  );

  return {
    targetYearMonth: yearMonth,
    totalLocations: locations.length,
    successCount,
    failureCount,
    results,
  };
}
