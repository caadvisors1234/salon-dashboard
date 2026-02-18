/**
 * ヘルスチェック HTTP サーバー
 * Docker healthcheck 用の軽量 HTTP エンドポイント
 */
import http from "node:http";
import { getConfig } from "../lib/config";
import { getLockedJobs } from "@/lib/batch/lock";
import { createAdminClient } from "@/lib/supabase/admin";

const HEALTH_CHECK_TIMEOUT_MS = 5000;
const STALE_DAILY_RUN_HOURS = 26;

let server: http.Server | null = null;
let startTime: Date | null = null;
let lastDailyRun: Date | null = null;
let lastMonthlyRun: Date | null = null;

type CheckStatus = "ok" | "degraded" | "unhealthy";

interface CheckResult {
  status: CheckStatus;
  [key: string]: unknown;
}

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

async function checkDatabase(): Promise<CheckResult> {
  const start = Date.now();
  try {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("batch_logs")
      .select("id")
      .limit(1);
    if (error) {
      return { status: "unhealthy", error: "DB query failed", latency_ms: Date.now() - start };
    }
    return { status: "ok", latency_ms: Date.now() - start };
  } catch {
    return { status: "unhealthy", error: "DB connection failed", latency_ms: Date.now() - start };
  }
}

function checkLastDailyRun(): CheckResult {
  if (!lastDailyRun) {
    // 起動直後はまだ実行されていない場合がある
    const uptimeHours = startTime ? (Date.now() - startTime.getTime()) / (1000 * 60 * 60) : 0;
    if (uptimeHours > STALE_DAILY_RUN_HOURS) {
      return { status: "degraded", hours_ago: null, note: "No daily run since startup" };
    }
    return { status: "ok", hours_ago: null, note: "Waiting for first run" };
  }

  const hoursAgo = (Date.now() - lastDailyRun.getTime()) / (1000 * 60 * 60);
  if (hoursAgo > STALE_DAILY_RUN_HOURS) {
    return { status: "degraded", hours_ago: Math.round(hoursAgo * 10) / 10 };
  }
  return { status: "ok", hours_ago: Math.round(hoursAgo * 10) / 10 };
}

function worstStatus(statuses: CheckStatus[]): CheckStatus {
  if (statuses.includes("unhealthy")) return "unhealthy";
  if (statuses.includes("degraded")) return "degraded";
  return "ok";
}

async function buildHealthResponse(): Promise<{ statusCode: number; body: string }> {
  const uptimeMs = startTime ? Date.now() - startTime.getTime() : 0;

  // DB check with timeout
  const dbCheckPromise = checkDatabase();
  const timeoutPromise = new Promise<CheckResult>((resolve) =>
    setTimeout(() => resolve({ status: "unhealthy", error: "Health check timeout" }), HEALTH_CHECK_TIMEOUT_MS)
  );
  const dbCheck = await Promise.race([dbCheckPromise, timeoutPromise]);
  const dailyRunCheck = checkLastDailyRun();

  const overallStatus = worstStatus([dbCheck.status, dailyRunCheck.status]);
  const statusCode = overallStatus === "unhealthy" ? 503 : 200;

  const body = JSON.stringify({
    status: overallStatus,
    checks: {
      database: dbCheck,
      lastDailyRun: dailyRunCheck,
    },
    uptime: Math.floor(uptimeMs / 1000),
    startedAt: startTime?.toISOString() ?? null,
    lastDailyRun: lastDailyRun?.toISOString() ?? null,
    lastMonthlyRun: lastMonthlyRun?.toISOString() ?? null,
    runningJobs: getLockedJobs(),
  });

  return { statusCode, body };
}

/**
 * ヘルスチェックサーバーを起動する
 */
export function startHealthServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    const config = getConfig();
    const port = config.healthPort;

    startTime = new Date();

    server = http.createServer(async (_req, res) => {
      try {
        const { statusCode, body } = await buildHealthResponse();
        res.writeHead(statusCode, {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        });
        res.end(body);
      } catch (err) {
        console.error("[Health] Error building response:", err);
        const errorBody = JSON.stringify({ status: "unhealthy", error: "Internal health check error" });
        res.writeHead(503, {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(errorBody),
        });
        res.end(errorBody);
      }
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
