import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ./token-store モック
const mockGetValidAccessToken = vi.fn();
const mockInvalidateToken = vi.fn();
const mockGetStoredToken = vi.fn();
vi.mock("./token-store", () => ({
  getValidAccessToken: (...args: unknown[]) => mockGetValidAccessToken(...args),
  invalidateToken: (...args: unknown[]) => mockInvalidateToken(...args),
  getStoredToken: (...args: unknown[]) => mockGetStoredToken(...args),
}));

// ./oauth モック
const mockRefreshAccessToken = vi.fn();
vi.mock("./oauth", () => ({
  refreshAccessToken: (...args: unknown[]) => mockRefreshAccessToken(...args),
}));

// fetch モック
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { GbpApiClient, createGbpClient } from "./client";

// ヘルパー: 成功レスポンスを生成
function jsonResponse(data: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Error",
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
    headers: new Headers(),
  } as unknown as Response;
}

// ヘルパー: エラーレスポンスを生成
function errorResponse(status: number, body = "error"): Response {
  return {
    ok: false,
    status,
    statusText: "Error",
    json: () => Promise.resolve({ error: body }),
    text: () => Promise.resolve(body),
    headers: new Headers(),
  } as unknown as Response;
}

// モジュールレベルの lastRequestTime はテスト間でリセットされないため、
// 各テストの開始時刻を十分先に設定してスロットル（300ms）をバイパスする。
let timeBase = 1_000_000_000_000;

