import { describe, it, expect } from "vitest";
import {
  getPreviousMonth,
  monthStart,
  monthEnd,
  formatYearMonthLabel,
  normalizeYearMonth,
  buildTrend,
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
