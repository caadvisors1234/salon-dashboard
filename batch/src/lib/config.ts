/**
 * バッチワーカー環境変数の読み込みとバリデーション
 */

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

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Required environment variable ${key} is not set`);
  }
  return value;
}

function optionalEnv(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}

export function loadConfig(): BatchConfig {
  return {
    supabaseUrl: requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    supabaseServiceRoleKey: requireEnv("SUPABASE_SERVICE_ROLE_KEY"),

    googleClientId: requireEnv("GOOGLE_CLIENT_ID"),
    googleClientSecret: requireEnv("GOOGLE_CLIENT_SECRET"),
    googleTokenEncryptionKey: requireEnv("GOOGLE_TOKEN_ENCRYPTION_KEY"),

    dailyCron: optionalEnv("BATCH_DAILY_CRON", "0 18 * * *"),
    monthlyCron: optionalEnv("BATCH_MONTHLY_CRON", "0 18 8 * *"),
    backfillDays: parseInt(optionalEnv("BATCH_BACKFILL_DAYS", "30"), 10),

    healthPort: parseInt(optionalEnv("BATCH_HEALTH_PORT", "3001"), 10),

    resendApiKey: optionalEnv("RESEND_API_KEY", ""),
    notificationFrom: optionalEnv("BATCH_NOTIFICATION_FROM", "onboarding@resend.dev"),
  };
}

let _config: BatchConfig | null = null;

export function getConfig(): BatchConfig {
  if (!_config) {
    _config = loadConfig();
  }
  return _config;
}
