import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * OAuth トークン失効時に Admin ユーザーにメール通知を送信する。
 * Resend が設定されている場合はメール送信、未設定時はログ + batch_logs 記録。
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

  const adminEmails = admins
    .map((a) => a.email)
    .filter(Boolean) as string[];

  // Resend でメール送信を試行
  const resendApiKey = process.env.RESEND_API_KEY;
  if (resendApiKey && adminEmails.length > 0) {
    try {
      const resend = new Resend(resendApiKey);
      const from = process.env.BATCH_NOTIFICATION_FROM || "onboarding@resend.dev";

      await resend.emails.send({
        from,
        to: adminEmails,
        subject: "[GBP Dashboard] Google OAuth トークン失効",
        text: `Google OAuth トークンが失効しました。
バッチ処理が正常に実行できない状態です。

管理画面 > システム設定 から Google アカウントを再接続してください。

日時: ${new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}`,
      });
      console.log("[GBP Notification] Token invalidation email sent to admins");
    } catch (emailError) {
      console.error("[GBP Notification] Failed to send email:", emailError);
    }
  }

  // batch_logs にトークン失効イベントを1件記録（メール送信結果に関わらず）
  try {
    console.warn(
      `[GBP Notification] OAuth token invalidated. Admins: ${adminEmails.join(", ")}`
    );

    await supabase.from("batch_logs").insert({
      job_type: "oauth_token_invalidation",
      status: "failure",
      error_message: "Google OAuth token has been invalidated. Admins should reconnect.",
      metadata: { admin_emails: adminEmails },
    });
  } catch (notifyError) {
    console.error("[GBP Notification] Failed to log token invalidation:", notifyError);
  }
}
