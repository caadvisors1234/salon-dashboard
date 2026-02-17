import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { mockUsers } from "@/test/helpers/mock-auth";
import { clearAllLocks } from "@/lib/batch/lock";

const mockAfter = vi.fn((fn: () => void) => fn());
vi.mock("next/server", async (importOriginal) => {
  const original = await importOriginal<typeof import("next/server")>();
  return { ...original, after: (...args: unknown[]) => mockAfter(...args) };
});

const mockGetSession = vi.fn();
vi.mock("@/lib/auth/guards", () => ({
  getSession: () => mockGetSession(),
}));

vi.mock("@/lib/batch/logger", () => ({
  logJobStart: vi.fn().mockResolvedValue("log-001"),
  logJobComplete: vi.fn().mockResolvedValue(undefined),
  logJobError: vi.fn().mockResolvedValue(undefined),
}));

const mockRunDailyJob = vi.fn();
const mockRunMonthlyJob = vi.fn();
const mockRunBackfillJob = vi.fn();
const mockRunInitialBackfill = vi.fn();
vi.mock("@/lib/batch/jobs/daily", () => ({
  runDailyJob: (...args: unknown[]) => mockRunDailyJob(...args),
}));
vi.mock("@/lib/batch/jobs/monthly", () => ({
  runMonthlyJob: (...args: unknown[]) => mockRunMonthlyJob(...args),
}));
vi.mock("@/lib/batch/jobs/backfill", () => ({
  runBackfillJob: (...args: unknown[]) => mockRunBackfillJob(...args),
}));
vi.mock("@/lib/batch/jobs/initial-backfill", () => ({
  runInitialBackfill: (...args: unknown[]) => mockRunInitialBackfill(...args),
}));

import { POST } from "./route";

function createRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/batch/trigger", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/batch/trigger", () => {
  beforeEach(() => {
    mockGetSession.mockReset();
    mockRunDailyJob.mockReset();
    mockRunMonthlyJob.mockReset();
    mockRunBackfillJob.mockReset();
    mockRunInitialBackfill.mockReset();
    mockAfter.mockReset();
    mockAfter.mockImplementation((fn: () => void) => fn());
    clearAllLocks();
  });

  it("403: 未認証", async () => {
    mockGetSession.mockResolvedValue(null);
    const res = await POST(createRequest({ jobType: "daily" }));
    expect(res.status).toBe(403);
  });

  it("403: 非admin", async () => {
    mockGetSession.mockResolvedValue(mockUsers.staff);
    const res = await POST(createRequest({ jobType: "daily" }));
    expect(res.status).toBe(403);
  });

  it("400: 不正なjobType", async () => {
    mockGetSession.mockResolvedValue(mockUsers.admin);
    const res = await POST(createRequest({ jobType: "invalid" }));
    expect(res.status).toBe(400);
  });

  it("400: jobType なし", async () => {
    mockGetSession.mockResolvedValue(mockUsers.admin);
    const res = await POST(createRequest({}));
    expect(res.status).toBe(400);
  });

  it("200: daily ジョブ正常実行", async () => {
    mockGetSession.mockResolvedValue(mockUsers.admin);
    mockRunDailyJob.mockResolvedValue({ processed: 5 });

    const res = await POST(createRequest({ jobType: "daily" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.jobType).toBe("daily");
    expect(body.result).toEqual({ processed: 5 });
  });

  it("200: monthly ジョブ正常実行", async () => {
    mockGetSession.mockResolvedValue(mockUsers.admin);
    mockRunMonthlyJob.mockResolvedValue({ processed: 3 });

    const res = await POST(createRequest({ jobType: "monthly" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.jobType).toBe("monthly");
  });

  it("200: monthly ジョブ（targetDate指定）", async () => {
    mockGetSession.mockResolvedValue(mockUsers.admin);
    mockRunMonthlyJob.mockResolvedValue({ processed: 1 });

    const res = await POST(
      createRequest({ jobType: "monthly", targetDate: "2025-03" })
    );
    expect(res.status).toBe(200);
    expect(mockRunMonthlyJob).toHaveBeenCalledWith(2025, 3);
  });

  it("200: backfill ジョブ正常実行", async () => {
    mockGetSession.mockResolvedValue(mockUsers.admin);
    mockRunBackfillJob.mockResolvedValue({ backfilled: 10 });

    const res = await POST(createRequest({ jobType: "backfill" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it("400: initial-backfill で locationId なし", async () => {
    mockGetSession.mockResolvedValue(mockUsers.admin);
    const res = await POST(
      createRequest({ jobType: "initial-backfill" })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("locationId");
  });

  it("200: initial-backfill 正常実行（バックグラウンド）", async () => {
    mockGetSession.mockResolvedValue(mockUsers.admin);
    mockRunInitialBackfill.mockResolvedValue({ locationId: "loc-1", backfill: {}, monthlyResults: [] });

    const res = await POST(
      createRequest({ jobType: "initial-backfill", locationId: "loc-1" })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.jobType).toBe("initial-backfill");
    expect(body.message).toBeDefined();
    expect(mockRunInitialBackfill).toHaveBeenCalledWith("loc-1");
  });

  it("initial-backfill は異なるロケーションで同時実行可能", async () => {
    mockGetSession.mockResolvedValue(mockUsers.admin);
    // after() をコールバック実行しないようにし、ロックが保持されたままにする
    mockAfter.mockImplementation(() => {});
    mockRunInitialBackfill.mockResolvedValue({});

    const res1 = await POST(
      createRequest({ jobType: "initial-backfill", locationId: "loc-1" })
    );
    expect(res1.status).toBe(200);

    const res2 = await POST(
      createRequest({ jobType: "initial-backfill", locationId: "loc-2" })
    );
    expect(res2.status).toBe(200);
  });

  it("initial-backfill は同じロケーションの重複実行を防止", async () => {
    mockGetSession.mockResolvedValue(mockUsers.admin);
    // after() をコールバック実行しないようにし、ロックが保持されたままにする
    mockAfter.mockImplementation(() => {});
    mockRunInitialBackfill.mockResolvedValue({});

    const res1 = await POST(
      createRequest({ jobType: "initial-backfill", locationId: "loc-1" })
    );
    expect(res1.status).toBe(200);

    const res2 = await POST(
      createRequest({ jobType: "initial-backfill", locationId: "loc-1" })
    );
    expect(res2.status).toBe(409);
  });

  it("500: ジョブ実行エラー", async () => {
    mockGetSession.mockResolvedValue(mockUsers.admin);
    mockRunDailyJob.mockRejectedValue(new Error("DB connection failed"));

    const res = await POST(createRequest({ jobType: "daily" }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toContain("DB connection failed");
  });

  it("エラー後もロックが解放される", async () => {
    mockGetSession.mockResolvedValue(mockUsers.admin);
    mockRunDailyJob.mockRejectedValue(new Error("fail"));

    await POST(createRequest({ jobType: "daily" }));

    // ロックが解放されていること = 再度実行可能
    mockRunDailyJob.mockResolvedValue({ ok: true });
    const res = await POST(createRequest({ jobType: "daily" }));
    expect(res.status).toBe(200);
  });
});
