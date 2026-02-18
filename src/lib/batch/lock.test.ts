import { describe, it, expect, vi, beforeEach } from "vitest";

// Supabase RPC モック
const mockRpc = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    rpc: mockRpc,
  })),
}));

import { acquireLock, releaseLock, isLocked, getLockedJobs, clearAllLocks } from "./lock";

describe("JobLock", () => {
  beforeEach(() => {
    clearAllLocks();
    mockRpc.mockReset();
    // デフォルト: RPC成功
    mockRpc.mockImplementation((fnName: string) => {
      if (fnName === "acquire_batch_lock") return Promise.resolve({ data: true, error: null });
      if (fnName === "release_batch_lock") return Promise.resolve({ data: true, error: null });
      if (fnName === "is_batch_locked") return Promise.resolve({ data: false, error: null });
      return Promise.resolve({ data: null, error: null });
    });
  });

  describe("acquireLock", () => {
    it("未ロック状態でロック取得に成功する", async () => {
      expect(await acquireLock("daily")).toBe(true);
    });

    it("既にロック済みの場合は失敗する（ローカル）", async () => {
      await acquireLock("daily");
      expect(await acquireLock("daily")).toBe(false);
    });

    it("DBロック取得失敗時は false を返す", async () => {
      mockRpc.mockImplementation((fnName: string) => {
        if (fnName === "acquire_batch_lock") return Promise.resolve({ data: false, error: null });
        return Promise.resolve({ data: null, error: null });
      });
      expect(await acquireLock("daily")).toBe(false);
    });

    it("DB エラー時は false を返す", async () => {
      mockRpc.mockImplementation((fnName: string) => {
        if (fnName === "acquire_batch_lock") return Promise.resolve({ data: null, error: { message: "connection failed" } });
        return Promise.resolve({ data: null, error: null });
      });
      expect(await acquireLock("daily")).toBe(false);
    });

    it("異なるジョブタイプは独立してロックできる", async () => {
      expect(await acquireLock("daily")).toBe(true);
      expect(await acquireLock("monthly")).toBe(true);
    });
  });

  describe("releaseLock", () => {
    it("ロックを解放後に再取得できる", async () => {
      await acquireLock("daily");
      await releaseLock("daily");
      expect(await acquireLock("daily")).toBe(true);
    });

    it("未ロックのジョブを解放してもエラーにならない", async () => {
      await expect(releaseLock("nonexistent")).resolves.not.toThrow();
    });
  });

  describe("isLocked", () => {
    it("ローカルロック中は true を返す（DB問い合わせ不要）", async () => {
      await acquireLock("daily");
      expect(await isLocked("daily")).toBe(true);
    });

    it("未ロックでDBも未ロックなら false を返す", async () => {
      mockRpc.mockImplementation((fnName: string) => {
        if (fnName === "is_batch_locked") return Promise.resolve({ data: false, error: null });
        return Promise.resolve({ data: null, error: null });
      });
      expect(await isLocked("daily")).toBe(false);
    });

    it("ローカル未ロックでもDBがロック中なら true を返す", async () => {
      mockRpc.mockImplementation((fnName: string) => {
        if (fnName === "is_batch_locked") return Promise.resolve({ data: true, error: null });
        return Promise.resolve({ data: null, error: null });
      });
      expect(await isLocked("daily")).toBe(true);
    });

    it("解放後は false を返す", async () => {
      await acquireLock("daily");
      await releaseLock("daily");
      expect(await isLocked("daily")).toBe(false);
    });
  });

  describe("getLockedJobs", () => {
    it("ローカルロック中のジョブ一覧を返す", async () => {
      await acquireLock("daily");
      await acquireLock("monthly");
      const locked = getLockedJobs();
      expect(locked).toContain("daily");
      expect(locked).toContain("monthly");
      expect(locked).toHaveLength(2);
    });

    it("ロックなしの場合は空配列", () => {
      expect(getLockedJobs()).toHaveLength(0);
    });
  });
});
