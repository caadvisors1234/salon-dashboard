/**
 * ヘルスチェック HTTP サーバー
 * Docker healthcheck 用の軽量 HTTP エンドポイント
 */
import http from "node:http";
import { getConfig } from "../lib/config";
import { getLockedJobs } from "@/lib/batch/lock";

let server: http.Server | null = null;
let startTime: Date | null = null;
let lastDailyRun: Date | null = null;
let lastMonthlyRun: Date | null = null;

/**
 * 最終実行時刻を更新する
 */
export function updateLastRun(jobType: "daily" | "monthly"): void {
  if (jobType === "daily") {
    lastDailyRun = new Date();
  } else {
    lastMonthlyRun = new Date();
  }
}

/**
 * ヘルスチェックサーバーを起動する
 */
export function startHealthServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    const config = getConfig();
    const port = config.healthPort;

    startTime = new Date();

    server = http.createServer((_req, res) => {
      const uptimeMs = startTime ? Date.now() - startTime.getTime() : 0;

      const body = JSON.stringify({
        status: "ok",
        uptime: Math.floor(uptimeMs / 1000),
        startedAt: startTime?.toISOString() ?? null,
        lastDailyRun: lastDailyRun?.toISOString() ?? null,
        lastMonthlyRun: lastMonthlyRun?.toISOString() ?? null,
        runningJobs: getLockedJobs(),
      });

      res.writeHead(200, {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
      });
      res.end(body);
    });

    server.on("error", (err) => {
      console.error(`[Health] Server error:`, err);
      reject(err);
    });

    server.listen(port, () => {
      console.log(`[Health] Server listening on port ${port}`);
      resolve();
    });
  });
}

/**
 * ヘルスチェックサーバーを停止する
 */
export function stopHealthServer(): Promise<void> {
  return new Promise((resolve) => {
    if (!server) {
      resolve();
      return;
    }

    server.close(() => {
      console.log("[Health] Server stopped");
      server = null;
      resolve();
    });
  });
}
