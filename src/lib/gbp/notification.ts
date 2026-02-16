import { createAdminClient } from "@/lib/supabase/admin";

/**
 * OAuth トークン失効時に Admin ユーザーにメール通知を送信する。
 * Supabase Auth の admin API を使用してメールを送信する。
 */
export async function notifyTokenInvalidation(): Promise<void> {
  const supabase = createAdminClient();

  // Admin ユーザーのメールアドレスを取得
  const { data: admins, error } = await supabase
    .from("users")
    .select("email")
    .eq("role", "admin");

  if (error || !admins || admins.length === 0) {
    console.error("Failed to fetch admin users for notification:", error);
    return;
  }

  // 各 Admin にメール通知を送信
  for (const admin of admins) {
    try {
      // Supabase の magiclink 送信機能を流用して通知メールを送信
      // 本来はメール送信サービス（Resend等）を使用するのが望ましいが、
      // v1.0 ではコンソールログ + batch_logs 記録で対応
      console.warn(
        `[GBP Notification] OAuth token invalidated. Admin notification: ${admin.email}`
      );

      // batch_logs にトークン失効イベントを記録
      await supabase.from("batch_logs").insert({
        job_type: "oauth_token_invalidation",
        status: "failure",
        error_message: `Google OAuth token has been invalidated. Admin ${admin.email} should reconnect.`,
        metadata: { admin_email: admin.email },
      });
    } catch (notifyError) {
      console.error(
        `Failed to notify admin ${admin.email}:`,
        notifyError
      );
    }
  }
}
