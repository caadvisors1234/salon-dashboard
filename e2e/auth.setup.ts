import { test as setup, expect } from "@playwright/test";

if (!process.env.E2E_USER_EMAIL || !process.env.E2E_USER_PASSWORD) {
  throw new Error(
    "E2E_USER_EMAIL と E2E_USER_PASSWORD 環境変数を設定してください。"
  );
}

const E2E_USER_EMAIL = process.env.E2E_USER_EMAIL;
const E2E_USER_PASSWORD = process.env.E2E_USER_PASSWORD;

setup("authenticate", async ({ page }) => {
  await page.goto("/login");

  await page.getByLabel("メールアドレス").fill(E2E_USER_EMAIL);
  await page.getByLabel("パスワード").fill(E2E_USER_PASSWORD);
  await page.getByRole("button", { name: "ログイン" }).click();

  // ダッシュボードに遷移するまで待機
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });

  // 認証状態を保存
  await page.context().storageState({ path: "e2e/.auth/user.json" });
});
