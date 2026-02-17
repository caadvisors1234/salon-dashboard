import { test, expect } from "@playwright/test";
import path from "path";

const CSV_FIXTURE = path.resolve(__dirname, "../test/fixtures/hpb-test.csv");

test.describe("HPB CSVアップロード", () => {
  test.fixme("アップロードページに遷移できる", async ({ page }) => {
    await page.goto("/dashboard");
    const uploadLink = page.getByRole("link", { name: /HPB|アップロード|CSV/i });
    await expect(uploadLink).toBeVisible();
    await uploadLink.click();
    await expect(page).toHaveURL(/upload|hpb/i);
  });

  test.fixme("CSVファイルをアップロードできる", async ({ page }) => {
    await page.goto("/dashboard");
    const fileInput = page.locator('input[type="file"]');
    await expect(fileInput).toBeVisible();
    await fileInput.setInputFiles(CSV_FIXTURE);
    await expect(
      page.getByRole("button", { name: /アップロード|送信|確認/i })
    ).toBeVisible();
  });
});
