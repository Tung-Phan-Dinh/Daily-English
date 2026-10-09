import { expect, test } from "@playwright/test";
import { admin, cleanupUsers, ensureUser, signIn } from "./helpers";

test.afterAll(async () => {
  await cleanupUsers(["e2e-learner@example.test", "e2e-viewer@example.test"]);
});

test("family dashboard is phone-first, fast and read-only", async ({ page }) => {
  const learner = await ensureUser("e2e-learner@example.test", "learner", "Tester");
  const viewer = await ensureUser("e2e-viewer@example.test", "viewer", "Mẹ", "Australia/Melbourne");
  await admin.from("family_links").upsert({ viewer_id: viewer, learner_id: learner }, { ignoreDuplicates: true });
  await signIn(page, "e2e-viewer@example.test");
  await expect(page).toHaveURL(/\/family/);

  // Warm load, then measure (target < 2 s on a mid-range phone over 4G).
  const t0 = Date.now();
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const ms = Date.now() - t0;
  expect(ms).toBeLessThan(2000);

  // Readable at 390 px: no horizontal scrolling, body text ≥ 16 px.
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  const bodySize = await page.evaluate(() => parseFloat(getComputedStyle(document.body).fontSize));
  expect(bodySize).toBeGreaterThanOrEqual(16);

  // Status strip, headline numbers and charts are present (Vietnamese by default for this viewer).
  await expect(page.getByText("Tuần này").first()).toBeVisible();
  await expect(page.getByText("Từ đã thuộc")).toBeVisible();
  await expect(page.getByRole("button", { name: /Lịch luyện tập/ })).toBeVisible();

  // Read-only: no practice controls, and learner APIs are refused.
  await expect(page.getByRole("button", { name: /Start today's session/ })).toHaveCount(0);
  const res = await page.request.post("/api/session/start", { data: {} });
  expect(res.status()).toBe(403);
  const save = await page.request.post("/api/dict/save", { data: { lemma: "pollution" } });
  expect(save.status()).toBe(403);
});
