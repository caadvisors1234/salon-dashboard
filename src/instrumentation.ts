import { webEnvSchema, formatValidationErrors } from "@/lib/env/validation";

export function register() {
  if (process.env.NODE_ENV === "test") {
    return;
  }

  const result = webEnvSchema.safeParse(process.env);

  if (!result.success) {
    // 警告のみ。Vercel等では環境変数未設定でもデモページ等の動作を許容する。
    // 本番VPS環境ではDocker env_fileで全変数が供給される。
    console.warn(formatValidationErrors(result.error));
  }
}
