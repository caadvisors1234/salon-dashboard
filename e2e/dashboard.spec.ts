import { test, expect } from "@playwright/test";

test.describe("ダッシュボード", () => {
  test("ダッシュボードページが描画される", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/dashboard/);
    // ページが何らかのコンテンツを含むことを確認
    await expect(page.locator("body")).not.toBeEmpty();
  });

  test("ナビゲーションが表示される", async ({ page }) => {
    await page.goto("/dashboard");
    // サイドバーまたはナビゲーション要素の存在を確認
    const nav = page.locator("nav");
    await expect(nav.first()).toBeVisible();
  });
});
