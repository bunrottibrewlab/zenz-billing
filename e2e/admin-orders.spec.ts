import { test, expect } from "./fixtures";

test.describe("Admin Orders management", () => {
  test.beforeEach(async ({ page, slug }) => {
    await page.goto(`/admin/${slug}/orders`);
  });

  test("shows Pending / Ready / Completed tabs", async ({ page }) => {
    await expect(page.getByRole("button", { name: /pending/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /ready/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /completed/i })).toBeVisible();
  });

  test("shows Refresh button", async ({ page }) => {
    await expect(page.getByRole("button", { name: /refresh/i })).toBeVisible();
  });

  test("shows New Order button", async ({ page }) => {
    await expect(page.getByRole("button", { name: /new order/i })).toBeVisible();
  });

  test("New Order modal opens with menu", async ({ page }) => {
    await page.getByRole("button", { name: /new order/i }).click();
    // Modal should appear
    await expect(page.getByText(/dine.?in|takeaway|order type/i)).toBeVisible({ timeout: 5000 });
    // Close modal
    await page.keyboard.press("Escape");
  });

  test("New Order modal has Dine-in and Takeaway toggle", async ({ page }) => {
    await page.getByRole("button", { name: /new order/i }).click();
    await expect(page.getByText(/dine.?in/i)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/takeaway/i)).toBeVisible();
    await page.keyboard.press("Escape");
  });

  test("New Order modal has Place Order button", async ({ page }) => {
    await page.getByRole("button", { name: /new order/i }).click();
    await expect(page.getByRole("button", { name: /place order/i })).toBeVisible({ timeout: 5000 });
    await page.keyboard.press("Escape");
  });

  test("can switch between Pending and Completed tabs", async ({ page }) => {
    await page.getByRole("button", { name: /completed/i }).click();
    // Should stay on orders page
    await expect(page).toHaveURL(/orders/);

    await page.getByRole("button", { name: /pending/i }).click();
    await expect(page).toHaveURL(/orders/);
  });

  test("cancel order shows custom confirmation dialog", async ({ page }) => {
    // Only runs if there is an active order; skip gracefully if none
    const cancelBtn = page.getByRole("button", { name: /cancel/i }).first();
    const hasCancelBtn = await cancelBtn.isVisible().catch(() => false);

    if (!hasCancelBtn) {
      test.skip();
      return;
    }

    await cancelBtn.click();
    // Custom modal — not native browser confirm
    await expect(page.getByText(/keep order/i)).toBeVisible({ timeout: 3000 });
    await expect(page.getByRole("button", { name: /cancel order/i })).toBeVisible();

    // Dismiss
    await page.getByRole("button", { name: /keep order/i }).click();
  });
});
