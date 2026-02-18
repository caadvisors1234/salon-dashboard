import { z } from "zod";

const hexKey64 = z
  .string()
  .regex(/^[0-9a-fA-F]{64}$/, "64文字の16進数文字列が必要です");

const cronExpression = z
  .string()
  .regex(
    /^(\*|[0-9,/-]+)\s+(\*|[0-9,/-]+)\s+(\*|[0-9,/-]+)\s+(\*|[0-9,/-]+)\s+(\*|[0-9,/-]+)$/,
    "有効なcron式が必要です（例: 0 18 * * *）"
  );

/**
 * バッチワーカー用環境変数スキーマ
 */
export const batchEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url("有効なURLが必要です"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, "値が必要です"),
  GOOGLE_CLIENT_ID: z.string().min(1, "値が必要です"),
  GOOGLE_CLIENT_SECRET: z.string().min(1, "値が必要です"),
  GOOGLE_TOKEN_ENCRYPTION_KEY: hexKey64,
  BATCH_DAILY_CRON: cronExpression.default("0 18 * * *"),
  BATCH_MONTHLY_CRON: cronExpression.default("0 18 8 * *"),
  BATCH_BACKFILL_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  BATCH_HEALTH_PORT: z.coerce
    .number()
    .int()
    .min(1024)
    .max(65535)
    .default(3001),
  RESEND_API_KEY: z.string().default(""),
  BATCH_NOTIFICATION_FROM: z.string().default("onboarding@resend.dev"),
});

export type BatchEnv = z.infer<typeof batchEnvSchema>;

/**
 * Web アプリ用環境変数スキーマ
 */
export const webEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url("有効なURLが必要です"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, "値が必要です"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, "値が必要です"),
  REPORT_TOKEN_SECRET: z.string().min(16, "16文字以上必要です"),
  GOOGLE_TOKEN_ENCRYPTION_KEY: hexKey64,
});

export type WebEnv = z.infer<typeof webEnvSchema>;

/**
 * バリデーションエラーを見やすくフォーマットする
 */
export function formatValidationErrors(error: z.ZodError): string {
  const lines = error.issues.map(
    (issue) => `  - ${issue.path.join(".")}: ${issue.message}`
  );
  return `環境変数のバリデーションに失敗しました:\n${lines.join("\n")}`;
}
