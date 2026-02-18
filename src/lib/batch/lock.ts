/**
 * ハイブリッドジョブロック — インメモリ高速パス + DB分散ロック
 *
 * インメモリ Set で同一プロセス内の重複を高速に排除し、
 * Supabase の batch_locks テーブルで複数プロセス間の排他制御を実現する。
 */

import { createAdminClient } from "@/lib/supabase/admin";
import crypto from "crypto";
import os from "os";
import { createLogger } from "@/lib/logger";

const log = createLogger("JobLock");

const runningJobs = new Set<string>();

const INSTANCE_ID = `${os.hostname()}-${process.pid}-${crypto.randomUUID().slice(0, 8)}`;

const DEFAULT_TTL_MINUTES = 10;

/**
 * ジョブのロックを取得する。既に実行中の場合は false を返す。
 * インメモリ確認後、DBの分散ロックを取得する。
 *
 * 注意: DBエラー時も false を返す（ロック競合と区別不可）。
 * エラー詳細はコンソールログで確認すること。
 */
export async function acquireLock(jobType: string, ttlMinutes?: number): Promise<boolean> {
  if (runningJobs.has(jobType)) {
    log.warn({ jobType }, "Job is already running locally, skipping");
    return false;
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("acquire_batch_lock", {
    p_job_type: jobType,
    p_locked_by: INSTANCE_ID,
    p_ttl_minutes: ttlMinutes ?? DEFAULT_TTL_MINUTES,
  });

  if (error) {
    log.error({ err: error, jobType }, "DB lock acquisition error");
    return false;
  }

  if (!data) {
    log.warn({ jobType }, "Job is locked by another process, skipping");
    return false;
  }

  runningJobs.add(jobType);
  log.info({ jobType, instanceId: INSTANCE_ID }, "Lock acquired");
  return true;
}

/**
 * ジョブのロックを解放する。
 */
export async function releaseLock(jobType: string): Promise<void> {
  runningJobs.delete(jobType);

  const supabase = createAdminClient();
  const { error } = await supabase.rpc("release_batch_lock", {
    p_job_type: jobType,
    p_locked_by: INSTANCE_ID,
  });

  if (error) {
    log.error({ err: error, jobType }, "DB lock release error");
    log.info({ jobType }, "Lock released locally (DB release failed)");
  } else {
    log.info({ jobType }, "Lock released");
  }
}

/**
 * ジョブが実行中かどうかを確認する。
 */
export async function isLocked(jobType: string): Promise<boolean> {
  if (runningJobs.has(jobType)) {
    return true;
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("is_batch_locked", {
    p_job_type: jobType,
  });

  if (error) {
    log.error({ err: error, jobType }, "DB lock check error");
    return false;
  }

  return !!data;
}

/**
 * 現在ローカルでロック中のジョブ一覧を返す。
 */
export function getLockedJobs(): string[] {
  return [...runningJobs];
}

/**
 * 全てのローカルロックをクリアする（テスト用）。
 * DBロックはクリアされない（TTL経過で自然失効する）。
 * @internal
 */
export function clearAllLocks(): void {
  runningJobs.clear();
}
