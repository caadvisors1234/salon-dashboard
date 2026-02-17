import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { mockUsers } from "@/test/helpers/mock-auth";

const mockGetSession = vi.fn();
vi.mock("@/lib/auth/guards", () => ({
  getSession: () => mockGetSession(),
}));

const mockCheckLocationAccess = vi.fn();
vi.mock("@/lib/auth/access", () => ({
  checkLocationAccess: (...args: unknown[]) =>
    mockCheckLocationAccess(...args),
}));

const mockGetKeywordRanking = vi.fn();
vi.mock("@/lib/dashboard/queries", () => ({
  getKeywordRanking: (...args: unknown[]) => mockGetKeywordRanking(...args),
}));

import { GET } from "./route";

function createRequest(params: Record<string, string>): NextRequest {
  const url = new URL("http://localhost:3000/api/dashboard/keywords");
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return new NextRequest(url);
}

describe("GET /api/dashboard/keywords", () => {
  beforeEach(() => {
    mockGetSession.mockReset();
    mockCheckLocationAccess.mockReset();
    mockGetKeywordRanking.mockReset();
  });

  it("401: 未認証", async () => {
    mockGetSession.mockResolvedValue(null);
    const res = await GET(createRequest({}));
    expect(res.status).toBe(401);
  });

  it("400: locationId なし", async () => {
    mockGetSession.mockResolvedValue(mockUsers.admin);
    const res = await GET(createRequest({ yearMonth: "2025-03" }));
    expect(res.status).toBe(400);
  });

  it("400: yearMonth なし", async () => {
    mockGetSession.mockResolvedValue(mockUsers.admin);
    const res = await GET(createRequest({ locationId: "loc-001" }));
    expect(res.status).toBe(400);
  });

  it("403: アクセス権なし", async () => {
    mockGetSession.mockResolvedValue(mockUsers.client);
    mockCheckLocationAccess.mockResolvedValue(false);

    const res = await GET(
      createRequest({ locationId: "loc-999", yearMonth: "2025-03" })
    );
    expect(res.status).toBe(403);
  });

  it("200: 正常レスポンス", async () => {
    mockGetSession.mockResolvedValue(mockUsers.admin);
    mockCheckLocationAccess.mockResolvedValue(true);

    const mockResult = {
      keywords: [{ keyword: "美容院", rank: 1 }],
      totalCount: 1,
      page: 1,
      pageSize: 20,
    };
    mockGetKeywordRanking.mockResolvedValue(mockResult);

    const res = await GET(
      createRequest({ locationId: "loc-001", yearMonth: "2025-03" })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual(mockResult);
  });

  it("ページネーションパラメータを渡す", async () => {
    mockGetSession.mockResolvedValue(mockUsers.admin);
    mockCheckLocationAccess.mockResolvedValue(true);
    mockGetKeywordRanking.mockResolvedValue({ keywords: [] });

    await GET(
      createRequest({
        locationId: "loc-001",
        yearMonth: "2025-03",
        page: "2",
        pageSize: "10",
      })
    );

    expect(mockGetKeywordRanking).toHaveBeenCalledWith(
      "loc-001",
      "2025-03",
      2,
      10
    );
  });

  it("デフォルトページネーション（page=1, pageSize=20）", async () => {
    mockGetSession.mockResolvedValue(mockUsers.admin);
    mockCheckLocationAccess.mockResolvedValue(true);
    mockGetKeywordRanking.mockResolvedValue({ keywords: [] });

    await GET(
      createRequest({ locationId: "loc-001", yearMonth: "2025-03" })
    );

    expect(mockGetKeywordRanking).toHaveBeenCalledWith(
      "loc-001",
      "2025-03",
      1,
      20
    );
  });
});
