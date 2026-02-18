import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { mockUsers } from "@/test/helpers/mock-auth";

// 認証モック
const mockGetSession = vi.fn();
vi.mock("@/lib/auth/guards", () => ({
  getSession: () => mockGetSession(),
}));

// アクセス制御モック
const mockCheckOrgAccess = vi.fn();
vi.mock("@/lib/auth/access", () => ({
  checkOrgAccess: (...args: unknown[]) => mockCheckOrgAccess(...args),
}));

// Supabase admin モック
const mockAdminFrom = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    from: (...args: unknown[]) => mockAdminFrom(...args),
  })),
}));

// PDF トークンモック
vi.mock("@/lib/pdf/token", () => ({
  createReportToken: vi.fn().mockResolvedValue("mock-token"),
}));

// PDF キューモック
const mockEnqueue = vi.fn();
const mockGetStatus = vi.fn();
vi.mock("@/lib/pdf/queue", () => ({
  pdfQueue: {
    enqueue: (...args: unknown[]) => mockEnqueue(...args),
    getStatus: () => mockGetStatus(),
  },
}));

// PDF ジェネレータモック
const mockGenerateStorePdf = vi.fn();
const mockGenerateClientZip = vi.fn();
vi.mock("@/lib/pdf/generator", () => ({
  generateStorePdf: (...args: unknown[]) => mockGenerateStorePdf(...args),
  generateClientZip: (...args: unknown[]) => mockGenerateClientZip(...args),
}));

// レポートクエリモック
const mockGetOrgLocations = vi.fn();
const mockGetOrgName = vi.fn();
vi.mock("@/lib/pdf/report-queries", () => ({
  getOrgLocations: (...args: unknown[]) => mockGetOrgLocations(...args),
  getOrgName: (...args: unknown[]) => mockGetOrgName(...args),
}));

// レート制限モック
const mockRateLimitCheck = vi.fn();
vi.mock("@/lib/pdf/rate-limit", () => ({
  pdfRateLimit: {
    check: (...args: unknown[]) => mockRateLimitCheck(...args),
  },
}));

import { POST } from "./route";

function createRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/reports/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function createAdminChain(result: { data: unknown; error?: unknown }) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  const methods = ["select", "eq", "single"];
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  chain.single = vi.fn().mockResolvedValue(result);
  return chain;
}

