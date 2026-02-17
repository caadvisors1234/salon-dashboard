import { describe, it, expect } from "vitest";
import {
  getPreviousMonth,
  monthStart,
  monthEnd,
  formatYearMonthLabel,
  normalizeYearMonth,
  generateMonthRange,
  buildTrend,
  pivotMonthlyMetrics,
  IMPRESSION_TYPES,
  ACTION_TYPES,
} from "./utils";

describe("IMPRESSION_TYPES / ACTION_TYPES", () => {
  it("IMPRESSION_TYPES は4要素", () => {
    expect(IMPRESSION_TYPES).toHaveLength(4);
  });

  it("ACTION_TYPES は3要素", () => {
    expect(ACTION_TYPES).toHaveLength(3);
  });
});

describe("getPreviousMonth", () => {
  it("通常月", () => {
    expect(getPreviousMonth("2025-03")).toBe("2025-02");
  });

  it("1月 → 前年12月", () => {
    expect(getPreviousMonth("2025-01")).toBe("2024-12");
  });

  it("年境界 2024-01 → 2023-12", () => {
    expect(getPreviousMonth("2024-01")).toBe("2023-12");
  });

  it("12月 → 11月", () => {
    expect(getPreviousMonth("2025-12")).toBe("2025-11");
  });
});

describe("monthStart", () => {
  it("月初日を返す", () => {
    expect(monthStart("2025-03")).toBe("2025-03-01");
  });
});

describe("monthEnd", () => {
  it("31日の月", () => {
    expect(monthEnd("2025-01")).toBe("2025-01-31");
  });

  it("30日の月", () => {
    expect(monthEnd("2025-04")).toBe("2025-04-30");
  });

  it("2月（平年）", () => {
    expect(monthEnd("2025-02")).toBe("2025-02-28");
  });

  it("2月（うるう年）", () => {
    expect(monthEnd("2024-02")).toBe("2024-02-29");
  });

  it("12月", () => {
    expect(monthEnd("2025-12")).toBe("2025-12-31");
  });
});

describe("formatYearMonthLabel", () => {
  it("YYYY-MM → YYYY年M月", () => {
    expect(formatYearMonthLabel("2025-03")).toBe("2025年3月");
  });

  it("1月", () => {
    expect(formatYearMonthLabel("2025-01")).toBe("2025年1月");
  });

  it("12月", () => {
    expect(formatYearMonthLabel("2025-12")).toBe("2025年12月");
  });
});

describe("normalizeYearMonth", () => {
  it("YYYYMM → YYYY-MM", () => {
    expect(normalizeYearMonth("202503")).toBe("2025-03");
  });

  it("既にハイフン付きはそのまま", () => {
    expect(normalizeYearMonth("2025-03")).toBe("2025-03");
  });
});

describe("generateMonthRange", () => {
  it("同一月 → 1要素", () => {
    expect(generateMonthRange("2025-03", "2025-03")).toEqual(["2025-03"]);
  });

  it("3ヶ月範囲", () => {
    expect(generateMonthRange("2025-01", "2025-03")).toEqual([
      "2025-01", "2025-02", "2025-03",
    ]);
  });

  it("年をまたぐ範囲", () => {
    expect(generateMonthRange("2024-11", "2025-02")).toEqual([
      "2024-11", "2024-12", "2025-01", "2025-02",
    ]);
  });

  it("12ヶ月範囲", () => {
    const result = generateMonthRange("2025-03", "2026-02");
    expect(result).toHaveLength(12);
    expect(result[0]).toBe("2025-03");
    expect(result[11]).toBe("2026-02");
  });
});

