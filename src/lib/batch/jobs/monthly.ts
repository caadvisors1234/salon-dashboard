/**
 * 月次バッチジョブ
 * - Search Keywords API で前月の検索キーワードを取得
 */
import { createGbpClient } from "@/lib/gbp/client";
import { fetchMonthlyKeywords, saveMonthlyKeywords } from "@/lib/gbp/keywords";
import { getTargetLocations, type LocationTarget } from "./daily";

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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
 */
export async function runMonthlyJob(
  targetYear?: number,
  targetMonth?: number
): Promise<MonthlyJobResult> {
  const prev = getPreviousMonth();
  const year = targetYear ?? prev.year;
  const month = targetMonth ?? prev.month;
  const yearMonth = `${year}${String(month).padStart(2, "0")}`;

  console.log(`[MonthlyJob] Starting monthly batch for ${yearMonth}`);

  const locations = await getTargetLocations();
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

  console.log(`[MonthlyJob] Processing ${locations.length} locations`);

  const results: MonthlyLocationResult[] = [];
  for (const location of locations) {
    const result = await processLocation(location, year, month, yearMonth);
    results.push(result);

    if (result.success) {
      console.log(`[MonthlyJob] ✓ ${location.name} (${result.keywordCount} keywords)`);
    } else {
      console.error(`[MonthlyJob] ✗ ${location.name}: ${result.error}`);
    }
  }

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
