/**
 * cron スケジューラ — 日次/月次ジョブを登録
 */
import cron from "node-cron";
import { getConfig } from "./lib/config";
import { acquireLock, releaseLock } from "@/lib/batch/lock";
import { logJobStart, logJobComplete, logJobError } from "@/lib/batch/logger";
import { runDailyJob } from "@/lib/batch/jobs/daily";
import { runMonthlyJob } from "@/lib/batch/jobs/monthly";
import { updateLastRun } from "./services/health";
import {
  sendDailyBatchNotification,
  sendMonthlyBatchNotification,
} from "./services/notifier";
import { createLogger } from "../../src/lib/logger";

const log = createLogger("Scheduler");

let dailyTask: cron.ScheduledTask | null = null;
let monthlyTask: cron.ScheduledTask | null = null;

/**
 * 日次ジョブをラップして実行する（ロック・ログ・通知付き）
 */
export async function executeDailyJob(): Promise<void> {
  const jobType = "daily_batch";

  if (!(await acquireLock(jobType))) {
    log.info("Daily job already running, skipping");
    return;
  }

  let logId: string | undefined;
  try {
    logId = await logJobStart(jobType);
    const result = await runDailyJob();

    updateLastRun("daily");

    if (result.failureCount > 0) {
      await logJobError(logId, `${result.failureCount} locations failed`, {
        ...result,
        results: result.results.filter((r) => !r.success),
      });
      await sendDailyBatchNotification(result);
    } else {
      await logJobComplete(logId, {
        targetDate: result.targetDate,
        totalLocations: result.totalLocations,
        successCount: result.successCount,
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err }, "Daily job error");
    if (logId) {
      await logJobError(logId, message);
    }
  } finally {
    await releaseLock(jobType);
  }
}

/**
 * 月次ジョブをラップして実行する（ロック・ログ・通知付き）
 */
export async function executeMonthlyJob(): Promise<void> {
  const jobType = "monthly_batch";

  if (!(await acquireLock(jobType))) {
    log.info("Monthly job already running, skipping");
    return;
  }

  let logId: string | undefined;
  try {
    logId = await logJobStart(jobType);
    const result = await runMonthlyJob();

    updateLastRun("monthly");

    if (result.failureCount > 0) {
      await logJobError(logId, `${result.failureCount} locations failed`, {
        ...result,
        results: result.results.filter((r) => !r.success),
      });
      await sendMonthlyBatchNotification(result);
    } else {
      await logJobComplete(logId, {
        targetYearMonth: result.targetYearMonth,
        totalLocations: result.totalLocations,
        successCount: result.successCount,
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err }, "Monthly job error");
    if (logId) {
      await logJobError(logId, message);
    }
  } finally {
    await releaseLock(jobType);
  }
}

/**
 * cron スケジュールを登録する
 */
export function startScheduler(): void {
  const config = getConfig();

  // 日次バッチ
  if (!cron.validate(config.dailyCron)) {
    throw new Error(`Invalid daily cron expression: ${config.dailyCron}`);
  }
  dailyTask = cron.schedule(config.dailyCron, () => {
    executeDailyJob().catch((err) =>
      log.error({ err }, "Unhandled daily job error")
    );
  });
  log.info({ cron: config.dailyCron }, "Daily job scheduled");

  // 月次バッチ
  if (!cron.validate(config.monthlyCron)) {
    throw new Error(`Invalid monthly cron expression: ${config.monthlyCron}`);
  }
  monthlyTask = cron.schedule(config.monthlyCron, () => {
    executeMonthlyJob().catch((err) =>
      log.error({ err }, "Unhandled monthly job error")
    );
  });
  log.info({ cron: config.monthlyCron }, "Monthly job scheduled");
}

/**
 * cron スケジュールを停止する
 */
export function stopScheduler(): void {
  if (dailyTask) {
    dailyTask.stop();
    dailyTask = null;
    log.info("Daily job stopped");
  }
  if (monthlyTask) {
    monthlyTask.stop();
    monthlyTask = null;
    log.info("Monthly job stopped");
  }
}
