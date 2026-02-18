/**
 * batch_logs テーブルへの書き込みヘルパー
 */
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";
import { createLogger } from "@/lib/logger";

const log = createLogger("BatchLogger");

export interface JobLogEntry {
  id: string;
  jobType: string;
  status: string;
  executedAt: string;
}

/**
 * ジョブ開始を batch_logs に記録する
 */
export async function logJobStart(
  jobType: string,
  metadata?: Record<string, unknown>
): Promise<string> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("batch_logs")
    .insert({
      job_type: jobType,
      status: "running",
      metadata: (metadata ?? {}) as Json,
    })
    .select("id")
    .single();

  if (error) {
    log.error({ err: error, jobType }, "Failed to log job start");
    throw error;
  }

  log.info({ jobType, logId: data.id }, "Job started");
  return data.id;
}

/**
 * ジョブ完了を batch_logs に記録する
 */
export async function logJobComplete(
  logId: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("batch_logs")
    .update({
      status: "success",
      completed_at: new Date().toISOString(),
      metadata: (metadata ?? {}) as Json,
    })
    .eq("id", logId);

  if (error) {
    log.error({ err: error, logId }, "Failed to log job complete");
  } else {
    log.info({ logId }, "Job completed");
  }
}

/**
 * ジョブ失敗を batch_logs に記録する
 */
export async function logJobError(
  logId: string,
  errorMessage: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("batch_logs")
    .update({
      status: "failure",
      completed_at: new Date().toISOString(),
      error_message: errorMessage,
      metadata: (metadata ?? {}) as Json,
    })
    .eq("id", logId);

  if (error) {
    log.error({ err: error, logId }, "Failed to log job error");
  } else {
    log.info({ logId, errorMessage }, "Job failed");
  }
}
