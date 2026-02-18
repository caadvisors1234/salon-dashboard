import { describe, it, expect, vi, beforeEach } from "vitest";

// daily.ts のモック
const mockGetTargetLocations = vi.fn();
const mockGetGbpAccountId = vi.fn();
vi.mock("./daily", () => ({
  getTargetLocations: () => mockGetTargetLocations(),
  getGbpAccountId: () => mockGetGbpAccountId(),
}));

// GBP パフォーマンスモジュールのモック
const mockFetchDailyMetrics = vi.fn();
const mockSaveDailyMetrics = vi.fn();
vi.mock("@/lib/gbp/performance", () => ({
  fetchDailyMetrics: (...args: unknown[]) => mockFetchDailyMetrics(...args),
  saveDailyMetrics: (...args: unknown[]) => mockSaveDailyMetrics(...args),
}));

// GBP レビューモジュールのモック
const mockFetchRatingSnapshot = vi.fn();
const mockSaveRatingSnapshot = vi.fn();
vi.mock("@/lib/gbp/reviews", () => ({
  fetchRatingSnapshot: (...args: unknown[]) =>
    mockFetchRatingSnapshot(...args),
  saveRatingSnapshot: (...args: unknown[]) => mockSaveRatingSnapshot(...args),
}));

// GBP クライアントモック
vi.mock("@/lib/gbp/client", () => ({
  createGbpClient: vi.fn(() => ({})),
}));

// Supabase admin モック
const mockFrom = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    from: (...args: unknown[]) => mockFrom(...args),
  })),
}));

import { groupConsecutiveDates, runBackfillJob } from "./backfill";

// from() チェーンヘルパー
function createChain(result: { data: unknown; error?: unknown }) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  const methods = ["select", "eq", "in", "gte", "lte", "order", "limit", "single"];
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  chain.single = vi.fn().mockResolvedValue(result);
  chain.then = vi
    .fn()
    .mockImplementation((resolve: (v: unknown) => void) => resolve(result));
  return chain;
}

describe("groupConsecutiveDates", () => {
  it("空配列", () => {
    expect(groupConsecutiveDates([])).toEqual([]);
  });

  it("1日", () => {
    expect(groupConsecutiveDates(["2025-01-15"])).toEqual([
      { start: "2025-01-15", end: "2025-01-15" },
    ]);
  });

  it("連続3日", () => {
    const result = groupConsecutiveDates([
      "2025-01-01",
      "2025-01-02",
      "2025-01-03",
    ]);
    expect(result).toEqual([{ start: "2025-01-01", end: "2025-01-03" }]);
  });

  it("不連続→複数グループ", () => {
    const result = groupConsecutiveDates([
      "2025-01-01",
      "2025-01-02",
      "2025-01-05",
      "2025-01-06",
    ]);
    expect(result).toEqual([
      { start: "2025-01-01", end: "2025-01-02" },
      { start: "2025-01-05", end: "2025-01-06" },
    ]);
  });

  it("未ソート入力でもソートされる", () => {
    const result = groupConsecutiveDates([
      "2025-01-03",
      "2025-01-01",
      "2025-01-02",
    ]);
    expect(result).toEqual([{ start: "2025-01-01", end: "2025-01-03" }]);
  });
});

