import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { mockUsers } from "@/test/helpers/mock-auth";

const mockGetSession = vi.fn();
vi.mock("@/lib/auth/guards", () => ({
  getSession: () => mockGetSession(),
}));

const mockFromChain = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    from: (...args: unknown[]) => mockFromChain(...args),
  }),
}));

import { GET, DELETE } from "./route";

/** from() チェーンのヘルパー */
function createChain(result: { data: unknown; error?: unknown }) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  const methods = [
    "select",
    "insert",
    "update",
    "delete",
    "eq",
    "neq",
    "in",
    "single",
    "order",
    "limit",
  ];
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  chain.single = vi.fn().mockResolvedValue(result);
  chain.then = vi
    .fn()
    .mockImplementation((resolve: (v: unknown) => void) => resolve(result));
  return chain;
}

function createGetRequest(locationId?: string): NextRequest {
  const url = locationId
    ? `http://localhost:3000/api/hpb/data?locationId=${locationId}`
    : "http://localhost:3000/api/hpb/data";
  return new NextRequest(url, { method: "GET" });
}

function createDeleteRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/hpb/data", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("GET /api/hpb/data", () => {
  beforeEach(() => {
    mockGetSession.mockReset();
    mockFromChain.mockReset();
  });

  it("401: 未認証", async () => {
    mockGetSession.mockResolvedValue(null);
    const res = await GET(createGetRequest("loc-001"));
    expect(res.status).toBe(401);
  });

  it("403: client ロール", async () => {
    mockGetSession.mockResolvedValue(mockUsers.client);
    const res = await GET(createGetRequest("loc-001"));
    expect(res.status).toBe(403);
  });

  it("400: locationId なし", async () => {
    mockGetSession.mockResolvedValue(mockUsers.admin);
    const res = await GET(createGetRequest());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("店舗");
  });

  it("404: 店舗が見つからない", async () => {
    mockGetSession.mockResolvedValue(mockUsers.admin);
    mockFromChain.mockReturnValue(
      createChain({ data: null, error: { message: "not found" } })
    );
    const res = await GET(createGetRequest("loc-999"));
    expect(res.status).toBe(404);
  });

  it("200: 月リスト取得成功", async () => {
    mockGetSession.mockResolvedValue(mockUsers.admin);

    const locChain = createChain({ data: { id: "loc-001" } });
    const metricsChain = createChain({
      data: [{ year_month: "202509" }, { year_month: "202508" }],
    });

    mockFromChain
      .mockReturnValueOnce(locChain)
      .mockReturnValueOnce(metricsChain);

    const res = await GET(createGetRequest("loc-001"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.yearMonths).toEqual(["202509", "202508"]);
  });

  it("200: staff ロールでも取得可能", async () => {
    mockGetSession.mockResolvedValue(mockUsers.staff);

    const locChain = createChain({ data: { id: "loc-001" } });
    const metricsChain = createChain({ data: [] });

    mockFromChain
      .mockReturnValueOnce(locChain)
      .mockReturnValueOnce(metricsChain);

    const res = await GET(createGetRequest("loc-001"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.yearMonths).toEqual([]);
  });
});

