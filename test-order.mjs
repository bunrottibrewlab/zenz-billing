import { chromium } from "playwright";

const OUT = "/private/tmp/claude-1679287368/-Users-vignesh-19005-Downloads-cafe-billing-web/c7755f94-9099-4041-be93-1c80c29c9120/scratchpad/screenshots";

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 200 });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();

  await page.goto("http://localhost:3000/bunrotti-cafe", { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);

  // Add an item to cart
  const addBtn = await page.$("text=ADD");
  if (!addBtn) { console.log("ERROR: ADD button not found"); await browser.close(); process.exit(1); }
  await addBtn.click();
  await page.waitForTimeout(600);

  // Open cart drawer
  const cartBar = await page.$("text=View your order");
  if (!cartBar) { console.log("ERROR: Cart bar not found"); await browser.close(); process.exit(1); }
  await cartBar.click();
  await page.waitForTimeout(800);

  // Click Place Order
  const placeBtn = await page.$("button:has-text('Place Order')");
  if (!placeBtn) { console.log("ERROR: Place Order button not found"); await browser.close(); process.exit(1); }
  await placeBtn.click();

  // Wait for navigation
  await page.waitForTimeout(3000);
  const url = page.url();
  console.log("Final URL:", url);

  await page.screenshot({ path: `${OUT}/12-order-tracking.png` });

  const content = await page.content();
  if (content.includes("This page could not be found") || content.includes("404")) {
    console.log("ERROR: 404 detected");
  } else if (content.includes("Order #")) {
    console.log("SUCCESS: Order tracking page loaded");
  } else {
    console.log("UNKNOWN state — check screenshot");
  }

  await browser.close();
})();
