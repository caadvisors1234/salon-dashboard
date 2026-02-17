import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { mockUsers } from "@/test/helpers/mock-auth";

// モック: auth/guards
const mockGetSession = vi.fn();
vi.mock("@/lib/auth/guards", () => ({
  getSession: () => mockGetSession(),
}));

// モック: auth/access
const mockCheckLocationAccess = vi.fn();
vi.mock("@/lib/auth/access", () => ({
  checkLocationAccess: (...args: unknown[]) =>
    mockCheckLocationAccess(...args),
}));

// モック: dashboard/queries
const mockGetMetricsTimeSeries = vi.fn();
const mockGetDeviceBreakdown = vi.fn();
vi.mock("@/lib/dashboard/queries", () => ({
  getMetricsTimeSeries: (...args: unknown[]) =>
    mockGetMetricsTimeSeries(...args),
  getDeviceBreakdown: (...args: unknown[]) => mockGetDeviceBreakdown(...args),
}));

import { GET } from "./route";

function createRequest(params: Record<string, string>): NextRequest {
  const url = new URL("http://localhost:3000/api/dashboard/metrics");
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return new NextRequest(url);
}

describe("GET /api/dashboard/metrics", () => {
  beforeEach(() => {
    mockGetSession.mockReset();
    mockCheckLocationAccess.mockReset();
    mockGetMetricsTimeSeries.mockReset();
    mockGetDeviceBreakdown.mockReset();
  });

  it("401: 未認証", async () => {
    mockGetSession.mockResolvedValue(null);
    const res = await GET(createRequest({}));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("400: パラメータ不足（locationId なし）", async () => {
    mockGetSession.mockResolvedValue(mockUsers.admin);
    const res = await GET(
      createRequest({ startMonth: "2025-01", endMonth: "2025-03" })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Missing parameters");
  });

  it("400: パラメータ不足（startMonth なし）", async () => {
    mockGetSession.mockResolvedValue(mockUsers.admin);
    const res = await GET(
      createRequest({ locationId: "loc-001", endMonth: "2025-03" })
    );
    expect(res.status).toBe(400);
  });

  it("403: アクセス権なし", async () => {
    mockGetSession.mockResolvedValue(mockUsers.client);
    mockCheckLocationAccess.mockResolvedValue(false);

    const res = await GET(
      createRequest({
        locationId: "loc-999",
        startMonth: "2025-01",
        endMonth: "2025-03",
      })
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("Forbidden");
  });

  it("200: 正常レスポンス", async () => {
    mockGetSession.mockResolvedValue(mockUsers.admin);
    mockCheckLocationAccess.mockResolvedValue(true);
    mockGetMetricsTimeSeries.mockResolvedValue([
      { date: "2025-01-01", value: 100 },
    ]);
    mockGetDeviceBreakdown.mockResolvedValue([
      { device: "DESKTOP_SEARCH", value: 50 },
    ]);

    const res = await GET(
      createRequest({
        locationId: "loc-001",
        startMonth: "2025-01",
        endMonth: "2025-03",
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.timeSeries).toEqual([{ date: "2025-01-01", value: 100 }]);
    expect(body.deviceBreakdown).toEqual([
      { device: "DESKTOP_SEARCH", value: 50 },
    ]);
    expect(body.deviceMonthLabel).toBe("2025年3月");
  });

  it("queries に正しいパラメータを渡す", async () => {
    mockGetSession.mockResolvedValue(mockUsers.admin);
    mockCheckLocationAccess.mockResolvedValue(true);
    mockGetMetricsTimeSeries.mockResolvedValue([]);
    mockGetDeviceBreakdown.mockResolvedValue([]);

    await GET(
      createRequest({
        locationId: "loc-001",
        startMonth: "2025-01",
        endMonth: "2025-06",
      })
    );

    expect(mockGetMetricsTimeSeries).toHaveBeenCalledWith(
      "loc-001",
      "2025-01",
      "2025-06"
    );
    expect(mockGetDeviceBreakdown).toHaveBeenCalledWith("loc-001", "2025-06");
  });
});
