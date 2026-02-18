import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { mockUsers } from "@/test/helpers/mock-auth";

// 認証モック
const mockGetSession = vi.fn();
vi.mock("@/lib/auth/guards", () => ({
  getSession: () => mockGetSession(),
}));

// cookies モック
const mockCookieGet = vi.fn();
const mockCookieDelete = vi.fn();
vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    get: (...args: unknown[]) => mockCookieGet(...args),
    delete: (...args: unknown[]) => mockCookieDelete(...args),
  }),
}));

// OAuth モジュールモック
const mockExchangeCodeForTokens = vi.fn();
const mockGetUserInfo = vi.fn();
vi.mock("@/lib/gbp/oauth", () => ({
  exchangeCodeForTokens: (...args: unknown[]) =>
    mockExchangeCodeForTokens(...args),
  getUserInfo: (...args: unknown[]) => mockGetUserInfo(...args),
}));

// トークンストアモック
const mockSaveOAuthTokens = vi.fn();
vi.mock("@/lib/gbp/token-store", () => ({
  saveOAuthTokens: (...args: unknown[]) => mockSaveOAuthTokens(...args),
}));

// GBP アカウントモック
const mockFetchAndSaveGbpAccounts = vi.fn();
vi.mock("@/lib/gbp/accounts", () => ({
  fetchAndSaveGbpAccounts: (...args: unknown[]) =>
    mockFetchAndSaveGbpAccounts(...args),
}));

import { GET } from "./route";

const APP_URL = "http://localhost:3000";

function createCallbackRequest(params: Record<string, string>): NextRequest {
  const url = new URL("/api/oauth/google/callback", APP_URL);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return new NextRequest(url);
}

describe("GET /api/oauth/google/callback", () => {
  beforeEach(() => {
    mockGetSession.mockReset();
    mockCookieGet.mockReset();
    mockCookieDelete.mockReset();
    mockExchangeCodeForTokens.mockReset();
    mockGetUserInfo.mockReset();
    mockSaveOAuthTokens.mockReset();
    mockFetchAndSaveGbpAccounts.mockReset();

    // NEXT_PUBLIC_APP_URL を設定
    process.env.NEXT_PUBLIC_APP_URL = APP_URL;
  });

  it("未認証→ /login にリダイレクト", async () => {
    mockGetSession.mockResolvedValue(null);
    const res = await GET(createCallbackRequest({ code: "abc", state: "xyz" }));
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/login");
  });

  it("非admin → /login にリダイレクト", async () => {
    mockGetSession.mockResolvedValue(mockUsers.staff);
    const res = await GET(createCallbackRequest({ code: "abc", state: "xyz" }));
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/login");
  });

  it("error パラメータ → oauth_error リダイレクト", async () => {
    mockGetSession.mockResolvedValue(mockUsers.admin);
    const res = await GET(
      createCallbackRequest({ error: "access_denied" })
    );
    expect(res.status).toBe(307);
    const redirectUrl = new URL(res.headers.get("location")!);
    expect(redirectUrl.searchParams.get("oauth_error")).toBe("access_denied");
  });

  it("code/state なし → missing_params", async () => {
    mockGetSession.mockResolvedValue(mockUsers.admin);
    const res = await GET(createCallbackRequest({}));
    expect(res.status).toBe(307);
    const redirectUrl = new URL(res.headers.get("location")!);
    expect(redirectUrl.searchParams.get("oauth_error")).toBe("missing_params");
  });

  it("state 不一致 → invalid_state", async () => {
    mockGetSession.mockResolvedValue(mockUsers.admin);
    mockCookieGet.mockReturnValue({ value: "saved-state" });

    const res = await GET(
      createCallbackRequest({ code: "abc", state: "wrong-state" })
    );
    expect(res.status).toBe(307);
    const redirectUrl = new URL(res.headers.get("location")!);
    expect(redirectUrl.searchParams.get("oauth_error")).toBe("invalid_state");
  });

  it("正常フロー: トークン交換→保存→oauth_success", async () => {
    mockGetSession.mockResolvedValue(mockUsers.admin);
    mockCookieGet.mockReturnValue({ value: "valid-state" });
    mockExchangeCodeForTokens.mockResolvedValue({
      accessToken: "at-123",
      refreshToken: "rt-456",
      expiryDate: new Date().toISOString(),
      scopes: ["business.manage"],
    });
    mockGetUserInfo.mockResolvedValue({ email: "user@gmail.com" });
    mockSaveOAuthTokens.mockResolvedValue("token-id-1");
    mockFetchAndSaveGbpAccounts.mockResolvedValue(undefined);

    const res = await GET(
      createCallbackRequest({ code: "auth-code", state: "valid-state" })
    );
    expect(res.status).toBe(307);
    const redirectUrl = new URL(res.headers.get("location")!);
    expect(redirectUrl.searchParams.get("oauth_success")).toBe("true");
    expect(mockSaveOAuthTokens).toHaveBeenCalledWith(
      mockUsers.admin.id,
      expect.objectContaining({ accessToken: "at-123" })
    );
  });

  it("トークン交換失敗 → token_exchange_failed", async () => {
    mockGetSession.mockResolvedValue(mockUsers.admin);
    mockCookieGet.mockReturnValue({ value: "valid-state" });
    mockExchangeCodeForTokens.mockRejectedValue(new Error("invalid_grant"));

    const res = await GET(
      createCallbackRequest({ code: "bad-code", state: "valid-state" })
    );
    expect(res.status).toBe(307);
    const redirectUrl = new URL(res.headers.get("location")!);
    expect(redirectUrl.searchParams.get("oauth_error")).toBe(
      "token_exchange_failed"
    );
  });

  it("GBPアカウント取得失敗は非致命的", async () => {
    mockGetSession.mockResolvedValue(mockUsers.admin);
    mockCookieGet.mockReturnValue({ value: "valid-state" });
    mockExchangeCodeForTokens.mockResolvedValue({
      accessToken: "at-123",
      refreshToken: "rt-456",
      expiryDate: new Date().toISOString(),
      scopes: ["business.manage"],
    });
    mockGetUserInfo.mockResolvedValue({ email: "user@gmail.com" });
    mockSaveOAuthTokens.mockResolvedValue("token-id-1");
    // GBPアカウント取得が失敗
    mockFetchAndSaveGbpAccounts.mockRejectedValue(
      new Error("GBP API error")
    );

    const res = await GET(
      createCallbackRequest({ code: "auth-code", state: "valid-state" })
    );
    // エラーでもリダイレクトは成功
    expect(res.status).toBe(307);
    const redirectUrl = new URL(res.headers.get("location")!);
    expect(redirectUrl.searchParams.get("oauth_success")).toBe("true");
  });
});