describe("POST /api/reports/generate", () => {
  beforeEach(() => {
    mockGetSession.mockReset();
    mockCheckOrgAccess.mockReset();
    mockAdminFrom.mockReset();
    mockEnqueue.mockReset();
    mockGetStatus.mockReset();
    mockGenerateStorePdf.mockReset();
    mockGenerateClientZip.mockReset();
    mockGetOrgLocations.mockReset();
    mockGetOrgName.mockReset();
    mockRateLimitCheck.mockReset();

    // デフォルト: レート制限OK、キュー空
    mockRateLimitCheck.mockReturnValue({
      allowed: true,
      remaining: 4,
      resetAt: Date.now() + 3600_000,
    });
    mockGetStatus.mockReturnValue({ running: 0, waiting: 0 });
  });

  // --- 認証 ---
  it("401: 未認証", async () => {
    mockGetSession.mockResolvedValue(null);
    const res = await POST(
      createRequest({
        type: "store",
        locationId: "loc-1",
        startMonth: "2025-01",
        endMonth: "2025-01",
      })
    );
    expect(res.status).toBe(401);
  });

  // --- バリデーション ---
  it("400: type 不正", async () => {
    mockGetSession.mockResolvedValue(mockUsers.admin);
    const res = await POST(
      createRequest({
        type: "invalid",
        startMonth: "2025-01",
        endMonth: "2025-01",
      })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("type");
  });

  it("400: startMonth 形式不正", async () => {
    mockGetSession.mockResolvedValue(mockUsers.admin);
    const res = await POST(
      createRequest({
        type: "store",
        locationId: "loc-1",
        startMonth: "2025/01",
        endMonth: "2025-01",
      })
    );
    expect(res.status).toBe(400);
  });

  it("400: startMonth > endMonth", async () => {
    mockGetSession.mockResolvedValue(mockUsers.admin);
    const res = await POST(
      createRequest({
        type: "store",
        locationId: "loc-1",
        startMonth: "2025-03",
        endMonth: "2025-01",
      })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("startMonth");
  });

  // --- 権限 ---
  it("403: store アクセス権なし", async () => {
    mockGetSession.mockResolvedValue(mockUsers.staff);

    const locChain = createAdminChain({
      data: { name: "Store A", org_id: "org-1" },
    });
    mockAdminFrom.mockReturnValue(locChain);
    mockCheckOrgAccess.mockResolvedValue(false);

    const res = await POST(
      createRequest({
        type: "store",
        locationId: "loc-1",
        startMonth: "2025-01",
        endMonth: "2025-01",
      })
    );
    expect(res.status).toBe(403);
  });

  it("403: client アクセス権なし", async () => {
    mockGetSession.mockResolvedValue(mockUsers.client);
    mockCheckOrgAccess.mockResolvedValue(false);

    const res = await POST(
      createRequest({
        type: "client",
        orgId: "org-other",
        startMonth: "2025-01",
        endMonth: "2025-01",
      })
    );
    expect(res.status).toBe(403);
  });

  // --- レート制限 ---
  it("429: ユーザー単位レート制限超過", async () => {
    mockGetSession.mockResolvedValue(mockUsers.admin);

    const locChain = createAdminChain({
      data: { name: "Store A", org_id: "org-1" },
    });
    const orgChain = createAdminChain({ data: { name: "Org A" } });
    mockAdminFrom.mockReturnValueOnce(locChain).mockReturnValueOnce(orgChain);
    mockCheckOrgAccess.mockResolvedValue(true);

    mockRateLimitCheck.mockReturnValue({
      allowed: false,
      remaining: 0,
      resetAt: Date.now() + 1800_000,
    });

    const res = await POST(
      createRequest({
        type: "store",
        locationId: "loc-1",
        startMonth: "2025-01",
        endMonth: "2025-01",
      })
    );
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toContain("上限");
    expect(res.headers.get("Retry-After")).toBeTruthy();
  });

  // --- キュー ---
  it("429: キュー満杯", async () => {
    mockGetSession.mockResolvedValue(mockUsers.admin);

    const locChain = createAdminChain({
      data: { name: "Store A", org_id: "org-1" },
    });
    const orgChain = createAdminChain({ data: { name: "Org A" } });
    mockAdminFrom.mockReturnValueOnce(locChain).mockReturnValueOnce(orgChain);
    mockCheckOrgAccess.mockResolvedValue(true);

    mockGetStatus.mockReturnValue({ running: 2, waiting: 10 });

    const res = await POST(
      createRequest({
        type: "store",
        locationId: "loc-1",
        startMonth: "2025-01",
        endMonth: "2025-01",
      })
    );
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toContain("キュー");
  });

  // --- 正常系 ---
  it("200: store PDF生成", async () => {
    mockGetSession.mockResolvedValue(mockUsers.admin);

    const locChain = createAdminChain({
      data: { name: "Store A", org_id: "org-1" },
    });
    const orgChain = createAdminChain({ data: { name: "Org A" } });
    mockAdminFrom.mockReturnValueOnce(locChain).mockReturnValueOnce(orgChain);
    mockCheckOrgAccess.mockResolvedValue(true);

    const pdfBuffer = Buffer.from("fake-pdf-content");
    mockEnqueue.mockImplementation(async (job: (signal: AbortSignal) => Promise<Buffer>) => {
      return job(new AbortController().signal);
    });
    mockGenerateStorePdf.mockResolvedValue(pdfBuffer);

    const res = await POST(
      createRequest({
        type: "store",
        locationId: "loc-1",
        startMonth: "2025-01",
        endMonth: "2025-01",
      })
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    expect(res.headers.get("Content-Disposition")).toContain(".pdf");
  });

  it("200: client ZIP生成", async () => {
    mockGetSession.mockResolvedValue(mockUsers.admin);
    mockCheckOrgAccess.mockResolvedValue(true);
    mockGetOrgLocations.mockResolvedValue([
      { id: "loc-1", name: "Store A" },
    ]);
    mockGetOrgName.mockResolvedValue("Org A");

    const zipBuffer = Buffer.from("fake-zip-content");
    mockGenerateClientZip.mockResolvedValue(zipBuffer);

    const res = await POST(
      createRequest({
        type: "client",
        orgId: "org-1",
        startMonth: "2025-01",
        endMonth: "2025-01",
      })
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/zip");
  });

  // --- エラー ---
  it("500: PDF生成失敗", async () => {
    mockGetSession.mockResolvedValue(mockUsers.admin);

    const locChain = createAdminChain({
      data: { name: "Store A", org_id: "org-1" },
    });
    const orgChain = createAdminChain({ data: { name: "Org A" } });
    mockAdminFrom.mockReturnValueOnce(locChain).mockReturnValueOnce(orgChain);
    mockCheckOrgAccess.mockResolvedValue(true);

    mockEnqueue.mockRejectedValue(new Error("Puppeteer crashed"));

    const res = await POST(
      createRequest({
        type: "store",
        locationId: "loc-1",
        startMonth: "2025-01",
        endMonth: "2025-01",
      })
    );
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toContain("Puppeteer crashed");
  });
});
