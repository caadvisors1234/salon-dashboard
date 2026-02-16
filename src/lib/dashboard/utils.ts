import type { TrendData } from "@/types/dashboard";

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
