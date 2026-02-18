import { describe, it, expect, vi, afterEach } from "vitest";
import { sleep, getCurrentMonth, monthsAgo } from "./utils";

describe("sleep", () => {
  it("resolves after the specified duration", async () => {
    const start = Date.now();
    await sleep(50);
    expect(Date.now() - start).toBeGreaterThanOrEqual(40);
  });
});

describe("getCurrentMonth", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns current month in YYYY-MM format", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-03-15T12:00:00Z"));
    expect(getCurrentMonth()).toBe("2025-03");
  });

  it("pads single-digit months", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-05T12:00:00Z"));
    expect(getCurrentMonth()).toBe("2025-01");
  });
});

describe("monthsAgo", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the correct month N months ago", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-06-15T12:00:00Z"));
    expect(monthsAgo(1)).toBe("2025-05");
    expect(monthsAgo(6)).toBe("2024-12");
  });

  it("handles year boundary correctly", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-31T12:00:00Z"));
    expect(monthsAgo(1)).toBe("2024-12");
    expect(monthsAgo(2)).toBe("2024-11");
  });

  it("avoids month-end rollover bug (e.g., March 31 - 1 month)", () => {
    vi.useFakeTimers();
    // March 31: naive setMonth would give March 3 (Feb 31 -> Mar 3)
    vi.setSystemTime(new Date("2025-03-31T12:00:00Z"));
    expect(monthsAgo(1)).toBe("2025-02");
  });

  it("returns current month when n=0", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-06-15T12:00:00Z"));
    expect(monthsAgo(0)).toBe("2025-06");
  });
});
