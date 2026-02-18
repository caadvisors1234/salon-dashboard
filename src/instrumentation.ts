import { webEnvSchema, formatValidationErrors } from "@/lib/env/validation";

export function register() {
  if (process.env.NODE_ENV === "test") {
    return;
  }

  const result = webEnvSchema.safeParse(process.env);

  if (!result.success) {
    console.error(formatValidationErrors(result.error));
    throw new Error("環境変数のバリデーションに失敗しました。ログを確認してください。");
  }
}
