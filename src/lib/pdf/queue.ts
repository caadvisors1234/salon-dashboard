const PDF_TIMEOUT_MS = 5 * 60 * 1000; // 5分

function getMaxConcurrent(): number {
  const env = process.env.PDF_MAX_CONCURRENT;
  if (env) {
    const n = parseInt(env, 10);
    if (!isNaN(n) && n > 0) return n;
  }
  return 2;
}

/**
 * インメモリSemaphoreベースのPDF生成キュー。
 * 同時実行数を制限し、タイムアウトとキャンセルを管理する。
 */
class PdfQueue {
  private running = 0;
  private waiting: Array<() => void> = [];

  /**
   * ジョブをキューに投入し、完了まで待機する。
   * Semaphoreにより同時実行数が制限される。
   * 5分超過でタイムアウトし、AbortSignal経由でジョブをキャンセルする。
   */
  async enqueue<T>(job: (signal: AbortSignal) => Promise<T>): Promise<T> {
    await this.acquire();
    const controller = new AbortController();
    try {
      return await this.withTimeout(
        () => job(controller.signal),
        PDF_TIMEOUT_MS,
        controller
      );
    } finally {
      this.release();
    }
  }

  /**
   * 現在のキュー状態を返す。
   */
  getStatus(): { running: number; waiting: number } {
    return { running: this.running, waiting: this.waiting.length };
  }

  private acquire(): Promise<void> {
    if (this.running < getMaxConcurrent()) {
      this.running++;
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      this.waiting.push(resolve);
    });
  }

  private release(): void {
    if (this.waiting.length > 0) {
      const next = this.waiting.shift()!;
      next();
    } else {
      this.running--;
    }
  }

  private withTimeout<T>(
    job: () => Promise<T>,
    timeoutMs: number,
    controller: AbortController
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        controller.abort();
        reject(new Error("PDF生成がタイムアウトしました（5分超過）"));
      }, timeoutMs);

      job()
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((err) => {
          clearTimeout(timer);
          reject(err);
        });
    });
  }
}

// シングルトンインスタンス
const globalForPdfQueue = globalThis as unknown as {
  pdfQueue: PdfQueue | undefined;
};

export const pdfQueue =
  globalForPdfQueue.pdfQueue ?? new PdfQueue();

if (process.env.NODE_ENV !== "production") {
  globalForPdfQueue.pdfQueue = pdfQueue;
}
