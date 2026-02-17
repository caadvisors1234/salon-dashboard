import { createAdminClient } from "@/lib/supabase/admin";
import type { GbpApiClient } from "./client";
import {
  GBP_API,
  DAILY_METRIC_TYPES,
  type GoogleDate,
  type DailyMetricResult,
  type FetchMultiDailyMetricsResponse,
} from "./types";

/**
 * 日付文字列 (YYYY-MM-DD) を GoogleDate に変換する
 */
function toGoogleDate(dateStr: string): GoogleDate {
  const [year, month, day] = dateStr.split("-").map(Number);
  return { year, month, day };
}

/**
 * GoogleDate を日付文字列 (YYYY-MM-DD) に変換する
 */
function fromGoogleDate(date: GoogleDate): string {
  return `${date.year}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`;
}

/**
 * Performance API v1 で日次パフォーマンス指標を取得する
 */
export async function fetchDailyMetrics(
  client: GbpApiClient,
  gbpLocationId: string,
  startDate: string,
  endDate: string
): Promise<DailyMetricResult[]> {
  const start = toGoogleDate(startDate);
  const end = toGoogleDate(endDate);

  const params = new URLSearchParams();
  for (const metric of DAILY_METRIC_TYPES) {
    params.append("dailyMetrics", metric);
  }
  params.set("dailyRange.start_date.year", String(start.year));
  params.set("dailyRange.start_date.month", String(start.month));
  params.set("dailyRange.start_date.day", String(start.day));
  params.set("dailyRange.end_date.year", String(end.year));
  params.set("dailyRange.end_date.month", String(end.month));
  params.set("dailyRange.end_date.day", String(end.day));

  const url = `${GBP_API.PERFORMANCE_BASE}/locations/${gbpLocationId}:fetchMultiDailyMetricsTimeSeries?${params.toString()}`;

  const response = await client.get<FetchMultiDailyMetricsResponse>(url);

  const results: DailyMetricResult[] = [];

  if (!response.multiDailyMetricTimeSeries) {
    return results;
  }

  for (const item of response.multiDailyMetricTimeSeries) {
    const seriesList = item.dailyMetricTimeSeries;
    if (!Array.isArray(seriesList)) continue;

    for (const series of seriesList) {
      if (!series?.timeSeries?.datedValues) continue;

      for (const dv of series.timeSeries.datedValues) {
        if (dv.value !== undefined) {
          results.push({
            date: fromGoogleDate(dv.date),
            metricType: series.dailyMetric,
            value: parseInt(dv.value, 10) || 0,
          });
        }
      }
    }
  }

  return results;
}

/**
 * 日次パフォーマンス指標を daily_metrics テーブルに UPSERT する
 */
export async function saveDailyMetrics(
  locationUuid: string,
  results: DailyMetricResult[]
): Promise<number> {
  if (results.length === 0) return 0;

  const supabase = createAdminClient();

  const rows = results.map((r) => ({
    location_id: locationUuid,
    date: r.date,
    metric_type: r.metricType,
    value: r.value,
  }));

  const { error, count } = await supabase
    .from("daily_metrics")
    .upsert(rows, {
      onConflict: "location_id,date,metric_type",
      count: "exact",
    });

  if (error) {
    throw new Error(`Failed to save daily metrics: ${error.message}`);
  }

  return count || rows.length;
}
