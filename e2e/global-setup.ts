import { chromium, FullConfig } from "@playwright/test";
import * as path from "path";
import * as fs from "fs";

const TEST_EMAIL = process.env.TEST_ADMIN_EMAIL!;
const TEST_PASSWORD = process.env.TEST_ADMIN_PASSWORD!;
const BASE_URL = "http://localhost:3000";

export default async function globalSetup(_config: FullConfig) {
  if (!TEST_EMAIL || !TEST_PASSWORD) {
    throw new Error("Set TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD in .env.local");
  }

  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  // Use a GET redirect — the browser handles Set-Cookie headers properly on navigation
  const encodedEmail = encodeURIComponent(TEST_EMAIL);
  const encodedPass = encodeURIComponent(TEST_PASSWORD);
  const authUrl = `${BASE_URL}/api/test-auth?e=${encodedEmail}&p=${encodedPass}`;

  await page.goto(authUrl);
  await page.waitForLoadState("networkidle");

  // Verify we landed on the dashboard, not the login page
  const url = page.url();
  if (url.includes("/login") || url.includes("/register")) {
    throw new Error(
      `Test auth failed — ended up at ${url}. Check TEST_ADMIN_EMAIL / TEST_ADMIN_PASSWORD.`
    );
  }

  // Save authenticated state (cookies + localStorage)
  const stateDir = path.join(process.cwd(), "playwright", ".auth");
  fs.mkdirSync(stateDir, { recursive: true });
  await context.storageState({ path: path.join(stateDir, "admin.json") });

  await browser.close();
}
