import { webEnvSchema, formatValidationErrors } from "@/lib/env/validation";

export function register() {
  if (process.env.NODE_ENV === "test") {
    return;
  }

  const result = webEnvSchema.safeParse(process.env);

  if (!result.success) {
    console.error(formatValidationErrors(result.error));
    // Vercel等の環境変数未設定環境（デモ専用デプロイ）ではthrowせず警告のみ
    if (process.env.SKIP_ENV_VALIDATION !== "true") {
      throw new Error("環境変数のバリデーションに失敗しました。ログを確認してください。");
    }
  }
}
