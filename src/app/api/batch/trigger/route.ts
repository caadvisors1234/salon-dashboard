import { type NextRequest, after } from "next/server";
import { getSession } from "@/lib/auth/guards";
import { apiSuccess, apiError } from "@/lib/api/response";
import { logJobStart, logJobComplete, logJobError } from "@/lib/batch/logger";
import { acquireLock, releaseLock, isLocked } from "@/lib/batch/lock";
import { runDailyJob } from "@/lib/batch/jobs/daily";
import { runMonthlyJob } from "@/lib/batch/jobs/monthly";
import { runBackfillJob } from "@/lib/batch/jobs/backfill";
import { runInitialBackfill } from "@/lib/batch/jobs/initial-backfill";
import { logAudit } from "@/lib/audit/logger";
import { createLogger } from "@/lib/logger";

const log = createLogger("BatchTrigger");

type JobType = "daily" | "monthly" | "backfill" | "initial-backfill";

const JOB_TYPE_MAP: Record<string, string> = {
  daily: "daily_batch_manual",
  monthly: "monthly_batch_manual",
  backfill: "backfill_manual",
};

function getLockKey(jobType: JobType, locationId?: string): string {
  if (jobType === "initial-backfill") {
    return `initial_backfill_${locationId}`;
  }
  return JOB_TYPE_MAP[jobType];
}

/**
 * POST /api/batch/trigger
 * Admin がバッチを手動で即時実行する。
 *
 * Body: { jobType: "daily" | "monthly" | "backfill" | "initial-backfill", targetDate?: string, backfillDays?: number, locationId?: string }
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return apiError("この操作は管理者のみ実行できます", 403);
  }

  let body: { jobType?: string; targetDate?: string; backfillDays?: number; locationId?: string };
  try {
    body = await request.json();
  } catch {
    return apiError("リクエストの解析に失敗しました", 400);
  }

  const { jobType, targetDate, backfillDays, locationId } = body;

  if (
    !jobType ||
    !["daily", "monthly", "backfill", "initial-backfill"].includes(jobType)
  ) {
    return apiError(
      "jobType は 'daily', 'monthly', 'backfill', 'initial-backfill' のいずれかを指定してください",
      400
    );
  }

  if (jobType === "initial-backfill" && !locationId) {
    return apiError("initial-backfill には locationId が必要です", 400);
  }

  const lockKey = getLockKey(jobType as JobType, locationId);

  // 重複防止
  if (await isLocked(lockKey)) {
    return apiError(`${jobType} ジョブは現在実行中です。完了後に再試行してください。`, 409);
  }

  if (!(await acquireLock(lockKey))) {
    return apiError(`${jobType} ジョブのロック取得に失敗しました`, 409);
  }

  // initial-backfill は長時間かかるためバックグラウンドで実行し即座にレスポンスを返す
  if (jobType === "initial-backfill") {
    let logId: string | undefined;
    try {
      logId = await logJobStart(lockKey, {
        triggeredBy: session.email,
        locationId,
      });
    } catch (err) {
      await releaseLock(lockKey);
      log.error({ err }, "Failed to start initial backfill");
      return apiError("バッチ実行に失敗しました", 500);
    }

    after(async () => {
      try {
        const result = await runInitialBackfill(locationId!);
        await logJobComplete(logId!, result as unknown as Record<string, unknown>);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (logId) {
          await logJobError(logId, message);
        }
      } finally {
        await releaseLock(lockKey);
      }
    });

    logAudit({
      userId: session.id,
      action: "batch.trigger",
      resourceType: "batch_job",
      metadata: { jobType, locationId },
      ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined,
    });

    return apiSuccess({ jobType, logId, message: "バックフィルをバックグラウンドで開始しました" });
  }

  // 同期実行ジョブ（daily / monthly / backfill）
  let logId: string | undefined;
  try {
    logId = await logJobStart(lockKey, {
      triggeredBy: session.email,
      targetDate,
    });

    let result: unknown;

    switch (jobType as JobType) {
      case "daily":
        result = await runDailyJob(targetDate);
        break;
      case "monthly": {
        if (targetDate) {
          const [y, m] = targetDate.split("-").map(Number);
          result = await runMonthlyJob(y, m);
        } else {
          result = await runMonthlyJob();
        }
        break;
      }
      case "backfill":
        result = await runBackfillJob(backfillDays);
        break;
    }

    await logJobComplete(logId, result as Record<string, unknown>);

    logAudit({
      userId: session.id,
      action: "batch.trigger",
      resourceType: "batch_job",
      metadata: { jobType, targetDate },
      ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined,
    });

    return apiSuccess({ jobType, logId, result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (logId) {
      await logJobError(logId, message);
    }

    log.error({ err }, "Batch execution failed");
    return apiError("バッチ実行に失敗しました", 500);
  } finally {
    await releaseLock(lockKey);
  }
}
