import { createAdminClient } from "@/lib/supabase/admin";

const FAILURE_THRESHOLD = 5;

/**
 * 指定ロケーションを処理すべきかを判定する。
 * 連続失敗回数が閾値を超えている場合はスキップ。
 */
export async function shouldProcess(locationId: string): Promise<boolean> {
  const supabase = createAdminClient();

  const { data } = await supabase
    .from("location_batch_status")
    .select("consecutive_failures, disabled_at")
    .eq("location_id", locationId)
    .single();

  if (!data) return true; // レコードなし = 初回
  if (data.disabled_at) return false; // 明示的に無効化
  return data.consecutive_failures < FAILURE_THRESHOLD;
}

/**
 * 処理成功を記録する。連続失敗カウントをリセット。
 */
export async function recordSuccess(locationId: string): Promise<void> {
  const supabase = createAdminClient();

  await supabase
    .from("location_batch_status")
    .upsert(
      {
        location_id: locationId,
        consecutive_failures: 0,
        last_success_at: new Date().toISOString(),
        last_error: null,
        disabled_at: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "location_id" }
    );
}

/**
 * 処理失敗を記録する（DB側で原子的にインクリメント）。
 * 閾値超過時、かつ手動 disabled_at が未設定の場合のみ disabled_at を設定。
 */
export async function recordFailure(locationId: string, error: string): Promise<void> {
  const supabase = createAdminClient();

  const { data: newCount } = await supabase.rpc("record_batch_failure", {
    p_location_id: locationId,
    p_error: error,
    p_threshold: FAILURE_THRESHOLD,
  });

  if (newCount !== null && newCount >= FAILURE_THRESHOLD) {
    console.warn(
      `[CircuitBreaker] Location ${locationId} disabled after ${newCount} consecutive failures`
    );
  }
}
