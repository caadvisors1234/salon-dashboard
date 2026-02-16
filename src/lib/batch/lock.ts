/**
 * インメモリジョブロック — 同一ジョブタイプの並行実行を防止
 *
 * 注意: プロセスローカルなロックのため、batch ワーカー（Docker）と
 * Next.js API Route（/api/batch/trigger）間では重複検出されない。
 * クロスプロセスの排他制御が必要な場合は DB ベースのロック機構を検討すること。
 */

const runningJobs = new Set<string>();

/**
 * ジョブのロックを取得する。既に実行中の場合は false を返す。
 */
export function acquireLock(jobType: string): boolean {
  if (runningJobs.has(jobType)) {
    console.warn(`[JobLock] Job ${jobType} is already running, skipping`);
    return false;
  }
  runningJobs.add(jobType);
  console.log(`[JobLock] Lock acquired: ${jobType}`);
  return true;
}

/**
 * ジョブのロックを解放する。
 */
export function releaseLock(jobType: string): void {
  runningJobs.delete(jobType);
  console.log(`[JobLock] Lock released: ${jobType}`);
}

/**
 * ジョブが実行中かどうかを確認する。
 */
export function isLocked(jobType: string): boolean {
  return runningJobs.has(jobType);
}

/**
 * 現在ロック中のジョブ一覧を返す。
 */
export function getLockedJobs(): string[] {
  return [...runningJobs];
}
