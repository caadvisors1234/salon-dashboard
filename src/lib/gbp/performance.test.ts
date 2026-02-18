import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

import { createAdminClient } from "@/lib/supabase/admin";
import { fetchDailyMetrics, saveDailyMetrics } from "./performance";
import type { DailyMetricResult } from "./types";

// GbpApiClient モック
const mockClient = {
  get: vi.fn(),
  post: vi.fn(),
  request: vi.fn(),
};

describe("fetchDailyMetrics", () => {
  beforeEach(() => {
    mockClient.get.mockReset();
  });

  it("multiDailyMetricTimeSeries レスポンスを正しくパースする", async () => {
    mockClient.get.mockResolvedValue({
      multiDailyMetricTimeSeries: [
        {
          dailyMetricTimeSeries: [
            {
              dailyMetric: "BUSINESS_IMPRESSIONS_DESKTOP_SEARCH",
              timeSeries: {
                datedValues: [
                  {
                    date: { year: 2025, month: 1, day: 15 },
                    value: "120",
                  },
                  {
                    date: { year: 2025, month: 1, day: 16 },
                    value: "85",
                  },
                ],
              },
            },
            {
              dailyMetric: "CALL_CLICKS",
              timeSeries: {
                datedValues: [
                  {
                    date: { year: 2025, month: 1, day: 15 },
                    value: "5",
                  },
                ],
              },
            },
          ],
        },
      ],
    });

    const results = await fetchDailyMetrics(
      mockClient as never,
      "loc-123",
      "2025-01-15",
      "2025-01-16"
    );

    expect(results).toHaveLength(3);
    expect(results[0]).toEqual({
      date: "2025-01-15",
      metricType: "BUSINESS_IMPRESSIONS_DESKTOP_SEARCH",
      value: 120,
    });
    expect(results[1]).toEqual({
      date: "2025-01-16",
      metricType: "BUSINESS_IMPRESSIONS_DESKTOP_SEARCH",
      value: 85,
    });
    expect(results[2]).toEqual({
      date: "2025-01-15",
      metricType: "CALL_CLICKS",
      value: 5,
    });

    // URL にメトリックタイプと日付パラメータが含まれていることを確認
    const calledUrl: string = mockClient.get.mock.calls[0][0];
    expect(calledUrl).toContain("locations/loc-123:fetchMultiDailyMetricsTimeSeries");
    expect(calledUrl).toContain("dailyRange.start_date.year=2025");
    expect(calledUrl).toContain("dailyRange.start_date.month=1");
    expect(calledUrl).toContain("dailyRange.start_date.day=15");
    expect(calledUrl).toContain("dailyRange.end_date.year=2025");
    expect(calledUrl).toContain("dailyRange.end_date.month=1");
    expect(calledUrl).toContain("dailyRange.end_date.day=16");
  });

  it("データがない場合は空配列を返す", async () => {
    mockClient.get.mockResolvedValue({});

    const results = await fetchDailyMetrics(
      mockClient as never,
      "loc-456",
      "2025-02-01",
      "2025-02-28"
    );

    expect(results).toEqual([]);
  });
});

describe("saveDailyMetrics", () => {
  const mockUpsert = vi.fn();
  const mockSupabase = {
    from: vi.fn(() => ({ upsert: mockUpsert })),
  };

  beforeEach(() => {
    mockUpsert.mockReset();
    mockSupabase.from.mockClear();
    (createAdminClient as ReturnType<typeof vi.fn>).mockReturnValue(mockSupabase);
  });

  it("行を UPSERT して件数を返す", async () => {
    mockUpsert.mockResolvedValue({ error: null, count: 3 });

    const results: DailyMetricResult[] = [
      { date: "2025-01-15", metricType: "CALL_CLICKS", value: 5 },
      { date: "2025-01-15", metricType: "WEBSITE_CLICKS", value: 12 },
      { date: "2025-01-16", metricType: "CALL_CLICKS", value: 8 },
    ];

    const count = await saveDailyMetrics("uuid-abc", results);

    expect(count).toBe(3);
    expect(mockSupabase.from).toHaveBeenCalledWith("daily_metrics");
    expect(mockUpsert).toHaveBeenCalledWith(
      [
        { location_id: "uuid-abc", date: "2025-01-15", metric_type: "CALL_CLICKS", value: 5 },
        { location_id: "uuid-abc", date: "2025-01-15", metric_type: "WEBSITE_CLICKS", value: 12 },
        { location_id: "uuid-abc", date: "2025-01-16", metric_type: "CALL_CLICKS", value: 8 },
      ],
      { onConflict: "location_id,date,metric_type", count: "exact" }
    );
  });

  it("空の結果配列の場合は 0 を返す", async () => {
    const count = await saveDailyMetrics("uuid-abc", []);

    expect(count).toBe(0);
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it("DB エラー時に例外をスローする", async () => {
    mockUpsert.mockResolvedValue({
      error: { message: "duplicate key violation" },
      count: null,
    });

    const results: DailyMetricResult[] = [
      { date: "2025-01-15", metricType: "CALL_CLICKS", value: 5 },
    ];

    await expect(saveDailyMetrics("uuid-abc", results)).rejects.toThrow(
      "Failed to save daily metrics: duplicate key violation"
    );
  });
});
