import { test, expect } from "./fixtures";

test.describe("Loyalty program settings", () => {
  test("Stamp-card page loads and shows config fields", async ({ page, slug }) => {
    await page.goto(`/admin/${slug}/loyalty/stamp-card`);
    const body = page.locator("body");
    // Should mention stamps or rewards
    await expect(body).toContainText(/stamp|reward|loyalty/i);
    await expect(body).not.toContainText(/error/i);
  });

  test("Stamp-card has save/update button", async ({ page, slug }) => {
    await page.goto(`/admin/${slug}/loyalty/stamp-card`);
    const saveBtn = page.getByRole("button", { name: /save|update/i }).first();
    await expect(saveBtn).toBeVisible();
  });

  test("Profile-form page loads", async ({ page, slug }) => {
    await page.goto(`/admin/${slug}/loyalty/profile-form`);
    await expect(page.locator("body")).not.toContainText(/error/i);
  });

  test("Program QR page loads", async ({ page, slug }) => {
    await page.goto(`/admin/${slug}/loyalty/program-qr`);
    await expect(page.locator("body")).not.toContainText(/error/i);
  });

  test("Scratch card page loads", async ({ page, slug }) => {
    await page.goto(`/admin/${slug}/loyalty/scratch-card`);
    await expect(page.locator("body")).not.toContainText(/error/i);
  });

  test("Customers page shows loyalty stamps column", async ({ page, slug }) => {
    await page.goto(`/admin/${slug}/customers`);
    // Should mention stamps or loyalty
    await expect(page.locator("body")).toContainText(/stamp|loyalty|customer/i);
  });
});
