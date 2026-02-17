import { test, expect } from "@playwright/test";

test.describe("認証フロー", () => {
  test("ログインページが表示される", async ({ page }) => {
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
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test.describe("未認証", () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test("未認証リクエストはログインにリダイレクトされる", async ({
      request,
    }) => {
      const response = await request.fetch("/dashboard", {
        maxRedirects: 0,
      });
      // Next.js middleware は 307 (Temporary Redirect) を返す
      expect([301, 302, 307, 308]).toContain(response.status());
      expect(response.headers()["location"]).toContain("/login");
    });
  });
});
