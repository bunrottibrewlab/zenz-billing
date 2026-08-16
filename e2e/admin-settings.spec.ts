import { test, expect } from "./fixtures";

test.describe("Admin Settings page", () => {
  test.beforeEach(async ({ page, slug }) => {
    await page.goto(`/admin/${slug}/settings`);
  });

  test("shows shop name field", async ({ page }) => {
    await expect(page.getByLabel(/shop name/i)).toBeVisible();
  });

  test("shows currency selector", async ({ page }) => {
    const currencyField = page.getByLabel(/currency/i);
    await expect(currencyField).toBeVisible();
  });

  test("shows GST settings", async ({ page }) => {
    await expect(page.getByText(/gst/i)).toBeVisible();
  });

  test("shows bill settings section", async ({ page }) => {
    // Bill prefix / starting number
    const body = page.locator("body");
    await expect(body).toContainText(/bill/i);
  });

  test("shows printer size option", async ({ page }) => {
    const body = page.locator("body");
    await expect(body).toContainText(/printer/i);
  });

  test("shows dineout charge field", async ({ page }) => {
    const body = page.locator("body");
    await expect(body).toContainText(/dineout/i);
  });

  test("save button is present and clickable", async ({ page }) => {
    const saveBtn = page.getByRole("button", { name: /save/i }).first();
    await expect(saveBtn).toBeVisible();
    await expect(saveBtn).toBeEnabled();
  });

  test("can update shop name and see success", async ({ page }) => {
    const shopNameInput = page.getByLabel(/shop name/i);
    await shopNameInput.clear();
    await shopNameInput.fill("Test Cafe Updated");

    const saveBtn = page.getByRole("button", { name: /save/i }).first();
    await saveBtn.click();

    // Expect success toast / message
    await expect(
      page.locator("body").getByText(/saved|success|updated/i)
    ).toBeVisible({ timeout: 5000 });

    // Restore original (best effort)
    await shopNameInput.clear();
    await shopNameInput.fill("Test Cafe");
    await saveBtn.click();
  });
});
