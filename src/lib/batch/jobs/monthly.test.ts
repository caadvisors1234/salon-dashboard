import { describe, it, expect, vi, beforeEach } from "vitest";

// daily.ts のモック（getTargetLocations）
const mockGetTargetLocations = vi.fn();
vi.mock("./daily", () => ({
  getTargetLocations: () => mockGetTargetLocations(),
}));

// GBP キーワードモジュールのモック
const mockFetchMonthlyKeywords = vi.fn();
const mockSaveMonthlyKeywords = vi.fn();
vi.mock("@/lib/gbp/keywords", () => ({
  fetchMonthlyKeywords: (...args: unknown[]) =>
    mockFetchMonthlyKeywords(...args),
  saveMonthlyKeywords: (...args: unknown[]) =>
    mockSaveMonthlyKeywords(...args),
}));

// GBP クライアントモック
vi.mock("@/lib/gbp/client", () => ({
  createGbpClient: vi.fn(() => ({})),
}));

import { getPreviousMonth, runMonthlyJob } from "./monthly";

describe("getPreviousMonth", () => {
  it("通常月（3月→2月）", () => {
    const result = getPreviousMonth(new Date("2025-03-15"));
    expect(result).toEqual({ year: 2025, month: 2, yearMonth: "202502" });
  });

  it("年越し（1月→12月）", () => {
    const result = getPreviousMonth(new Date("2025-01-10"));
    expect(result).toEqual({ year: 2024, month: 12, yearMonth: "202412" });
  });

  it("引数なしでも動作する", () => {
    const result = getPreviousMonth();
    expect(result.year).toBeGreaterThan(2020);
    expect(result.month).toBeGreaterThanOrEqual(1);
    expect(result.month).toBeLessThanOrEqual(12);
    expect(result.yearMonth).toMatch(/^\d{6}$/);
  });
});

describe("runMonthlyJob", () => {
  beforeEach(() => {
    mockGetTargetLocations.mockReset();
    mockFetchMonthlyKeywords.mockReset();
    mockSaveMonthlyKeywords.mockReset();
  });

  it("対象0件の場合は何も処理しない", async () => {
    mockGetTargetLocations.mockResolvedValue([]);
    const result = await runMonthlyJob(2025, 1);
    expect(result.totalLocations).toBe(0);
    expect(result.results).toHaveLength(0);
    expect(mockFetchMonthlyKeywords).not.toHaveBeenCalled();
  });

  it("1件正常処理", async () => {
    mockGetTargetLocations.mockResolvedValue([
      { id: "loc-1", name: "Store A", gbpLocationId: "gbp-1" },
    ]);
    mockFetchMonthlyKeywords.mockResolvedValue([
      { keyword: "美容室", value: 100 },
    ]);
    mockSaveMonthlyKeywords.mockResolvedValue(1);

    const result = await runMonthlyJob(2025, 2);
    expect(result.totalLocations).toBe(1);
    expect(result.successCount).toBe(1);
    expect(result.failureCount).toBe(0);
    expect(result.results[0].success).toBe(true);
    expect(result.results[0].keywordCount).toBe(1);
  });

  it("複数件処理", async () => {
    mockGetTargetLocations.mockResolvedValue([
      { id: "loc-1", name: "Store A", gbpLocationId: "gbp-1" },
      { id: "loc-2", name: "Store B", gbpLocationId: "gbp-2" },
    ]);
    mockFetchMonthlyKeywords.mockResolvedValue([]);
    mockSaveMonthlyKeywords.mockResolvedValue(0);

    const result = await runMonthlyJob(2025, 2);
    expect(result.totalLocations).toBe(2);
    expect(result.successCount).toBe(2);
  });

  it("targetLocationIds でフィルタリングできる", async () => {
    mockGetTargetLocations.mockResolvedValue([
      { id: "loc-1", name: "Store A", gbpLocationId: "gbp-1" },
      { id: "loc-2", name: "Store B", gbpLocationId: "gbp-2" },
      { id: "loc-3", name: "Store C", gbpLocationId: "gbp-3" },
    ]);
    mockFetchMonthlyKeywords.mockResolvedValue([]);
    mockSaveMonthlyKeywords.mockResolvedValue(0);

    const result = await runMonthlyJob(2025, 2, ["loc-1", "loc-3"]);
    expect(result.totalLocations).toBe(2);
    expect(result.results.map((r) => r.locationId)).toEqual([
      "loc-1",
      "loc-3",
    ]);
  });

  it("API失敗→error記録", async () => {
    mockGetTargetLocations.mockResolvedValue([
      { id: "loc-1", name: "Store A", gbpLocationId: "gbp-1" },
    ]);
    mockFetchMonthlyKeywords.mockRejectedValue(new Error("API rate limit"));

    const result = await runMonthlyJob(2025, 2);
    expect(result.failureCount).toBe(1);
    expect(result.results[0].success).toBe(false);
    expect(result.results[0].error).toContain("API rate limit");
  });

  it("複数中1件失敗でも他は成功", async () => {
    mockGetTargetLocations.mockResolvedValue([
      { id: "loc-1", name: "Store A", gbpLocationId: "gbp-1" },
      { id: "loc-2", name: "Store B", gbpLocationId: "gbp-2" },
    ]);
    // gbpLocationId に基づいて動作を分ける（リトライ時も一貫して失敗させる）
    mockFetchMonthlyKeywords.mockImplementation(
      (_client: unknown, gbpLocationId: string) => {
        if (gbpLocationId === "gbp-1") {
          return Promise.resolve([{ keyword: "美容室", value: 100 }]);
        }
        return Promise.reject(new Error("timeout"));
      }
    );
    mockSaveMonthlyKeywords.mockResolvedValue(1);

    const result = await runMonthlyJob(2025, 2);
    expect(result.successCount).toBe(1);
    expect(result.failureCount).toBe(1);
    const successes = result.results.filter((r) => r.success);
    const failures = result.results.filter((r) => !r.success);
    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);
  });
});
