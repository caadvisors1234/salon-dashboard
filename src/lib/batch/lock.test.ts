import { describe, it, expect, beforeEach } from "vitest";
import { acquireLock, releaseLock, isLocked, getLockedJobs, clearAllLocks } from "./lock";

describe("JobLock", () => {
  beforeEach(() => {
    clearAllLocks();
  });

  describe("acquireLock", () => {
    it("未ロック状態でロック取得に成功する", () => {
      expect(acquireLock("daily")).toBe(true);
    });

    it("既にロック済みの場合は失敗する", () => {
      acquireLock("daily");
      expect(acquireLock("daily")).toBe(false);
    });

    it("異なるジョブタイプは独立してロックできる", () => {
      expect(acquireLock("daily")).toBe(true);
      expect(acquireLock("monthly")).toBe(true);
    });
  });

  describe("releaseLock", () => {
    it("ロックを解放後に再取得できる", () => {
      acquireLock("daily");
      releaseLock("daily");
      expect(acquireLock("daily")).toBe(true);
    });

    it("未ロックのジョブを解放してもエラーにならない", () => {
      expect(() => releaseLock("nonexistent")).not.toThrow();
    });
  });

  describe("isLocked", () => {
    it("ロック中は true を返す", () => {
      acquireLock("daily");
      expect(isLocked("daily")).toBe(true);
    });

    it("未ロックは false を返す", () => {
      expect(isLocked("daily")).toBe(false);
    });

    it("解放後は false を返す", () => {
      acquireLock("daily");
      releaseLock("daily");
      expect(isLocked("daily")).toBe(false);
    });
  });

  describe("getLockedJobs", () => {
    it("ロック中のジョブ一覧を返す", () => {
      acquireLock("daily");
      acquireLock("monthly");
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
