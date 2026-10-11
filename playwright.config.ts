import { defineConfig, devices } from "@playwright/test";

// Runs against the local dev stack: `supabase start`, `npm run seed`, then `npm run test:e2e`.
// Uses the installed Google Chrome locally (PW_CHANNEL=chromium to use Playwright's own build).
const channel = process.env.PW_CHANNEL ?? "chrome";
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3100";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 10_000 },
  reporter: [["list"]],
  use: { baseURL, trace: "retain-on-failure" },
  webServer: {
    command: "npm run dev -- -p 3100",
    url: baseURL + "/login",
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [
    { name: "laptop", testMatch: /(session|admin-review)\.spec\.ts/, use: { ...devices["Desktop Chrome"], channel, viewport: { width: 1366, height: 860 } } },
    { name: "phone", testMatch: /dashboard\.spec\.ts/, use: { ...devices["Pixel 7"], channel, viewport: { width: 390, height: 844 } } },
  ],
});
