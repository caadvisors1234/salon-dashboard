/**
 * バッチワーカー環境変数の読み込みとバリデーション
 */

import {
  batchEnvSchema,
  formatValidationErrors,
} from "../../../src/lib/env/validation";

export interface BatchConfig {
  // Supabase
  supabaseUrl: string;
  supabaseServiceRoleKey: string;

  // Google OAuth
  googleClientId: string;
  googleClientSecret: string;
  googleTokenEncryptionKey: string;

  // Batch scheduling
  dailyCron: string;
  monthlyCron: string;
  backfillDays: number;

  // Health check
  healthPort: number;

  // Notifications (Resend)
  resendApiKey: string;
  notificationFrom: string;
}

export function loadConfig(): BatchConfig {
  const result = batchEnvSchema.safeParse(process.env);

  if (!result.success) {
    throw new Error(formatValidationErrors(result.error));
  }

  const env = result.data;

  return {
    supabaseUrl: env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseServiceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,

    googleClientId: env.GOOGLE_CLIENT_ID,
    googleClientSecret: env.GOOGLE_CLIENT_SECRET,
    googleTokenEncryptionKey: env.GOOGLE_TOKEN_ENCRYPTION_KEY,

    dailyCron: env.BATCH_DAILY_CRON,
    monthlyCron: env.BATCH_MONTHLY_CRON,
    backfillDays: env.BATCH_BACKFILL_DAYS,

    healthPort: env.BATCH_HEALTH_PORT,

    resendApiKey: env.RESEND_API_KEY,
    notificationFrom: env.BATCH_NOTIFICATION_FROM,
  };
}

let _config: BatchConfig | null = null;

export function getConfig(): BatchConfig {
  if (!_config) {
    _config = loadConfig();
  }
  return _config;
}
