import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

import { createAdminClient } from "@/lib/supabase/admin";
import { fetchMonthlyKeywords, saveMonthlyKeywords } from "./keywords";
import type { KeywordResult } from "./types";

// GbpApiClient モック
const mockClient = {
  get: vi.fn(),
  post: vi.fn(),
  request: vi.fn(),
};

describe("fetchMonthlyKeywords", () => {
  beforeEach(() => {
    mockClient.get.mockReset();
  });

  it("VALUE タイプのキーワードを正しくパースする", async () => {
    mockClient.get.mockResolvedValue({
      searchKeywordsCounts: [
        {
          searchKeyword: "美容室 渋谷",
          insightsValue: { value: "150" },
        },
        {
          searchKeyword: "ヘアサロン 近く",
          insightsValue: { value: "80" },
        },
      ],
    });

    const results = await fetchMonthlyKeywords(
      mockClient as never,
      "loc-kw-1",
      2025,
      3
    );

    expect(results).toHaveLength(2);
    expect(results[0]).toEqual({
      keyword: "美容室 渋谷",
      insightsValueType: "VALUE",
      insightsValue: 150,
      insightsThreshold: null,
    });
    expect(results[1]).toEqual({
      keyword: "ヘアサロン 近く",
      insightsValueType: "VALUE",
      insightsValue: 80,
      insightsThreshold: null,
    });

    // URL パラメータを確認
    const calledUrl: string = mockClient.get.mock.calls[0][0];
    expect(calledUrl).toContain("locations/loc-kw-1/searchkeywords/impressions/monthly");
    expect(calledUrl).toContain("monthlyRange.startMonth.year=2025");
    expect(calledUrl).toContain("monthlyRange.startMonth.month=3");
    expect(calledUrl).toContain("pageSize=100");
  });

  it("THRESHOLD タイプのキーワードを正しくパースする", async () => {
    mockClient.get.mockResolvedValue({
      searchKeywordsCounts: [
        {
          searchKeyword: "カット 安い",
          insightsValue: { threshold: "5" },
        },
      ],
    });

    const results = await fetchMonthlyKeywords(
      mockClient as never,
      "loc-kw-2",
      2025,
      6
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({
      keyword: "カット 安い",
      insightsValueType: "THRESHOLD",
      insightsValue: null,
      insightsThreshold: 5,
    });
  });

  it("ページネーションを処理して全ページの結果を返す", async () => {
    // 1ページ目: nextPageToken あり
    mockClient.get.mockResolvedValueOnce({
      searchKeywordsCounts: [
        {
          searchKeyword: "美容室 表参道",
          insightsValue: { value: "200" },
        },
      ],
      nextPageToken: "page2",
    });
    // 2ページ目: nextPageToken なし（最終ページ）
    mockClient.get.mockResolvedValueOnce({
      searchKeywordsCounts: [
        {
          searchKeyword: "パーマ 人気",
          insightsValue: { value: "45" },
        },
      ],
    });

    const results = await fetchMonthlyKeywords(
      mockClient as never,
      "loc-kw-3",
      2025,
      4
    );

    expect(results).toHaveLength(2);
    expect(results[0].keyword).toBe("美容室 表参道");
    expect(results[1].keyword).toBe("パーマ 人気");

    // 2回 API が呼ばれていることを確認
    expect(mockClient.get).toHaveBeenCalledTimes(2);

    // 2ページ目のリクエストに pageToken が含まれていることを確認
    const secondCallUrl: string = mockClient.get.mock.calls[1][0];
    expect(secondCallUrl).toContain("pageToken=page2");
  });

  it("データがない場合は空配列を返す", async () => {
    mockClient.get.mockResolvedValue({});

    const results = await fetchMonthlyKeywords(
      mockClient as never,
      "loc-kw-4",
      2025,
      1
    );

    expect(results).toEqual([]);
  });
});

describe("saveMonthlyKeywords", () => {
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
    mockUpsert.mockResolvedValue({ error: null, count: 2 });

    const results: KeywordResult[] = [
      {
        keyword: "美容室 渋谷",
        insightsValueType: "VALUE",
        insightsValue: 150,
        insightsThreshold: null,
      },
      {
        keyword: "カット 安い",
        insightsValueType: "THRESHOLD",
        insightsValue: null,
        insightsThreshold: 5,
      },
    ];

    const count = await saveMonthlyKeywords("uuid-loc-kw", "2025-03", results);

    expect(count).toBe(2);
    expect(mockSupabase.from).toHaveBeenCalledWith("monthly_keywords");
    expect(mockUpsert).toHaveBeenCalledWith(
      [
        {
          location_id: "uuid-loc-kw",
          year_month: "2025-03",
          keyword: "美容室 渋谷",
          insights_value: 150,
          insights_threshold: null,
          insights_value_type: "VALUE",
        },
        {
          location_id: "uuid-loc-kw",
          year_month: "2025-03",
          keyword: "カット 安い",
          insights_value: null,
          insights_threshold: 5,
          insights_value_type: "THRESHOLD",
        },
      ],
      { onConflict: "location_id,year_month,keyword", count: "exact" }
    );
  });

  it("空の結果配列の場合は 0 を返す", async () => {
    const count = await saveMonthlyKeywords("uuid-loc-kw", "2025-03", []);

    expect(count).toBe(0);
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });
});
