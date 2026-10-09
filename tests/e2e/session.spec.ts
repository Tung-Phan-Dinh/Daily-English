import { expect, test } from "@playwright/test";
import { answerCurrent, cleanupUsers, ensureUser, resetLearner, signIn } from "./helpers";

const EMAIL = "e2e-learner@example.test";

test.beforeAll(async () => {
  const id = await ensureUser(EMAIL, "learner", "Tester");
  await resetLearner(id);
});
test.afterAll(async () => {
  await cleanupUsers([EMAIL]);
});

test("a full session runs end to end, resumes after reload, and can't be repeated", async ({ page }) => {
  test.setTimeout(300_000); // includes real AI grading when OPENAI_API_KEY is set
  await signIn(page, EMAIL);
  await expect(page).toHaveURL(/\/today/);
  await page.getByRole("button", { name: /Start today's session|Start Saturday's session|Start the weekly check/ }).click();
  await expect(page).toHaveURL(/\/session/);
  // The URL changes before the player renders; wait for the session progress bar.
  await expect(page.getByRole("list", { name: "Session progress" })).toBeVisible({ timeout: 30_000 });

  const main = page.locator("main");
  const continueBtn = main.getByRole("button", { name: /^(Continue|Start 10 questions|Next word|Quick check|Got it)/ });

  // Walk the session; reload once in the middle of the grammar block.
  let reloaded = false;
  for (let step = 0; step < 80; step++) {
    if (await page.getByRole("heading", { name: /Nice work/ }).count()) break;
    if (await main.getByRole("region", { name: "Passage" }).or(main.getByRole("tab", { name: "Passage" })).count()) {
      // Reading: answer every question, then submit.
      const radios = main.locator('[aria-label="Questions"] fieldset');
      for (let i = 0; i < (await radios.count()); i++) await radios.nth(i).locator("input[type=radio]").first().check();
      const blanks = main.locator('[aria-label="Questions"] input[type=text], [aria-label="Questions"] input:not([type])');
      for (let i = 0; i < (await blanks.count()); i++) await blanks.nth(i).fill("classmates");
      page.once("dialog", (d) => d.accept());
      await main.getByRole("button", { name: "Submit answers" }).first().click();
      await expect(main.getByText(/correct$/).first()).toBeVisible();
      await main.getByRole("button", { name: /^Continue/ }).first().click();
      continue;
    }
    if (await main.locator("#essay").count()) {
      const words = "Online learning is flexible and students can attend classes at night while they work during the day. ".repeat(6);
      await main.locator("#essay").fill(words);
      await main.getByRole("button", { name: "Submit for feedback" }).click();
      // Without an OpenAI key the paragraph is queued; with one, feedback appears.
      await expect(main.getByText(/Your paragraph is saved|Feedback|Rewrite one sentence/).first()).toBeVisible({ timeout: 60_000 });
      if (await main.getByRole("button", { name: /^Continue/ }).count()) await main.getByRole("button", { name: /^Continue/ }).first().click();
      continue;
    }
    // Rewrite step after AI feedback (only when an OpenAI key is configured).
    if (await main.locator("#rewrite").count()) {
      const check = main.getByRole("button", { name: /Check my rewrite|Try again/ });
      if (await check.isDisabled().catch(() => true)) {
        await page.waitForTimeout(500); // the grader is still checking
        continue;
      }
      await main.locator("#rewrite").fill("Online learning is flexible for students who work.");
      await check.click();
      // Wait until the check finishes: the button is re-enabled (hint) or the step is done.
      await expect(async () => {
        const stillBusy = (await main.locator("#rewrite").count()) > 0 && (await check.isDisabled().catch(() => false));
        expect(stillBusy).toBe(false);
      }).toPass({ timeout: 90_000 });
      continue;
    }
    if (await continueBtn.count()) {
      const btn = continueBtn.first();
      // A busy (disabled) button means a request is in flight: look again shortly.
      if (await btn.isDisabled().catch(() => true)) {
        await page.waitForTimeout(250);
        continue;
      }
      await btn.click({ timeout: 5_000 }).catch(() => {});
      continue;
    }
    const pos = await main.getByText(/^\d+ \/ \d+$/).first().textContent({ timeout: 1500 }).catch(() => null);
    if (!reloaded && pos?.startsWith("3 /") && (await page.getByText("Grammar focus").count())) {
      await page.reload();
      await expect(main.getByText(/^3 \/ \d+$/)).toBeVisible(); // resumed exactly where he stopped
      reloaded = true;
    }
    // Still loading? Wait for the next actionable control before answering.
    if (!(await main.locator("button, input, textarea").count())) {
      await main.locator("button, input, textarea").first().waitFor({ timeout: 15_000 });
      continue;
    }
    // Still loading? Wait for the next actionable control before answering.
    if (!(await main.locator("button, input, textarea").count())) {
      await main.locator("button, input, textarea").first().waitFor({ timeout: 15_000 });
      continue;
    }
    await answerCurrent(page);
    await expect(main.getByRole("button", { name: /^Continue/ }).first()).toBeVisible();
  }

  await expect(page.getByRole("heading", { name: /Nice work/ })).toBeVisible();
  await page.getByRole("button", { name: "Done" }).click();
  await expect(page.getByRole("heading", { name: /Done for today/ })).toBeVisible();
  expect(reloaded).toBe(true);

  // A second session is impossible: new tab, refresh, or direct API call.
  const res = await page.request.post("/api/session/start", { data: {} });
  expect((await res.json()).status).toBe("done_for_today");
  const page2 = await page.context().newPage();
  await page2.goto("/session");
  await expect(page2).toHaveURL(/\/today/);
});

test("grammar block is fully operable by keyboard", async ({ page }) => {
  const id = await ensureUser(EMAIL, "learner", "Tester");
  await resetLearner(id);
  await signIn(page, EMAIL);
  await page.goto("/session");
  await expect(page.getByRole("list", { name: "Session progress" })).toBeVisible({ timeout: 30_000 });
  const main = page.locator("main");
  await expect(main.getByRole("button", { name: /Continue|Start 10 questions/ }).first()).toBeVisible();
  // Empty review → Continue (focused), rule card → Start (focused)
  if (await main.getByRole("button", { name: "Continue" }).count()) await page.keyboard.press("Enter");
  await expect(main.getByRole("button", { name: /Start 10 questions/ })).toBeFocused();
  await page.keyboard.press("Enter");
  for (let i = 0; i < 3; i++) {
    const hasInput = await main.locator("input[id^=ans-]").count();
    if (hasInput) {
      await page.keyboard.type("are");
      await page.keyboard.press("Enter");
    } else if (await main.getByRole("group", { name: "Options" }).count()) {
      await page.keyboard.press("1");
    } else {
      // tokens / tiles: Tab to the first control and press Enter
      await page.keyboard.press("Tab");
      await page.keyboard.press("Enter");
      if (await main.getByRole("button", { name: /^Check/ }).count()) {
        for (let k = 0; k < 10 && (await main.getByRole("group", { name: "Word tiles" }).getByRole("button").count()); k++) {
          await main.getByRole("group", { name: "Word tiles" }).getByRole("button").first().focus();
          await page.keyboard.press("Enter");
        }
        await main.getByRole("button", { name: /^Check/ }).focus();
        await page.keyboard.press("Enter");
      }
    }
    await expect(main.getByRole("button", { name: /^Continue/ })).toBeFocused();
    await page.keyboard.press("v"); // Vietnamese toggle
    await page.keyboard.press("Enter");
  }
  // Esc pauses and saves
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/\/today/);
});
