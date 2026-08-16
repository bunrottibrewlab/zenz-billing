import { chromium } from "playwright";
import { mkdirSync } from "fs";

const BASE = "http://localhost:3000";
const OUT = "/private/tmp/claude-1679287368/-Users-vignesh-19005-Downloads-cafe-billing-web/c7755f94-9099-4041-be93-1c80c29c9120/scratchpad/screenshots";
mkdirSync(OUT, { recursive: true });

const SLUGS_TO_TRY = ["bunrotti-cafe"];

async function shot(page, name, selector) {
  try {
    if (selector) await page.waitForSelector(selector, { timeout: 6000 });
    await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
    console.log(`✓ ${name}`);
  } catch (e) {
    await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
    console.log(`⚠ ${name} (no selector match — screenshot taken anyway)`);
  }
}

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 300 });
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, // iPhone 14 viewport
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();

  // ── 1. Login page ──────────────────────────────────────────────────
  await page.goto(`${BASE}/login`);
  await shot(page, "01-login", "button");

  // ── 2. Register page ───────────────────────────────────────────────
  await page.goto(`${BASE}/register`);
  await shot(page, "02-register", "button");

  // ── 3. Customer menu — try known slugs ─────────────────────────────
  let menuSlug = null;
  for (const slug of SLUGS_TO_TRY) {
    const res = await page.goto(`${BASE}/${slug}`, { waitUntil: "domcontentloaded" });
    if (res?.status() === 200) {
      menuSlug = slug;
      console.log(`✓ Found customer menu at /${slug}`);
      break;
    }
  }

  if (menuSlug) {
    await page.goto(`${BASE}/${menuSlug}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    await shot(page, "03-customer-menu-top", null);

    // Scroll down to see items
    await page.evaluate(() => window.scrollBy(0, 250));
    await page.waitForTimeout(500);
    await shot(page, "04-customer-menu-items", null);

    // Tap ADD on first item
    const addBtn = await page.$("text=ADD");
    if (addBtn) {
      await addBtn.click();
      await page.waitForTimeout(600);
      await shot(page, "05-customer-item-added", null);

      // Scroll to bottom to see cart bar
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(400);
      await shot(page, "06-customer-cart-bar", null);

      // Open cart drawer
      const cartBar = await page.$("text=View your order");
      if (cartBar) {
        await cartBar.click();
        await page.waitForTimeout(800);
        await shot(page, "07-customer-cart-drawer", null);
      }
    }
  } else {
    console.log("⚠ No customer menu slug found — skipping menu tests");
  }

  // ── 4. Admin area (shows login redirect or dashboard) ─────────────
  await page.goto(`${BASE}/admin`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);
  await shot(page, "08-admin-redirect", null);

  // Desktop viewport for admin pages
  await ctx.close();
  const desktopCtx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });
  const desk = await desktopCtx.newPage();

  // Try admin pages — will show login redirect if not authed
  const adminPages = [
    { path: "/login", name: "09-login-desktop" },
    { path: "/register/setup", name: "10-register-setup" },
  ];

  for (const { path, name } of adminPages) {
    await desk.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
    await desk.waitForTimeout(800);
    await desk.screenshot({ path: `${OUT}/${name}.png` });
    console.log(`✓ ${name}`);
  }

  // Customer menu on desktop
  if (menuSlug) {
    await desk.goto(`${BASE}/${menuSlug}`, { waitUntil: "networkidle" });
    await desk.waitForTimeout(1500);
    await desk.screenshot({ path: `${OUT}/11-customer-menu-desktop.png` });
    console.log("✓ 11-customer-menu-desktop");
  }

  await browser.close();
  console.log(`\n📸 Screenshots saved to:\n${OUT}`);
})();
