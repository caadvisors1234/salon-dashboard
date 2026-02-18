import { test, expect } from "@playwright/test";

test.describe("ダッシュボード", () => {
  test("ダッシュボードページが描画される", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/dashboard/);
    // ダッシュボード見出しが表示されること
    await expect(
      page.getByRole("heading", { name: "ダッシュボード" })
    ).toBeVisible();
  });

  test("サイドバーナビゲーションが表示される", async ({ page }) => {
    await page.goto("/dashboard");
    const nav = page.locator("nav");
    await expect(nav.first()).toBeVisible();

    // サイドバーにナビゲーション項目が存在すること
    await expect(
      page.getByRole("link", { name: "ダッシュボード" })
    ).toBeVisible();
  });

  test("adminロールのバッジが表示される", async ({ page }) => {
    await page.goto("/dashboard");
    // ロールバッジ（管理者）が表示されていること
    await expect(page.getByText("管理者")).toBeVisible();
  });

  test("ログアウトボタンが表示される", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(
      page.getByRole("button", { name: /ログアウト/i })
    ).toBeVisible();
  });
});