describe("runBackfillJob", () => {
  beforeEach(() => {
    mockGetTargetLocations.mockReset();
    mockGetGbpAccountId.mockReset();
    mockFetchDailyMetrics.mockReset();
    mockSaveDailyMetrics.mockReset();
    mockFetchRatingSnapshot.mockReset();
    mockSaveRatingSnapshot.mockReset();
    mockFrom.mockReset();
  });

  it("対象0件の場合は何も処理しない", async () => {
    mockGetTargetLocations.mockResolvedValue([]);
    const result = await runBackfillJob(7);
    expect(result.totalLocations).toBe(0);
    expect(result.results).toHaveLength(0);
    expect(mockFetchDailyMetrics).not.toHaveBeenCalled();
  });

  it("欠損なしの場合はAPIを呼ばない", async () => {
    mockGetTargetLocations.mockResolvedValue([
      { id: "loc-1", name: "Store A", gbpLocationId: "gbp-1" },
    ]);
    mockGetGbpAccountId.mockResolvedValue("acc-1");

    // 期待される日付を生成（backfillDays=7: 7日前〜昨日）
    const dates: string[] = [];
    for (let i = 7; i >= 1; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      dates.push(d.toISOString().split("T")[0]);
    }

    // daily_metrics クエリ → 全日×7メトリクスタイプ分のレコードを返す
    const metricRows = dates.flatMap((date) =>
      Array.from({ length: 7 }, () => ({ date }))
    );
    const metricsChain = createChain({ data: metricRows });

    // rating_snapshots クエリ → 全日にレコードあり
    const ratingRows = dates.map((date) => ({ date }));
    const ratingChain = createChain({ data: ratingRows });

    // getLastDataDates → 昨日のデータ
    const yesterday = dates[dates.length - 1];
    const lastMetricChain = createChain({ data: { date: yesterday } });
    const lastRatingChain = createChain({ data: { date: yesterday } });

    mockFrom
      .mockReturnValueOnce(metricsChain) // findMissingMetricDates
      .mockReturnValueOnce(ratingChain) // findMissingRatingDates
      .mockReturnValueOnce(lastMetricChain) // getLastDataDates - metrics
      .mockReturnValueOnce(lastRatingChain); // getLastDataDates - rating

    const result = await runBackfillJob(7);
    expect(result.totalLocations).toBe(1);
    // 全日にデータがあるのでAPIは呼ばれない
    expect(mockFetchDailyMetrics).not.toHaveBeenCalled();
    expect(mockFetchRatingSnapshot).not.toHaveBeenCalled();
  });

  it("API失敗時にerrorsに記録される", async () => {
    mockGetTargetLocations.mockResolvedValue([
      { id: "loc-1", name: "Store A", gbpLocationId: "gbp-1" },
    ]);
    mockGetGbpAccountId.mockResolvedValue("acc-1");

    // 1日分の欠損があるシナリオ
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];

    // findMissingMetricDates → 昨日が欠損（空のレコード返却）
    const metricsChain = createChain({ data: [] });
    const ratingChain = createChain({ data: [] });
    const lastMetricChain = createChain({ data: { date: yesterdayStr } });
    const lastRatingChain = createChain({ data: { date: yesterdayStr } });

    mockFrom
      .mockReturnValueOnce(metricsChain)
      .mockReturnValueOnce(ratingChain)
      .mockReturnValueOnce(lastMetricChain)
      .mockReturnValueOnce(lastRatingChain);

    // API呼び出し失敗
    mockFetchDailyMetrics.mockRejectedValue(new Error("API unavailable"));
    mockFetchRatingSnapshot.mockRejectedValue(
      new Error("Rating API unavailable")
    );

    const result = await runBackfillJob(3);
    expect(result.totalLocations).toBe(1);
    // エラーが記録されていること
    expect(result.results[0].errors.length).toBeGreaterThan(0);
  });

  it("overdueLocationsが検出される", async () => {
    mockGetTargetLocations.mockResolvedValue([
      { id: "loc-1", name: "Store A", gbpLocationId: "gbp-1" },
    ]);
    mockGetGbpAccountId.mockResolvedValue("acc-1");

    const metricsChain = createChain({ data: [] });
    const ratingChain = createChain({ data: [] });
    // 最終データ日が大昔 → overdue
    const lastMetricChain = createChain({
      data: { date: "2024-01-01" },
    });
    const lastRatingChain = createChain({
      data: { date: "2024-01-01" },
    });

    mockFrom
      .mockReturnValueOnce(metricsChain)
      .mockReturnValueOnce(ratingChain)
      .mockReturnValueOnce(lastMetricChain)
      .mockReturnValueOnce(lastRatingChain);

    const result = await runBackfillJob(30);
    expect(result.overdueLocations.length).toBeGreaterThan(0);
    expect(result.overdueLocations[0].locationId).toBe("loc-1");
  });
});
