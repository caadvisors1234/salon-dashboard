import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { UserRateLimit } from "./rate-limit";

describe("UserRateLimit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("制限以下のリクエストを許可する", () => {
    const limiter = new UserRateLimit(3, 60_000);

    const r1 = limiter.check("user-1");
    expect(r1.allowed).toBe(true);
    expect(r1.remaining).toBe(2);

    const r2 = limiter.check("user-1");
    expect(r2.allowed).toBe(true);
    expect(r2.remaining).toBe(1);

    const r3 = limiter.check("user-1");
    expect(r3.allowed).toBe(true);
    expect(r3.remaining).toBe(0);
  });

  it("制限超過でリクエストを拒否する", () => {
    const limiter = new UserRateLimit(2, 60_000);

    limiter.check("user-1");
    limiter.check("user-1");
    const r3 = limiter.check("user-1");
    expect(r3.allowed).toBe(false);
    expect(r3.remaining).toBe(0);
  });

  it("異なるユーザーは独立してカウントされる", () => {
    const limiter = new UserRateLimit(1, 60_000);

    const r1 = limiter.check("user-1");
    expect(r1.allowed).toBe(true);

    const r2 = limiter.check("user-2");
    expect(r2.allowed).toBe(true);

    const r3 = limiter.check("user-1");
    expect(r3.allowed).toBe(false);
  });

  it("ウィンドウ期限切れ後にリセットされる", () => {
    const limiter = new UserRateLimit(1, 60_000);

    const r1 = limiter.check("user-1");
    expect(r1.allowed).toBe(true);

    const r2 = limiter.check("user-1");
    expect(r2.allowed).toBe(false);

    // ウィンドウ期限後
    vi.advanceTimersByTime(60_001);

    const r3 = limiter.check("user-1");
    expect(r3.allowed).toBe(true);
    expect(r3.remaining).toBe(0); // maxRequests=1 → 1回使って remaining=0
  });

  it("resetAt がウィンドウの終了時刻を返す", () => {
    const limiter = new UserRateLimit(5, 3600_000);
    vi.setSystemTime(new Date("2025-01-01T00:00:00Z"));

    const result = limiter.check("user-1");
    expect(result.resetAt).toBe(Date.now() + 3600_000);
  });
});
