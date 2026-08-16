import { Page } from "@playwright/test";

const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL ?? "";
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD ?? "";

export async function loginAsAdmin(page: Page) {
  await page.goto("/login");
  await page.locator('input[type="email"]').fill(ADMIN_EMAIL);
  await page.locator('input[type="password"]').fill(ADMIN_PASSWORD);
  await page.locator('button[type="submit"]').click();
  // Wait for redirect to admin dashboard
  await page.waitForURL(/\/admin\/.+\/dashboard/, { timeout: 10000 });
}

export function shopSlug(): string {
  return process.env.TEST_SHOP_SLUG ?? "";
}

export function adminBase(slug: string): string {
  return `/admin/${slug}`;
}