describe("buildTrend", () => {
  it("current が null → unavailable", () => {
    const result = buildTrend(null, 100);
    expect(result.direction).toBe("unavailable");
    expect(result.diff).toBeNull();
    expect(result.label).toBe("データなし");
  });

  it("previous が null → new", () => {
    const result = buildTrend(100, null);
    expect(result.direction).toBe("new");
    expect(result.diff).toBeNull();
    expect(result.label).toBe("NEW");
  });

  it("差分0 → flat", () => {
    const result = buildTrend(100, 100);
    expect(result.direction).toBe("flat");
    expect(result.diff).toBe(0);
    expect(result.label).toBe("±0");
  });

  it("増加（integer）", () => {
    const result = buildTrend(150, 100);
    expect(result.direction).toBe("up");
    expect(result.diff).toBe(50);
    expect(result.label).toBe("+50");
  });

  it("減少（integer）", () => {
    const result = buildTrend(80, 100);
    expect(result.direction).toBe("down");
    expect(result.diff).toBe(-20);
    expect(result.label).toBe("-20");
  });

  it("大きな数値はカンマ付き（integer）", () => {
    const result = buildTrend(11000, 10000);
    expect(result.label).toBe("+1,000");
  });

  it("percent1 フォーマット（増加）", () => {
    const result = buildTrend(55.5, 50.0, "percent1");
    expect(result.direction).toBe("up");
    expect(result.label).toBe("+5.5%");
  });

  it("percent1 フォーマット（減少）", () => {
    const result = buildTrend(48.3, 50.0, "percent1");
    expect(result.direction).toBe("down");
    expect(result.label).toBe("-1.7%");
  });

  it("decimal1 フォーマット", () => {
    const result = buildTrend(4.5, 3.2, "decimal1");
    expect(result.direction).toBe("up");
    expect(result.label).toBe("+1.3");
  });

  it("both null", () => {
    const result = buildTrend(null, null);
    expect(result.direction).toBe("unavailable");
  });
});

describe("pivotMonthlyMetrics", () => {
  it("データなし月は0埋めされる", () => {
    const result = pivotMonthlyMetrics([], ["2025-03", "2025-04", "2025-05"]);
    expect(result).toHaveLength(3);
    for (const point of result) {
      expect(point.impressionsDesktopSearch).toBe(0);
      expect(point.impressionsMobileSearch).toBe(0);
      expect(point.impressionsDesktopMaps).toBe(0);
      expect(point.impressionsMobileMaps).toBe(0);
      expect(point.callClicks).toBe(0);
      expect(point.directionRequests).toBe(0);
      expect(point.websiteClicks).toBe(0);
    }
    expect(result[0].yearMonth).toBe("2025-03");
    expect(result[0].label).toBe("2025年3月");
  });

  it("集計行が正しいフィールドにマッピングされる", () => {
    const rows = [
      { year_month: "2025-03", metric_type: "BUSINESS_IMPRESSIONS_DESKTOP_SEARCH", total_value: 100 },
      { year_month: "2025-03", metric_type: "CALL_CLICKS", total_value: 25 },
      { year_month: "2025-04", metric_type: "WEBSITE_CLICKS", total_value: 50 },
      { year_month: "2025-04", metric_type: "BUSINESS_DIRECTION_REQUESTS", total_value: 30 },
      { year_month: "2025-04", metric_type: "BUSINESS_IMPRESSIONS_MOBILE_MAPS", total_value: 200 },
    ];
    const result = pivotMonthlyMetrics(rows, ["2025-03", "2025-04"]);
    expect(result).toHaveLength(2);

    expect(result[0].impressionsDesktopSearch).toBe(100);
    expect(result[0].callClicks).toBe(25);
    expect(result[0].websiteClicks).toBe(0);

    expect(result[1].websiteClicks).toBe(50);
    expect(result[1].directionRequests).toBe(30);
    expect(result[1].impressionsMobileMaps).toBe(200);
    expect(result[1].impressionsDesktopSearch).toBe(0);
  });

  it("範囲外の月データは無視される", () => {
    const rows = [
      { year_month: "2025-02", metric_type: "CALL_CLICKS", total_value: 999 },
      { year_month: "2025-03", metric_type: "CALL_CLICKS", total_value: 10 },
      { year_month: "2025-06", metric_type: "CALL_CLICKS", total_value: 888 },
    ];
    const result = pivotMonthlyMetrics(rows, ["2025-03", "2025-04", "2025-05"]);
    expect(result).toHaveLength(3);
    expect(result[0].callClicks).toBe(10);
    expect(result[1].callClicks).toBe(0);
    expect(result[2].callClicks).toBe(0);
  });
});
