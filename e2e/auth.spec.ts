import { test, expect } from "@playwright/test";

test.describe("認証フロー", () => {
  test("ログインページが表示される", async ({ page }) => {
    // storageState をクリアした状態で検証
    await page.context().clearCookies();
    await page.goto("/login");
    await expect(
      page.getByRole("button", { name: "ログイン" })
    ).toBeVisible();
  });

  test("認証済みユーザーはダッシュボードにアクセスできる", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    // ダッシュボードの何らかのコンテンツが表示されることを確認
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("未認証ユーザーはログインにリダイレクトされる", async ({ browser }) => {
    // 新しいコンテキスト（認証なし）でアクセス
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);

    await context.close();
  });
});
