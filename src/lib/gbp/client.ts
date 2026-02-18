import { getValidAccessToken, invalidateToken, getStoredToken } from "./token-store";
import { refreshAccessToken } from "./oauth";
import { sleep } from "@/lib/utils";
import { createLogger } from "@/lib/logger";

const log = createLogger("GBPClient");

// ============================================
// GBP API クライアント
// ============================================

const MIN_REQUEST_INTERVAL_MS = 300; // 200 QPM 以下を維持
const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000;

let lastRequestTime = 0;

async function throttle(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < MIN_REQUEST_INTERVAL_MS) {
    await new Promise((resolve) =>
      setTimeout(resolve, MIN_REQUEST_INTERVAL_MS - elapsed)
    );
  }
  lastRequestTime = Date.now();
}

export class GbpApiClient {
  private accessToken: string | null = null;

  /**
   * 有効なアクセストークンを取得する（キャッシュ＋自動リフレッシュ）
   */
  private async getAccessToken(): Promise<string> {
    if (!this.accessToken) {
      this.accessToken = await getValidAccessToken(refreshAccessToken);
    }
    if (!this.accessToken) {
      throw new Error("No valid OAuth token available. Please reconnect Google account.");
    }
    return this.accessToken;
  }

  /**
   * トークンリフレッシュを強制実行する
   */
  private async forceRefreshToken(): Promise<string | null> {
    this.accessToken = null;
    return getValidAccessToken(refreshAccessToken);
  }

  /**
   * 認証済み HTTP リクエストを送信する。
   * レート制限、リトライ、トークンリフレッシュを自動で処理する。
   */
  async request<T>(
    url: string,
    options: RequestInit = {}
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      await throttle();

      try {
        const token = await this.getAccessToken();

        const response = await fetch(url, {
          ...options,
          headers: {
            ...options.headers,
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        // 401: トークンリフレッシュを試みて再リクエスト（初回のみ）
        if (response.status === 401 && attempt === 0) {
          log.warn("401 received, attempting token refresh");
          const newToken = await this.forceRefreshToken();
          if (!newToken) {
            // リフレッシュ失敗 → トークン失効
            const storedToken = await getStoredToken();
            if (storedToken) {
              await invalidateToken(storedToken.id);
            }
            throw new Error("OAuth token is invalid. Please reconnect Google account.");
          }
          // リフレッシュ成功 → リトライ（for ループにより attempt がインクリメントされるため、2回目の 401 ではリフレッシュしない）
          continue;
        }

        // 429 / 5xx: 指数バックオフでリトライ
        if ((response.status === 429 || response.status >= 500) && attempt < MAX_RETRIES) {
          const backoffMs = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
          log.warn(
            { status: response.status, backoffMs, attempt: attempt + 1, maxRetries: MAX_RETRIES },
            `${response.status} received, retrying`
          );
          await sleep(backoffMs);
          continue;
        }

        if (!response.ok) {
          const errorBody = await response.text();
          throw new Error(
            `GBP API error: ${response.status} ${response.statusText} - ${errorBody}`
          );
        }

        return await response.json() as T;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));

        // ネットワークエラー等の場合もリトライ
        if (attempt < MAX_RETRIES && !lastError.message.includes("OAuth token is invalid")) {
          const backoffMs = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
          log.warn(
            { err: lastError, backoffMs, attempt: attempt + 1, maxRetries: MAX_RETRIES },
            `Error, retrying`
          );
          await sleep(backoffMs);
          continue;
        }
      }
    }

    throw lastError || new Error("GBP API request failed after all retries");
  }

  /**
   * GET リクエスト
   */
  async get<T>(url: string): Promise<T> {
    return this.request<T>(url, { method: "GET" });
  }

  /**
   * POST リクエスト
   */
  async post<T>(url: string, body: unknown): Promise<T> {
    return this.request<T>(url, {
      method: "POST",
      body: JSON.stringify(body),
    });
  }
}

/**
 * GBP API クライアントのインスタンスを作成する。
 * リクエストごとに新しいインスタンスを生成する。
 * スロットリングはモジュールレベルで共有される。
 */
export function createGbpClient(): GbpApiClient {
  return new GbpApiClient();
}
