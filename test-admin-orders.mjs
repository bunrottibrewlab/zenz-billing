import { chromium } from "playwright";

const OUT = "/private/tmp/claude-1679287368/-Users-vignesh-19005-Downloads-cafe-billing-web/c7755f94-9099-4041-be93-1c80c29c9120/scratchpad/screenshots";

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 200 });
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    // Simulate dark mode (system theme)
    colorScheme: "dark",
  });
  const page = await ctx.newPage();

  // Go to admin login
  await page.goto("http://localhost:3000/login", { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${OUT}/admin-orders-login.png` });
  console.log("✓ login page captured");

  // Try navigating directly to admin orders (will redirect to login if not authed)
  await page.goto("http://localhost:3000/admin/bunrotti-cafe/orders", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${OUT}/admin-orders-dark.png` });
  console.log("✓ admin orders (dark) captured at:", page.url());

  // Also capture light mode
  const lightCtx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: "light",
  });
  const lightPage = await lightCtx.newPage();
  await lightPage.goto("http://localhost:3000/admin/bunrotti-cafe/orders", { waitUntil: "domcontentloaded" });
  await lightPage.waitForTimeout(2000);
  await lightPage.screenshot({ path: `${OUT}/admin-orders-light.png` });
  console.log("✓ admin orders (light) captured");

  await browser.close();
})();
