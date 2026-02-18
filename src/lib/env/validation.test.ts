import { describe, it, expect } from "vitest";
import { batchEnvSchema, webEnvSchema } from "./validation";

describe("batchEnvSchema", () => {
  const validEnv = {
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "test-key",
    GOOGLE_CLIENT_ID: "client-id",
    GOOGLE_CLIENT_SECRET: "client-secret",
    GOOGLE_TOKEN_ENCRYPTION_KEY:
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  };

  it("有効な環境変数を受け入れる", () => {
    const result = batchEnvSchema.safeParse(validEnv);
    expect(result.success).toBe(true);
  });

  it("デフォルト値が正しく設定される", () => {
    const result = batchEnvSchema.parse(validEnv);
    expect(result.BATCH_DAILY_CRON).toBe("0 18 * * *");
    expect(result.BATCH_MONTHLY_CRON).toBe("0 18 8 * *");
    expect(result.BATCH_BACKFILL_DAYS).toBe(30);
    expect(result.BATCH_HEALTH_PORT).toBe(3001);
  });

  it("無効な暗号化鍵を拒否する（短すぎる）", () => {
    const result = batchEnvSchema.safeParse({
      ...validEnv,
      GOOGLE_TOKEN_ENCRYPTION_KEY: "0123456789abcdef",
    });
    expect(result.success).toBe(false);
  });

  it("無効な暗号化鍵を拒否する（非16進数文字）", () => {
    const result = batchEnvSchema.safeParse({
      ...validEnv,
      GOOGLE_TOKEN_ENCRYPTION_KEY:
        "gggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggg",
    });
    expect(result.success).toBe(false);
  });

  it("無効なURLを拒否する", () => {
    const result = batchEnvSchema.safeParse({
      ...validEnv,
      NEXT_PUBLIC_SUPABASE_URL: "not-a-url",
    });
    expect(result.success).toBe(false);
  });

  it("無効なポート番号を拒否する（範囲外）", () => {
    const result = batchEnvSchema.safeParse({
      ...validEnv,
      BATCH_HEALTH_PORT: "99999",
    });
    expect(result.success).toBe(false);
  });

  it("無効なポート番号を拒否する（低すぎ）", () => {
    const result = batchEnvSchema.safeParse({
      ...validEnv,
      BATCH_HEALTH_PORT: "80",
    });
    expect(result.success).toBe(false);
  });

  it("有効なcron式を受け入れる", () => {
    const result = batchEnvSchema.safeParse({
      ...validEnv,
      BATCH_DAILY_CRON: "30 9 * * 1-5",
    });
    expect(result.success).toBe(true);
  });

  it("無効なcron式を拒否する", () => {
    const result = batchEnvSchema.safeParse({
      ...validEnv,
      BATCH_DAILY_CRON: "invalid cron",
    });
    expect(result.success).toBe(false);
  });
});

describe("webEnvSchema", () => {
  const validEnv = {
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
    REPORT_TOKEN_SECRET: "a-secret-that-is-long-enough",
    GOOGLE_TOKEN_ENCRYPTION_KEY:
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  };

  it("有効な環境変数を受け入れる", () => {
    const result = webEnvSchema.safeParse(validEnv);
    expect(result.success).toBe(true);
  });

  it("短すぎるREPORT_TOKEN_SECRETを拒否する", () => {
    const result = webEnvSchema.safeParse({
      ...validEnv,
      REPORT_TOKEN_SECRET: "short",
    });
    expect(result.success).toBe(false);
  });

  it("空のanon keyを拒否する", () => {
    const result = webEnvSchema.safeParse({
      ...validEnv,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
    });
    expect(result.success).toBe(false);
  });
});
