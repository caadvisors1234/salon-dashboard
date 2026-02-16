/**
 * batch_logs テーブルへの書き込みヘルパー
 */
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";

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
    console.error(`[BatchLogger] Failed to log job start for ${jobType}:`, error.message);
    throw error;
  }

  console.log(`[BatchLogger] Job started: ${jobType} (id: ${data.id})`);
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
    console.error(`[BatchLogger] Failed to log job complete (id: ${logId}):`, error.message);
  } else {
    console.log(`[BatchLogger] Job completed: ${logId}`);
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
    console.error(`[BatchLogger] Failed to log job error (id: ${logId}):`, error.message);
  } else {
    console.log(`[BatchLogger] Job failed: ${logId} - ${errorMessage}`);
  }
}
