import { test, expect } from "./fixtures";

test.describe("Admin sidebar tabs", () => {
  test("Dashboard loads with stats", async ({ adminPage: page, slug }) => {
    await expect(page).toHaveURL(`/admin/${slug}/dashboard`);
    // Sidebar is visible
    await expect(page.getByText("Dashboard")).toBeVisible();
    await expect(page.getByText("Orders")).toBeVisible();
    await expect(page.getByText("Menu")).toBeVisible();
    await expect(page.getByText("Loyalty")).toBeVisible();
    await expect(page.getByText("Settings")).toBeVisible();
  });

  test("Orders tab loads order list", async ({ adminPage: page, slug }) => {
    await page.getByRole("link", { name: /Orders/ }).click();
    await expect(page).toHaveURL(`/admin/${slug}/orders`);
    // Tab buttons visible
    await expect(page.getByRole("button", { name: /pending/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /ready/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /completed/i })).toBeVisible();
  });

  test("Orders tab has New Order button", async ({ adminPage: page, slug }) => {
    await page.goto(`/admin/${slug}/orders`);
    await expect(page.getByRole("button", { name: /new order/i })).toBeVisible();
  });

  test("Menu tab loads categories and items", async ({ adminPage: page, slug }) => {
    await page.goto(`/admin/${slug}/menu`);
    await expect(page).toHaveURL(`/admin/${slug}/menu`);
    // Some heading from menu manager
    await expect(page.getByText(/menu/i).first()).toBeVisible();
  });

  test("QR Codes tab loads", async ({ adminPage: page, slug }) => {
    await page.goto(`/admin/${slug}/qr`);
    await expect(page).toHaveURL(`/admin/${slug}/qr`);
    await expect(page.locator("body")).toContainText(/QR/i);
  });

  test("Customize tab loads", async ({ adminPage: page, slug }) => {
    await page.goto(`/admin/${slug}/customize`);
    await expect(page).toHaveURL(`/admin/${slug}/customize`);
    await expect(page.locator("body")).not.toContainText(/error/i);
  });

  test("Loyalty stamp-card tab loads", async ({ adminPage: page, slug }) => {
    await page.goto(`/admin/${slug}/loyalty/stamp-card`);
    await expect(page).toHaveURL(`/admin/${slug}/loyalty/stamp-card`);
    await expect(page.locator("body")).not.toContainText(/error/i);
  });

  test("Loyalty profile-form tab loads", async ({ adminPage: page, slug }) => {
    await page.goto(`/admin/${slug}/loyalty/profile-form`);
    await expect(page.locator("body")).not.toContainText(/error/i);
  });

  test("Loyalty program-qr tab loads", async ({ adminPage: page, slug }) => {
    await page.goto(`/admin/${slug}/loyalty/program-qr`);
    await expect(page.locator("body")).not.toContainText(/error/i);
  });

  test("Customers tab loads", async ({ adminPage: page, slug }) => {
    await page.goto(`/admin/${slug}/customers`);
    await expect(page).toHaveURL(`/admin/${slug}/customers`);
    await expect(page.locator("body")).not.toContainText(/error/i);
  });

  test("Settings tab loads", async ({ adminPage: page, slug }) => {
    await page.goto(`/admin/${slug}/settings`);
    await expect(page).toHaveURL(`/admin/${slug}/settings`);
    await expect(page.locator("body")).not.toContainText(/error/i);
  });

  test("Sidebar stays fixed while content scrolls", async ({ adminPage: page, slug }) => {
    await page.goto(`/admin/${slug}/menu`);
    // Sidebar should have h-screen and sticky positioning
    const sidebar = page.locator("aside").first();
    const position = await sidebar.evaluate((el) =>
      window.getComputedStyle(el).position
    );
    expect(position).toBe("sticky");
  });
});
