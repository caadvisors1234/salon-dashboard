import { test, expect } from "@playwright/test";

test.describe("HPB CSVアップロード", () => {
  test("アップロードページに遷移できる", async ({ page }) => {
    await page.goto("/dashboard");

    // サイドバーのHPBアップロードリンクをクリック
    const uploadLink = page.getByRole("link", { name: "HPBアップロード" });
    await expect(uploadLink).toBeVisible();
    await uploadLink.click();
    await expect(page).toHaveURL(/\/dashboard\/hpb-upload/);
  });

  test("HPBアップロードページの要素が表示される", async ({ page }) => {
    await page.goto("/dashboard/hpb-upload");

    // ページ見出し
    await expect(
      page.getByRole("heading", { name: "HPBアップロード" })
    ).toBeVisible();

    // ファイル入力（hidden なので locator で確認）
    const fileInput = page.locator('input[type="file"][accept=".csv"]');
    await expect(fileInput).toBeAttached();

    // アップロードボタン
    await expect(
      page.getByRole("button", { name: "アップロード" })
    ).toBeVisible();
  });

  test("アップロード履歴セクションが表示される", async ({ page }) => {
    await page.goto("/dashboard/hpb-upload");

    // アップロード履歴の見出しまたはセクションが存在すること
    await expect(
      page.getByText("アップロード履歴")
    ).toBeVisible();
  });
});
