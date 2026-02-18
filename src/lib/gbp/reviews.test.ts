import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

import { createAdminClient } from "@/lib/supabase/admin";
import { fetchRatingSnapshot, saveRatingSnapshot } from "./reviews";
import type { RatingData } from "./types";

// GbpApiClient モック
const mockClient = {
  get: vi.fn(),
  post: vi.fn(),
  request: vi.fn(),
};

describe("fetchRatingSnapshot", () => {
  beforeEach(() => {
    mockClient.get.mockReset();
  });

  it("評価データを正しく返す", async () => {
    mockClient.get.mockResolvedValue({
      reviews: [{ name: "review/1" }],
      averageRating: 4.3,
      totalReviewCount: 52,
    });

    const result = await fetchRatingSnapshot(
      mockClient as never,
      "accounts/acc-001",
      "loc-789"
    );

    expect(result.averageRating).toBe(4.3);
    expect(result.totalReviewCount).toBe(52);
    expect(result.fetchedAt).toBeInstanceOf(Date);

    // URL が正しく組み立てられていることを確認
    const calledUrl: string = mockClient.get.mock.calls[0][0];
    expect(calledUrl).toContain("accounts/acc-001/locations/loc-789/reviews");
    expect(calledUrl).toContain("pageSize=1");
  });

  it("averageRating と totalReviewCount が null の場合を処理する", async () => {
    // レビューがまだない新しいロケーションの場合
    mockClient.get.mockResolvedValue({});

    const result = await fetchRatingSnapshot(
      mockClient as never,
      "accounts/acc-002",
      "loc-new"
    );

    expect(result.averageRating).toBeNull();
    expect(result.totalReviewCount).toBeNull();
    expect(result.fetchedAt).toBeInstanceOf(Date);
  });
});

describe("saveRatingSnapshot", () => {
  const mockUpsert = vi.fn();
  const mockSupabase = {
    from: vi.fn(() => ({ upsert: mockUpsert })),
  };

  beforeEach(() => {
    mockUpsert.mockReset();
    mockSupabase.from.mockClear();
    (createAdminClient as ReturnType<typeof vi.fn>).mockReturnValue(mockSupabase);
  });

  it("正しいデータで UPSERT する", async () => {
    mockUpsert.mockResolvedValue({ error: null });

    const data: RatingData = {
      averageRating: 4.5,
      totalReviewCount: 100,
      fetchedAt: new Date("2025-03-01T10:00:00Z"),
    };

    await saveRatingSnapshot("uuid-loc-1", "2025-03-01", data);

    expect(mockSupabase.from).toHaveBeenCalledWith("rating_snapshots");
    expect(mockUpsert).toHaveBeenCalledWith(
      {
        location_id: "uuid-loc-1",
        date: "2025-03-01",
        rating: 4.5,
        review_count: 100,
      },
      { onConflict: "location_id,date" }
    );
  });

  it("DB エラー時に例外をスローする", async () => {
    mockUpsert.mockResolvedValue({
      error: { message: "connection timeout" },
    });

    const data: RatingData = {
      averageRating: 3.8,
      totalReviewCount: 25,
      fetchedAt: new Date("2025-03-01T10:00:00Z"),
    };

    await expect(
      saveRatingSnapshot("uuid-loc-1", "2025-03-01", data)
    ).rejects.toThrow("Failed to save rating snapshot: connection timeout");
  });
});
