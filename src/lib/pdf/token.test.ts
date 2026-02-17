import { describe, it, expect } from "vitest";
import { createReportToken, verifyReportToken } from "./token";
import type { ReportTokenScope } from "./token";

describe("createReportToken / verifyReportToken", () => {
  it("store スコープのラウンドトリップ", async () => {
    const scope: ReportTokenScope = { type: "store", locationId: "loc-001" };
    const token = await createReportToken("user-001", scope);
    const payload = await verifyReportToken(token);

    expect(payload.userId).toBe("user-001");
    expect(payload.scope).toEqual(scope);
  });

  it("client スコープのラウンドトリップ", async () => {
    const scope: ReportTokenScope = { type: "client", orgId: "org-001" };
    const token = await createReportToken("user-002", scope);
    const payload = await verifyReportToken(token);

    expect(payload.userId).toBe("user-002");
    expect(payload.scope).toEqual(scope);
  });

  it("トークンは文字列", async () => {
    const token = await createReportToken("user-001", {
      type: "store",
      locationId: "loc-001",
    });
    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(0);
  });

  it("改ざんされたトークンは検証失敗", async () => {
    const token = await createReportToken("user-001", {
      type: "store",
      locationId: "loc-001",
    });
    const tampered = token.slice(0, -5) + "XXXXX";

    await expect(verifyReportToken(tampered)).rejects.toThrow();
  });

  it("完全に不正なトークンは検証失敗", async () => {
    await expect(verifyReportToken("not-a-jwt")).rejects.toThrow();
  });

  it("REPORT_TOKEN_SECRET が未設定なら createReportToken がエラー", async () => {
    const original = process.env.REPORT_TOKEN_SECRET;
    delete process.env.REPORT_TOKEN_SECRET;

    try {
      await expect(
        createReportToken("user-001", { type: "store", locationId: "loc-001" })
      ).rejects.toThrow("REPORT_TOKEN_SECRET");
    } finally {
      process.env.REPORT_TOKEN_SECRET = original;
    }
  });
});
