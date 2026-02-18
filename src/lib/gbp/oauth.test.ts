import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GBP_API } from "./types";

// OAuth環境変数をbeforeEachで設定
beforeEach(() => {
  process.env.GOOGLE_CLIENT_ID = "test-client-id";
  process.env.GOOGLE_CLIENT_SECRET = "test-secret";
  process.env.GOOGLE_REDIRECT_URI =
    "http://localhost:3000/api/gbp/oauth/callback";
  process.env.GOOGLE_OAUTH_SCOPES = "openid email profile";
});

afterEach(() => {
  vi.useRealTimers();
});

import {
  generateState,
  getAuthorizationUrl,
  exchangeCodeForTokens,
  refreshAccessToken,
  getUserInfo,
} from "./oauth";

// ============================================
// fetchモック用ヘルパー
// ============================================

function mockFetchResponse(body: unknown, ok = true, status = 200) {
  const mockFetch = vi.fn().mockResolvedValue({
    ok,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(typeof body === "string" ? body : JSON.stringify(body)),
  });
  vi.stubGlobal("fetch", mockFetch);
  return mockFetch;
}

// ============================================
// generateState
// ============================================

describe("generateState", () => {
  it("64文字の16進数文字列を返す", () => {
    const state = generateState();
    expect(state).toHaveLength(64);
    expect(state).toMatch(/^[0-9a-f]{64}$/);
  });
});

// ============================================
// getAuthorizationUrl
// ============================================

describe("getAuthorizationUrl", () => {
  it("正しいパラメータ付きのURLを構築する", () => {
    const state = "test-state-value";
    const url = getAuthorizationUrl(state);

    expect(url).toContain(GBP_API.OAUTH_AUTH_URL);

    const parsed = new URL(url);
    expect(parsed.searchParams.get("client_id")).toBe("test-client-id");
    expect(parsed.searchParams.get("redirect_uri")).toBe(
      "http://localhost:3000/api/gbp/oauth/callback"
    );
    expect(parsed.searchParams.get("response_type")).toBe("code");
    expect(parsed.searchParams.get("scope")).toBe("openid email profile");
    expect(parsed.searchParams.get("state")).toBe("test-state-value");
    expect(parsed.searchParams.get("access_type")).toBe("offline");
    expect(parsed.searchParams.get("prompt")).toBe("consent");
  });
});

// ============================================
// exchangeCodeForTokens
// ============================================

describe("exchangeCodeForTokens", () => {
  it("成功時にトークン情報を返す", async () => {
    const now = Date.now();
    vi.setSystemTime(now);

    mockFetchResponse({
      access_token: "access-123",
      refresh_token: "refresh-456",
      expires_in: 3600,
      scope: "openid email profile",
    });

    const result = await exchangeCodeForTokens("auth-code-789");

    expect(result.accessToken).toBe("access-123");
    expect(result.refreshToken).toBe("refresh-456");
    expect(result.expiryDate).toEqual(new Date(now + 3600 * 1000));
    expect(result.scopes).toBe("openid email profile");

    // fetchが正しいエンドポイントとパラメータで呼ばれたことを確認
    expect(fetch).toHaveBeenCalledWith(GBP_API.OAUTH_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: expect.any(URLSearchParams),
    });

    const callBody = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body as URLSearchParams;
    expect(callBody.get("code")).toBe("auth-code-789");
    expect(callBody.get("client_id")).toBe("test-client-id");
    expect(callBody.get("client_secret")).toBe("test-secret");
    expect(callBody.get("grant_type")).toBe("authorization_code");
  });

  it("レスポンスがエラーの場合に例外を投げる", async () => {
    mockFetchResponse("Bad Request: invalid code", false, 400);

    await expect(exchangeCodeForTokens("bad-code")).rejects.toThrow(
      "Token exchange failed: Bad Request: invalid code"
    );
  });

  it("refresh_tokenが含まれない場合に例外を投げる", async () => {
    mockFetchResponse({
      access_token: "access-123",
      expires_in: 3600,
      scope: "openid email profile",
      // refresh_token がない
    });

    await expect(exchangeCodeForTokens("code-no-refresh")).rejects.toThrow(
      "No refresh_token received. Ensure prompt=consent and access_type=offline are set."
    );
  });
});

// ============================================
// refreshAccessToken
// ============================================

describe("refreshAccessToken", () => {
  it("成功時に新しいアクセストークンと有効期限を返す", async () => {
    const now = Date.now();
    vi.setSystemTime(now);

    mockFetchResponse({
      access_token: "new-access-token",
      expires_in: 7200,
    });

    const result = await refreshAccessToken("my-refresh-token");

    expect(result.accessToken).toBe("new-access-token");
    expect(result.expiryDate).toEqual(new Date(now + 7200 * 1000));

    // fetchが正しいパラメータで呼ばれたことを確認
    const callBody = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body as URLSearchParams;
    expect(callBody.get("refresh_token")).toBe("my-refresh-token");
    expect(callBody.get("grant_type")).toBe("refresh_token");
  });

  it("レスポンスがエラーの場合に例外を投げる", async () => {
    mockFetchResponse("Token has been revoked", false, 401);

    await expect(refreshAccessToken("revoked-token")).rejects.toThrow(
      "Token refresh failed: Token has been revoked"
    );
  });
});

// ============================================
// getUserInfo
// ============================================

describe("getUserInfo", () => {
  it("成功時にユーザー情報を返す", async () => {
    mockFetchResponse({
      email: "user@example.com",
      name: "Test User",
    });

    const result = await getUserInfo("valid-access-token");

    expect(result.email).toBe("user@example.com");
    expect(result.name).toBe("Test User");

    // Authorizationヘッダーが正しく設定されていることを確認
    expect(fetch).toHaveBeenCalledWith(GBP_API.USERINFO_URL, {
      headers: { Authorization: "Bearer valid-access-token" },
    });
  });

  it("レスポンスがエラーの場合に例外を投げる", async () => {
    mockFetchResponse("Unauthorized", false, 401);

    await expect(getUserInfo("expired-token")).rejects.toThrow(
      "Failed to fetch user info"
    );
  });
});

// ============================================
// 環境変数の欠落
// ============================================

describe("環境変数が未設定の場合", () => {
  it("GOOGLE_CLIENT_IDが未設定の場合に例外を投げる", () => {
    delete process.env.GOOGLE_CLIENT_ID;

    expect(() => getAuthorizationUrl("state")).toThrow(
      "Google OAuth environment variables are not configured"
    );
  });

  it("GOOGLE_CLIENT_SECRETが未設定の場合に例外を投げる", async () => {
    delete process.env.GOOGLE_CLIENT_SECRET;

    mockFetchResponse({});
    await expect(
      exchangeCodeForTokens("code")
    ).rejects.toThrow(
      "Google OAuth environment variables are not configured"
    );
  });

  it("GOOGLE_REDIRECT_URIが未設定の場合に例外を投げる", () => {
    delete process.env.GOOGLE_REDIRECT_URI;

    expect(() => getAuthorizationUrl("state")).toThrow(
      "Google OAuth environment variables are not configured"
    );
  });

  it("GOOGLE_OAUTH_SCOPESが未設定の場合に例外を投げる", () => {
    delete process.env.GOOGLE_OAUTH_SCOPES;

    expect(() => getAuthorizationUrl("state")).toThrow(
      "Google OAuth environment variables are not configured"
    );
  });
});
