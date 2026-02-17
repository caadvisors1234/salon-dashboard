import type { TrendData, MonthlyMetricPoint } from "@/types/dashboard";

// --- 定数 ---

export const IMPRESSION_TYPES = [
  "BUSINESS_IMPRESSIONS_DESKTOP_SEARCH",
  "BUSINESS_IMPRESSIONS_MOBILE_SEARCH",
  "BUSINESS_IMPRESSIONS_DESKTOP_MAPS",
  "BUSINESS_IMPRESSIONS_MOBILE_MAPS",
] as const;

export const ACTION_TYPES = [
  "CALL_CLICKS",
  "BUSINESS_DIRECTION_REQUESTS",
  "WEBSITE_CLICKS",
] as const;

// --- 日付ヘルパー ---

/** YYYY-MM 形式で前月を返す */
export function getPreviousMonth(yearMonth: string): string {
  const [y, m] = yearMonth.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** 月の初日を YYYY-MM-DD で返す */
export function monthStart(yearMonth: string): string {
  return `${yearMonth}-01`;
}

/** 月の末日を YYYY-MM-DD で返す */
export function monthEnd(yearMonth: string): string {
  const [y, m] = yearMonth.split("-").map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  return `${yearMonth}-${String(lastDay).padStart(2, "0")}`;
}

/** YYYY-MM を表示用ラベルに変換 */
export function formatYearMonthLabel(yearMonth: string): string {
  const [y, m] = yearMonth.split("-").map(Number);
  return `${y}年${m}月`;
}

/** YYYYMM → YYYY-MM */
export function normalizeYearMonth(ym: string): string {
  if (ym.includes("-")) return ym;
  return `${ym.slice(0, 4)}-${ym.slice(4, 6)}`;
}

/** startMonth 〜 endMonth の全月を YYYY-MM 配列で返す */
export function generateMonthRange(startMonth: string, endMonth: string): string[] {
  const months: string[] = [];
  const [sy, sm] = startMonth.split("-").map(Number);
  const [ey, em] = endMonth.split("-").map(Number);
  let y = sy, m = sm;
  while (y < ey || (y === ey && m <= em)) {
    months.push(`${y}-${String(m).padStart(2, "0")}`);
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return months;
}

// --- RPC結果ピボット ---

type AggregatedRow = {
  year_month: string;
  metric_type: string;
  total_value: number;
};

const METRIC_FIELD_MAP: Record<string, keyof MonthlyMetricPoint> = {
  BUSINESS_IMPRESSIONS_DESKTOP_SEARCH: "impressionsDesktopSearch",
  BUSINESS_IMPRESSIONS_MOBILE_SEARCH: "impressionsMobileSearch",
  BUSINESS_IMPRESSIONS_DESKTOP_MAPS: "impressionsDesktopMaps",
  BUSINESS_IMPRESSIONS_MOBILE_MAPS: "impressionsMobileMaps",
  CALL_CLICKS: "callClicks",
  BUSINESS_DIRECTION_REQUESTS: "directionRequests",
  WEBSITE_CLICKS: "websiteClicks",
};

/** RPC `get_monthly_metrics` の結果を MonthlyMetricPoint[] にピボットする */
export function pivotMonthlyMetrics(
  rows: AggregatedRow[],
  allMonths: string[]
): MonthlyMetricPoint[] {
  const monthMap = new Map<string, MonthlyMetricPoint>();
  for (const ym of allMonths) {
    monthMap.set(ym, {
      yearMonth: ym,
      label: formatYearMonthLabel(ym),
      impressionsDesktopSearch: 0,
      impressionsMobileSearch: 0,
      impressionsDesktopMaps: 0,
      impressionsMobileMaps: 0,
      callClicks: 0,
      directionRequests: 0,
      websiteClicks: 0,
    });
  }

  for (const row of rows) {
    const point = monthMap.get(row.year_month);
    if (!point) continue;
    const field = METRIC_FIELD_MAP[row.metric_type];
    if (field) {
      (point[field] as number) = row.total_value;
    }
  }

  return allMonths.map((ym) => monthMap.get(ym)!);
}

// --- トレンド計算 ---

export function buildTrend(
  current: number | null,
  previous: number | null,
  format: "integer" | "decimal1" | "percent1" = "integer"
): TrendData {
  if (current === null) {
    return { direction: "unavailable", diff: null, label: "データなし" };
  }
  if (previous === null) {
    return { direction: "new", diff: null, label: "NEW" };
  }
  const diff = current - previous;
  if (diff === 0) {
    return { direction: "flat", diff: 0, label: "±0" };
  }
  const sign = diff > 0 ? "+" : "";
  let label: string;
  switch (format) {
    case "percent1":
      label = `${sign}${diff.toFixed(1)}%`;
      break;
    case "decimal1":
      label = `${sign}${diff.toFixed(1)}`;
      break;
    default:
      label = `${sign}${Math.round(diff).toLocaleString("ja-JP")}`;
  }
  return {
    direction: diff > 0 ? "up" : "down",
    diff,
    label,
  };
}