describe("GbpApiClient", () => {
  beforeEach(() => {
    timeBase += 1_000_000;
    vi.useFakeTimers({ shouldAdvanceTime: true, now: timeBase });
    mockGetValidAccessToken.mockReset();
    mockInvalidateToken.mockReset();
    mockGetStoredToken.mockReset();
    mockRefreshAccessToken.mockReset();
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("request - 正常系", () => {
    it("成功レスポンス → パース済みJSONを返す", async () => {
      mockGetValidAccessToken.mockResolvedValue("valid-token");
      mockFetch.mockResolvedValue(jsonResponse({ name: "Test Location" }));

      const client = new GbpApiClient();
      const result = await client.request<{ name: string }>(
        "https://mybusinessbusinessinformation.googleapis.com/v1/accounts"
      );

      expect(result).toEqual({ name: "Test Location" });
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://mybusinessbusinessinformation.googleapis.com/v1/accounts",
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer valid-token",
            "Content-Type": "application/json",
          }),
        })
      );
    });
  });

  describe("request - 429 リトライ", () => {
    it("429レスポンス → バックオフリトライ後に成功", async () => {
      mockGetValidAccessToken.mockResolvedValue("valid-token");
      mockFetch
        .mockResolvedValueOnce(errorResponse(429, "Rate limited"))
        .mockResolvedValueOnce(jsonResponse({ data: "ok" }));

      const client = new GbpApiClient();
      const promise = client.request<{ data: string }>("https://api.example.com/test");

      // バックオフタイマーを進める（attempt 0: 1000ms + スロットル300ms）
      await vi.advanceTimersByTimeAsync(2000);

      const result = await promise;
      expect(result).toEqual({ data: "ok" });
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe("request - 401 トークンリフレッシュ", () => {
    it("401 → トークンリフレッシュ成功 → リトライ成功", async () => {
      // フロー:
      //   attempt 0: getAccessToken() → getValidAccessToken() #1 → "expired-token"
      //   fetch → 401
      //   forceRefreshToken() → getValidAccessToken() #2 → "refreshed-token" (null check通過)
      //   continue → attempt 1:
      //   getAccessToken() → this.accessToken is null → getValidAccessToken() #3 → "refreshed-token"
      //   fetch → 200 成功
      mockGetValidAccessToken
        .mockResolvedValueOnce("expired-token")    // #1: 初回getAccessToken
        .mockResolvedValueOnce("refreshed-token")   // #2: forceRefreshToken
        .mockResolvedValueOnce("refreshed-token");  // #3: リトライ時のgetAccessToken
      mockFetch
        .mockResolvedValueOnce(errorResponse(401, "Unauthorized"))
        .mockResolvedValueOnce(jsonResponse({ refreshed: true }));

      const client = new GbpApiClient();
      const promise = client.request<{ refreshed: boolean }>("https://api.example.com/test");

      await vi.advanceTimersByTimeAsync(5000);

      const result = await promise;
      expect(result).toEqual({ refreshed: true });
      expect(mockGetValidAccessToken).toHaveBeenCalledTimes(3);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("401 → トークンリフレッシュ失敗 → エラーをスロー", async () => {
      // フロー:
      //   attempt 0: getAccessToken() → "expired-token" → fetch → 401
      //   forceRefreshToken() → null → invalidateToken → throw "OAuth token is invalid..."
      //   catch: "OAuth token is invalid" を含むため sleep せずに次の attempt へ
      //   attempt 1~3: getAccessToken() → null → throw "No valid OAuth token available..."
      //   catch: "OAuth token is invalid" を含まないため sleep + continue（最終 attempt は再スロー）
      //   最終的に "No valid OAuth token available..." でスロー
      mockGetValidAccessToken
        .mockResolvedValueOnce("expired-token") // #1: 初回getAccessToken
        .mockResolvedValue(null);                // #2以降: 全て null
      mockGetStoredToken.mockResolvedValue({ id: "token-123" });
      mockInvalidateToken.mockResolvedValue(undefined);
      mockFetch.mockResolvedValueOnce(errorResponse(401, "Unauthorized"));

      const client = new GbpApiClient();
      const promise = client.request("https://api.example.com/test");
      // タイマー進行中の未処理リジェクションを防止
      promise.catch(() => {});

      // 全リトライのバックオフを進める
      await vi.advanceTimersByTimeAsync(30000);

      await expect(promise).rejects.toThrow("Please reconnect Google account.");
      // invalidateToken は最初の401処理で呼ばれる
      expect(mockInvalidateToken).toHaveBeenCalledWith("token-123");
    });
  });

  describe("request - 500 リトライ上限超過", () => {
    it("500エラーが継続 → MAX_RETRIES超過で最終エラーをスロー", async () => {
      mockGetValidAccessToken.mockResolvedValue("valid-token");
      // 初回 + 3回リトライ = 4回全て500
      mockFetch.mockResolvedValue(errorResponse(500, "Internal Server Error"));

      const client = new GbpApiClient();
      const promise = client.request("https://api.example.com/test");
      // タイマー進行中の未処理リジェクションを防止
      promise.catch(() => {});

      // 全バックオフタイマーを十分に進める
      await vi.advanceTimersByTimeAsync(15000);

      await expect(promise).rejects.toThrow(
        "GBP API error: 500 Error - Internal Server Error"
      );
      expect(mockFetch).toHaveBeenCalledTimes(4);
    });
  });

  describe("get / post ヘルパーメソッド", () => {
    it("get() → GETメソッドでリクエストを送信", async () => {
      mockGetValidAccessToken.mockResolvedValue("valid-token");
      mockFetch.mockResolvedValue(jsonResponse({ items: [] }));

      const client = new GbpApiClient();
      const promise = client.get<{ items: unknown[] }>("https://api.example.com/list");
      await vi.advanceTimersByTimeAsync(1000);

      const result = await promise;
      expect(result).toEqual({ items: [] });
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.example.com/list",
        expect.objectContaining({ method: "GET" })
      );
    });

    it("post() → POSTメソッドとJSON本文でリクエストを送信", async () => {
      mockGetValidAccessToken.mockResolvedValue("valid-token");
      mockFetch.mockResolvedValue(jsonResponse({ created: true }));

      const client = new GbpApiClient();
      const body = { name: "New Location" };
      const promise = client.post<{ created: boolean }>(
        "https://api.example.com/create",
        body
      );
      await vi.advanceTimersByTimeAsync(1000);

      const result = await promise;
      expect(result).toEqual({ created: true });
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.example.com/create",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify(body),
        })
      );
    });
  });

  describe("createGbpClient", () => {
    it("GbpApiClientインスタンスを返す", () => {
      const client = createGbpClient();
      expect(client).toBeInstanceOf(GbpApiClient);
    });
  });
});
