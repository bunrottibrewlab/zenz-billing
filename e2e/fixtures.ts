import { test as base, Page } from "@playwright/test";

export { expect } from "@playwright/test";

type Fixtures = {
  slug: string;
  adminPage: Page;
};

export const test = base.extend<Fixtures>({
  slug: async ({}, use) => {
    const slug = process.env.TEST_SHOP_SLUG ?? "bunrotti-cafe";
    await use(slug);
  },
  adminPage: async ({ page, slug }, use) => {
    await page.goto(`/admin/${slug}/dashboard`);
    await page.waitForLoadState("networkidle");
    await use(page);
  },
});
