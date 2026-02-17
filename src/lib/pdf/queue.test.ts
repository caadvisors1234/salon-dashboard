import { describe, it, expect, vi, beforeEach } from "vitest";

describe("PdfQueue", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  async function loadQueue() {
    const mod = await import("./queue");
    return mod.pdfQueue;
  }

  it("ジョブを実行して結果を返す", async () => {
    const queue = await loadQueue();
    const result = await queue.enqueue(async () => "done");
    expect(result).toBe("done");
  });

  it("getStatus が running / waiting を返す", async () => {
    const queue = await loadQueue();
    const status = queue.getStatus();
    expect(status).toEqual({ running: 0, waiting: 0 });
  });

  it("同時実行数を制限する（デフォルト2）", async () => {
    const queue = await loadQueue();
    let concurrentCount = 0;
    let maxConcurrent = 0;

    const createJob = () =>
      queue.enqueue(async () => {
        concurrentCount++;
        maxConcurrent = Math.max(maxConcurrent, concurrentCount);
        await new Promise((r) => setTimeout(r, 50));
        concurrentCount--;
        return "ok";
      });

    await Promise.all([createJob(), createJob(), createJob()]);
    expect(maxConcurrent).toBeLessThanOrEqual(2);
  });

  it("ジョブのエラーが伝搬される", async () => {
    const queue = await loadQueue();
    await expect(
      queue.enqueue(async () => {
        throw new Error("job failed");
      })
    ).rejects.toThrow("job failed");
  });

  it("ジョブ完了後にrunning数が戻る", async () => {
    const queue = await loadQueue();
    await queue.enqueue(async () => "ok");
    expect(queue.getStatus().running).toBe(0);
  });

  it("エラー後もrunning数が戻る", async () => {
    const queue = await loadQueue();
    try {
      await queue.enqueue(async () => {
        throw new Error("fail");
      });
    } catch {
      // expected
    }
    expect(queue.getStatus().running).toBe(0);
  });
});
