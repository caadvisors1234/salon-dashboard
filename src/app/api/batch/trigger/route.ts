import { NextResponse, type NextRequest, after } from "next/server";
import { getSession } from "@/lib/auth/guards";
import { logJobStart, logJobComplete, logJobError } from "@/lib/batch/logger";
import { acquireLock, releaseLock, isLocked } from "@/lib/batch/lock";
import { runDailyJob } from "@/lib/batch/jobs/daily";
import { runMonthlyJob } from "@/lib/batch/jobs/monthly";
import { runBackfillJob } from "@/lib/batch/jobs/backfill";
import { runInitialBackfill } from "@/lib/batch/jobs/initial-backfill";

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
    return NextResponse.json(
      { error: "この操作は管理者のみ実行できます" },
      { status: 403 }
    );
  }

  let body: { jobType?: string; targetDate?: string; backfillDays?: number; locationId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "リクエストの解析に失敗しました" },
      { status: 400 }
    );
  }

  const { jobType, targetDate, backfillDays, locationId } = body;

  if (
    !jobType ||
    !["daily", "monthly", "backfill", "initial-backfill"].includes(jobType)
  ) {
    return NextResponse.json(
      {
        error:
          "jobType は 'daily', 'monthly', 'backfill', 'initial-backfill' のいずれかを指定してください",
      },
      { status: 400 }
    );
  }

  if (jobType === "initial-backfill" && !locationId) {
    return NextResponse.json(
      { error: "initial-backfill には locationId が必要です" },
      { status: 400 }
    );
  }

  const lockKey = getLockKey(jobType as JobType, locationId);

  // 重複防止
  if (isLocked(lockKey)) {
    return NextResponse.json(
      { error: `${jobType} ジョブは現在実行中です。完了後に再試行してください。` },
      { status: 409 }
    );
  }

  if (!acquireLock(lockKey)) {
    return NextResponse.json(
      { error: `${jobType} ジョブのロック取得に失敗しました` },
      { status: 409 }
    );
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
      releaseLock(lockKey);
      const message = err instanceof Error ? err.message : String(err);
      return NextResponse.json(
        { error: `バッチ実行に失敗しました: ${message}` },
        { status: 500 }
      );
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
        releaseLock(lockKey);
      }
    });

    return NextResponse.json({
      success: true,
      jobType,
      logId,
      message: "バックフィルをバックグラウンドで開始しました",
    });
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

    return NextResponse.json({
      success: true,
      jobType,
      logId,
      result,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (logId) {
      await logJobError(logId, message);
    }

    return NextResponse.json(
      { error: `バッチ実行に失敗しました: ${message}` },
      { status: 500 }
    );
  } finally {
    releaseLock(lockKey);
  }
}
