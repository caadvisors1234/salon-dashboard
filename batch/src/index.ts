/**
 * バッチワーカー エントリポイント
 *
 * 起動フロー:
 * 1. 環境変数バリデーション
 * 2. ヘルスチェックサーバー起動
 * 3. 起動通知（メール）
 * 4. バックフィル実行（起動時、cron登録前）
 * 5. cron スケジュール登録（日次 + 月次）
 * 6. SIGTERM/SIGINT でグレースフルシャットダウン
 */
import { loadConfig, getConfig } from "./lib/config";
import { acquireLock, releaseLock, getLockedJobs } from "@/lib/batch/lock";
import { logJobStart, logJobComplete, logJobError } from "@/lib/batch/logger";
import { startHealthServer, stopHealthServer } from "./services/health";
import { startScheduler, stopScheduler } from "./scheduler";
import { runBackfillJob } from "@/lib/batch/jobs/backfill";
import {
  sendWorkerLifecycleNotification,
  sendBackfillAlert,
} from "./services/notifier";
import { createLogger } from "../../src/lib/logger";

const log = createLogger("Main");

let isShuttingDown = false;

/**
 * 起動時バックフィルを実行する
 */
async function runStartupBackfill(): Promise<void> {
  const jobType = "backfill";

  if (!acquireLock(jobType)) {
    log.info("Backfill already running, skipping");
    return;
  }

  const config = getConfig();
  let logId: string | undefined;
  try {
    logId = await logJobStart("backfill_startup");
    const result = await runBackfillJob(config.backfillDays);

    if (result.totalMetricDaysFilled === 0 && result.totalRatingDaysFilled === 0) {
      log.info("No backfill needed — data is up to date");
    }

    await logJobComplete(logId, {
      backfillDays: result.backfillDays,
      totalLocations: result.totalLocations,
      totalMetricDaysFilled: result.totalMetricDaysFilled,
      totalRatingDaysFilled: result.totalRatingDaysFilled,
      overdueCount: result.overdueLocations.length,
    });

    // 30日超欠損があればアラート通知
    if (result.overdueLocations.length > 0) {
      await sendBackfillAlert(result);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err }, "Backfill error");
    if (logId) {
      await logJobError(logId, message);
    }
  } finally {
    releaseLock(jobType);
  }
}

/**
 * グレースフルシャットダウン
 */
async function shutdown(signal: string): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;

  log.info({ signal }, "Received signal. Starting graceful shutdown...");

  // cron 停止（新しいジョブが起動しないようにする）
  stopScheduler();

  // 実行中のジョブがあれば完了を待つ（最大60秒）
  const runningJobs = getLockedJobs();
  if (runningJobs.length > 0) {
    log.info({ runningJobs }, "Waiting for running jobs to complete");
    const maxWait = 60_000;
    const startTime = Date.now();

    while (getLockedJobs().length > 0 && Date.now() - startTime < maxWait) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    const remaining = getLockedJobs();
    if (remaining.length > 0) {
      log.warn({ remainingJobs: remaining }, "Timeout waiting for jobs");
    }
  }

  // ヘルスサーバー停止
  await stopHealthServer();

  // 停止通知
  try {
    await sendWorkerLifecycleNotification("stopped");
  } catch {
    // 通知失敗は無視
  }

  log.info("Shutdown complete");
  process.exit(0);
}

/**
 * メインエントリポイント
 */
async function main(): Promise<void> {
  log.info("GBP Dashboard Batch Worker started at %s", new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" }));

  // 1. 環境変数バリデーション
  const config = loadConfig();
  log.info({ dailyCron: config.dailyCron, monthlyCron: config.monthlyCron, backfillDays: config.backfillDays }, "Config loaded");

  // 2. ヘルスチェックサーバー起動
  await startHealthServer();

  // 3. 起動通知
  try {
    await sendWorkerLifecycleNotification("started");
  } catch {
    // 通知失敗は無視
  }

  // 4. バックフィル実行（cron 登録前）
  log.info("Running startup backfill...");
  await runStartupBackfill();

  // 5. cron スケジュール登録
  startScheduler();

  // 6. SIGTERM/SIGINT ハンドラ
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  log.info("Batch worker is ready and waiting for scheduled jobs");
}

main().catch((err) => {
  log.error({ err }, "Fatal error");
  process.exit(1);
});
