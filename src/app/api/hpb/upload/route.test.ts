import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { mockUsers } from "@/test/helpers/mock-auth";
import fs from "fs";
import path from "path";

const mockGetSession = vi.fn();
vi.mock("@/lib/auth/guards", () => ({
  getSession: () => mockGetSession(),
}));

// Supabase server client モック
const mockFromChain = vi.fn();
const mockStorageUpload = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    from: (...args: unknown[]) => mockFromChain(...args),
    storage: {
      from: () => ({
        upload: (...args: unknown[]) => mockStorageUpload(...args),
      }),
    },
  }),
}));

import { POST } from "./route";

/** from() チェーンのヘルパー */
function createChain(result: { data: unknown; error?: unknown }) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  const methods = [
    "select",
    "insert",
    "update",
    "upsert",
    "eq",
    "in",
    "single",
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

function createUploadRequest(options: {
  file?: File | null;
  locationId?: string | null;
  overwrite?: string;
}): NextRequest {
  const formData = new FormData();
  if (options.file) {
    formData.append("file", options.file);
  }
  if (options.locationId) {
    formData.append("locationId", options.locationId);
  }
  if (options.overwrite) {
    formData.append("overwrite", options.overwrite);
  }

  return new NextRequest("http://localhost:3000/api/hpb/upload", {
    method: "POST",
    body: formData,
  });
}

const fixturesDir = path.resolve(__dirname, "../../../../../test/fixtures");

function createCsvFile(name: string = "hpb-test.csv"): File {
  const buffer = fs.readFileSync(path.join(fixturesDir, name));
  return new File([buffer], name, { type: "text/csv" });
}

describe("POST /api/hpb/upload", () => {
  beforeEach(() => {
    mockGetSession.mockReset();
    mockFromChain.mockReset();
    mockStorageUpload.mockReset();
    mockStorageUpload.mockResolvedValue({ data: { path: "test-path" }, error: null });
  });

  it("401: 未認証", async () => {
    mockGetSession.mockResolvedValue(null);
    const res = await POST(
      createUploadRequest({ file: createCsvFile(), locationId: "loc-001" })
    );
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  it("403: client ロール", async () => {
    mockGetSession.mockResolvedValue(mockUsers.client);
    const res = await POST(
      createUploadRequest({ file: createCsvFile(), locationId: "loc-001" })
    );
    expect(res.status).toBe(403);
  });

  it("400: ファイルなし", async () => {
    mockGetSession.mockResolvedValue(mockUsers.admin);
    const res = await POST(createUploadRequest({ locationId: "loc-001" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("CSVファイル");
  });

  it("400: locationId なし", async () => {
    mockGetSession.mockResolvedValue(mockUsers.admin);
    const res = await POST(createUploadRequest({ file: createCsvFile() }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("店舗");
  });

  it("400: 非CSVファイル", async () => {
    mockGetSession.mockResolvedValue(mockUsers.admin);
    const txtFile = new File(["hello"], "test.txt", { type: "text/plain" });
    const res = await POST(
      createUploadRequest({ file: txtFile, locationId: "loc-001" })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("CSV");
  });

  it("404: 店舗が見つからない", async () => {
    mockGetSession.mockResolvedValue(mockUsers.admin);
    mockFromChain.mockReturnValue(
      createChain({ data: null, error: { message: "not found" } })
    );

    const res = await POST(
      createUploadRequest({ file: createCsvFile(), locationId: "loc-999" })
    );
    expect(res.status).toBe(404);
  });

  it("400: CSVパースエラー（UTF-8）", async () => {
    mockGetSession.mockResolvedValue(mockUsers.admin);
    // locations テーブルクエリ
    mockFromChain.mockReturnValue(
      createChain({
        data: { id: "loc-001", org_id: "org-001", name: "テスト店舗" },
      })
    );

    const res = await POST(
      createUploadRequest({
        file: createCsvFile("hpb-test-utf8.csv"),
        locationId: "loc-001",
      })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toContain("対象年月");
  });

  it("200: 正常アップロード（admin）", async () => {
    mockGetSession.mockResolvedValue(mockUsers.admin);

    // locations → 正常
    const locChain = createChain({
      data: { id: "loc-001", org_id: "org-001", name: "テスト店舗" },
    });

    // hpb_monthly_metrics → 重複なし
    const metricsCheckChain = createChain({ data: [] });

    // upsert → 成功
    const upsertChain = createChain({ data: null, error: undefined });

    // upload_logs → 成功
    const logChain = createChain({ data: null });

    mockFromChain
      .mockReturnValueOnce(locChain) // locations
      .mockReturnValueOnce(metricsCheckChain) // hpb_monthly_metrics (重複チェック)
      .mockReturnValueOnce(upsertChain) // hpb_monthly_metrics (upsert)
      .mockReturnValueOnce(logChain); // hpb_upload_logs

    const res = await POST(
      createUploadRequest({ file: createCsvFile(), locationId: "loc-001" })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.recordCount).toBe(4);
    expect(body.data.skippedRows).toBe(1);
  });

  it("200: staff ロールでもアップロード可能", async () => {
    mockGetSession.mockResolvedValue(mockUsers.staff);

    const locChain = createChain({
      data: { id: "loc-001", org_id: "org-001", name: "テスト店舗" },
    });
    const metricsCheckChain = createChain({ data: [] });
    const upsertChain = createChain({ data: null, error: undefined });
    const logChain = createChain({ data: null });

    mockFromChain
      .mockReturnValueOnce(locChain)
      .mockReturnValueOnce(metricsCheckChain)
      .mockReturnValueOnce(upsertChain)
      .mockReturnValueOnce(logChain);

    const res = await POST(
      createUploadRequest({ file: createCsvFile(), locationId: "loc-001" })
    );
    expect(res.status).toBe(200);
  });
});
