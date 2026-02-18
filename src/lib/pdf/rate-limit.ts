const DEFAULT_MAX_REQUESTS = 5;
const DEFAULT_WINDOW_MS = 60 * 60 * 1000; // 1時間

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export class UserRateLimit {
  private limits = new Map<string, RateLimitEntry>();
  private maxRequests: number;
  private windowMs: number;

  constructor(maxRequests = DEFAULT_MAX_REQUESTS, windowMs = DEFAULT_WINDOW_MS) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  check(userId: string): RateLimitResult {
    const now = Date.now();

    // 期限切れエントリを定期的にクリーンアップ（100エントリ超過時）
    if (this.limits.size > 100) {
      this.cleanup(now);
    }

    const entry = this.limits.get(userId);

    // ウィンドウ期限切れまたは初回 → リセット
    if (!entry || now >= entry.resetAt) {
      const resetAt = now + this.windowMs;
      this.limits.set(userId, { count: 1, resetAt });
      return { allowed: true, remaining: this.maxRequests - 1, resetAt };
    }

    // 制限内
    if (entry.count < this.maxRequests) {
      entry.count++;
      return {
        allowed: true,
        remaining: this.maxRequests - entry.count,
        resetAt: entry.resetAt,
      };
    }

    // 制限超過
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.resetAt,
    };
  }

  private cleanup(now: number): void {
    for (const [key, entry] of this.limits) {
      if (now >= entry.resetAt) {
        this.limits.delete(key);
      }
    }
  }
}

// globalThis シングルトン（pdf/queue.ts と同パターン）
const globalForRateLimit = globalThis as unknown as {
  pdfRateLimit: UserRateLimit | undefined;
};

export const pdfRateLimit =
  globalForRateLimit.pdfRateLimit ?? new UserRateLimit();

if (process.env.NODE_ENV !== "production") {
  globalForRateLimit.pdfRateLimit = pdfRateLimit;
}
