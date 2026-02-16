/**
 * メール通知サービス（Resend SDK）
 * - バッチ結果通知
 * - バックフィルアラート
 * - ワーカーライフサイクル通知
 */
import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase/admin";
import { getConfig } from "../lib/config";
import type { DailyJobResult } from "@/lib/batch/jobs/daily";
import type { MonthlyJobResult } from "@/lib/batch/jobs/monthly";
import type { BackfillJobResult } from "@/lib/batch/jobs/backfill";

let resend: Resend | null = null;

function getResend(): Resend | null {
  const config = getConfig();
  if (!config.resendApiKey) {
    return null;
  }
  if (!resend) {
    resend = new Resend(config.resendApiKey);
  }
  return resend;
}

/**
 * Admin ユーザーのメールアドレスを取得する
 */
async function getAdminEmails(): Promise<string[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("users")
    .select("email")
    .eq("role", "admin");

  if (error || !data) {
    console.error("[Notifier] Failed to fetch admin emails:", error?.message);
    return [];
  }

  return data.map((u) => u.email).filter(Boolean) as string[];
}

/**
 * メール送信（共通処理）
 */
async function sendEmail(
  to: string[],
  subject: string,
  text: string
): Promise<void> {
  const client = getResend();
  if (!client) {
    console.log(`[Notifier] Resend not configured. Would send email:`);
    console.log(`  To: ${to.join(", ")}`);
    console.log(`  Subject: ${subject}`);
    console.log(`  Body: ${text.slice(0, 200)}...`);
    return;
  }

  const config = getConfig();

  try {
    await client.emails.send({
      from: config.notificationFrom,
      to,
      subject,
      text,
    });
    console.log(`[Notifier] Email sent: "${subject}" to ${to.length} recipients`);
  } catch (err) {
    console.error(
      `[Notifier] Failed to send email: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

/**
 * 日次バッチ結果通知（失敗店舗がある場合のみ）
 */
export async function sendDailyBatchNotification(
  result: DailyJobResult
): Promise<void> {
  if (result.failureCount === 0) return;

  const emails = await getAdminEmails();
  if (emails.length === 0) return;

  const failedResults = result.results.filter((r) => !r.success);
  const failedList = failedResults
    .map((r) => `  - ${r.locationName} (${r.locationId}): ${r.error}`)
    .join("\n");

  const subject = `[GBP Dashboard] 日次バッチ完了（${result.failureCount}件失敗）`;
  const text = `実行日時: ${new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}
ジョブ: 日次バッチ
対象日: ${result.targetDate}

結果:
  - 成功: ${result.successCount} 店舗
  - 失敗: ${result.failureCount} 店舗

失敗店舗:
${failedList}

管理画面で詳細を確認してください。`;

  await sendEmail(emails, subject, text);
}

/**
 * 月次バッチ結果通知（失敗店舗がある場合のみ）
 */
export async function sendMonthlyBatchNotification(
  result: MonthlyJobResult
): Promise<void> {
  if (result.failureCount === 0) return;

  const emails = await getAdminEmails();
  if (emails.length === 0) return;

  const failedResults = result.results.filter((r) => !r.success);
  const failedList = failedResults
    .map((r) => `  - ${r.locationName} (${r.locationId}): ${r.error}`)
    .join("\n");

  const subject = `[GBP Dashboard] 月次バッチ完了（${result.failureCount}件失敗）`;
  const text = `実行日時: ${new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}
ジョブ: 月次バッチ
対象年月: ${result.targetYearMonth}

結果:
  - 成功: ${result.successCount} 店舗
  - 失敗: ${result.failureCount} 店舗

失敗店舗:
${failedList}

管理画面で詳細を確認してください。`;

  await sendEmail(emails, subject, text);
}

/**
 * バックフィルアラート通知（30日超欠損）
 */
export async function sendBackfillAlert(
  result: BackfillJobResult
): Promise<void> {
  if (result.overdueLocations.length === 0) return;

  const emails = await getAdminEmails();
  if (emails.length === 0) return;

  const overdueList = result.overdueLocations
    .map((loc) => {
      const metricInfo = loc.lastMetricDate
        ? `最終取得日 ${loc.lastMetricDate}（${loc.metricGapDays}日間の欠損）`
        : "データなし";
      return `  - ${loc.locationName}: ${metricInfo}`;
    })
    .join("\n");

  const subject = `[GBP Dashboard] データ欠損アラート（手動対応が必要）`;
  const text = `以下の店舗で${result.backfillDays}日を超えるデータ欠損が検出されました。
手動でのバックフィル実行が必要です。

${overdueList}

バックフィル実行結果:
  - 補完した日次指標: ${result.totalMetricDaysFilled} 日分
  - 補完した評価データ: ${result.totalRatingDaysFilled} 日分

管理画面 > システム設定 からバッチを手動実行してください。`;

  await sendEmail(emails, subject, text);
}

/**
 * ワーカーライフサイクル通知（起動/停止）
 */
export async function sendWorkerLifecycleNotification(
  event: "started" | "stopped"
): Promise<void> {
  const emails = await getAdminEmails();
  if (emails.length === 0) return;

  const eventLabel = event === "started" ? "起動" : "停止";
  const subject = `[GBP Dashboard] バッチワーカー${eventLabel}`;
  const text = `バッチワーカーが${eventLabel}しました。

日時: ${new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}`;

  await sendEmail(emails, subject, text);
}

/**
 * OAuthトークン失効通知
 * src/lib/gbp/notification.ts の notifyTokenInvalidation() に委譲
 */
export { notifyTokenInvalidation as sendTokenInvalidationNotification } from "@/lib/gbp/notification";