describe("DELETE /api/hpb/data", () => {
  beforeEach(() => {
    mockGetSession.mockReset();
    mockFromChain.mockReset();
  });

  it("401: 未認証", async () => {
    mockGetSession.mockResolvedValue(null);
    const res = await DELETE(
      createDeleteRequest({ locationId: "loc-001", yearMonths: ["202509"] })
    );
    expect(res.status).toBe(401);
  });

  it("403: client ロール", async () => {
    mockGetSession.mockResolvedValue(mockUsers.client);
    const res = await DELETE(
      createDeleteRequest({ locationId: "loc-001", yearMonths: ["202509"] })
    );
    expect(res.status).toBe(403);
  });

  it("400: locationId なし", async () => {
    mockGetSession.mockResolvedValue(mockUsers.admin);
    const res = await DELETE(createDeleteRequest({ yearMonths: ["202509"] }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("店舗");
  });

  it("400: yearMonths なし", async () => {
    mockGetSession.mockResolvedValue(mockUsers.admin);
    const res = await DELETE(
      createDeleteRequest({ locationId: "loc-001", yearMonths: [] })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("年月");
  });

  it("400: yearMonths 形式不正", async () => {
    mockGetSession.mockResolvedValue(mockUsers.admin);
    const res = await DELETE(
      createDeleteRequest({ locationId: "loc-001", yearMonths: ["2025-09"] })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("形式が不正");
  });

  it("404: 店舗が見つからない", async () => {
    mockGetSession.mockResolvedValue(mockUsers.admin);
    mockFromChain.mockReturnValue(
      createChain({ data: null, error: { message: "not found" } })
    );
    const res = await DELETE(
      createDeleteRequest({ locationId: "loc-999", yearMonths: ["202509"] })
    );
    expect(res.status).toBe(404);
  });

  it("404: 対象データなし", async () => {
    mockGetSession.mockResolvedValue(mockUsers.admin);

    const locChain = createChain({ data: { id: "loc-001" } });
    const checkChain = createChain({ data: [] });

    mockFromChain
      .mockReturnValueOnce(locChain)
      .mockReturnValueOnce(checkChain);

    const res = await DELETE(
      createDeleteRequest({ locationId: "loc-001", yearMonths: ["202509"] })
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toContain("見つかりません");
  });

  it("200: 全月削除 → upload_logs も deleted に更新", async () => {
    mockGetSession.mockResolvedValue(mockUsers.admin);

    const locChain = createChain({ data: { id: "loc-001" } });
    const checkChain = createChain({
      data: [{ year_month: "202508" }, { year_month: "202509" }],
    });
    const deleteChain = createChain({ data: null, error: undefined });
    const remainingChain = createChain({ data: [] }); // 残データなし
    const uploadLogUpdateChain = createChain({ data: null, error: undefined });
    const auditLogChain = createChain({ data: null });

    mockFromChain
      .mockReturnValueOnce(locChain)
      .mockReturnValueOnce(checkChain)
      .mockReturnValueOnce(deleteChain)
      .mockReturnValueOnce(remainingChain)
      .mockReturnValueOnce(uploadLogUpdateChain)
      .mockReturnValueOnce(auditLogChain);

    const res = await DELETE(
      createDeleteRequest({
        locationId: "loc-001",
        yearMonths: ["202508", "202509"],
        reason: "誤った店舗にアップロード",
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.deletedCount).toBe(2);

    // upload_logs の update が呼ばれたことを確認
    expect(mockFromChain).toHaveBeenCalledWith("hpb_upload_logs");
  });

  it("200: 一部月削除 → upload_logs は更新しない", async () => {
    mockGetSession.mockResolvedValue(mockUsers.staff);

    const locChain = createChain({ data: { id: "loc-001" } });
    const checkChain = createChain({
      data: [{ year_month: "202509" }],
    });
    const deleteChain = createChain({ data: null, error: undefined });
    const remainingChain = createChain({ data: [{ id: "remaining-1" }] }); // 残データあり
    const auditLogChain = createChain({ data: null });

    mockFromChain
      .mockReturnValueOnce(locChain)
      .mockReturnValueOnce(checkChain)
      .mockReturnValueOnce(deleteChain)
      .mockReturnValueOnce(remainingChain)
      .mockReturnValueOnce(auditLogChain);

    const res = await DELETE(
      createDeleteRequest({
        locationId: "loc-001",
        yearMonths: ["202509"],
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.deletedCount).toBe(1);

    // upload_logs の update は呼ばれない（5回目は hpb_deletion_logs）
    const fromCalls = mockFromChain.mock.calls.map((c) => c[0]);
    expect(fromCalls).not.toContain("hpb_upload_logs");
  });
});
