import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockUsers } from "@/test/helpers/mock-auth";

// 認証モック
const mockGetSession = vi.fn();
vi.mock("@/lib/auth/guards", () => ({
  getSession: () => mockGetSession(),
}));

// PDF キューモック
const mockGetStatus = vi.fn();
vi.mock("@/lib/pdf/queue", () => ({
  pdfQueue: {
    getStatus: () => mockGetStatus(),
  },
}));

import { GET } from "./route";

describe("GET /api/reports/queue-status", () => {
  beforeEach(() => {
    mockGetSession.mockReset();
    mockGetStatus.mockReset();
  });

  it("401: 未認証", async () => {
    mockGetSession.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it("200: キュー状態JSON返却", async () => {
    mockGetSession.mockResolvedValue(mockUsers.admin);
    mockGetStatus.mockReturnValue({ running: 1, waiting: 3 });

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ success: true, data: { running: 1, waiting: 3 } });
  });

  it("200: キュー空の状態", async () => {
    mockGetSession.mockResolvedValue(mockUsers.staff);
    mockGetStatus.mockReturnValue({ running: 0, waiting: 0 });

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ success: true, data: { running: 0, waiting: 0 } });
  });
});
