import { createClient } from "@supabase/supabase-js";
import type { Page } from "@playwright/test";
import { readFileSync } from "node:fs";

// Load .env.local without extra dependencies.
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

export const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

// Temporary e2e users get a random password and are deleted after the run (see cleanupUsers).
export const E2E_PASSWORD = process.env.E2E_PASSWORD ?? `e2e-${Date.now()}-Aa1!`;

export async function ensureUser(email: string, role: "learner" | "viewer", display_name: string, timezone = "Asia/Ho_Chi_Minh") {
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 200 });
  let id = list?.users.find((u) => u.email === email)?.id;
  if (id) {
    await admin.auth.admin.updateUserById(id, { password: E2E_PASSWORD });
  } else {
    const { data, error } = await admin.auth.admin.createUser({ email, password: E2E_PASSWORD, email_confirm: true });
    if (error) throw error;
    id = data.user.id;
  }
  await admin.from("profiles").upsert({ id, role, display_name, timezone, ui_lang: role === "viewer" ? "vi" : "en" });
  await admin.from("settings").upsert({ user_id: id }, { onConflict: "user_id", ignoreDuplicates: true });
  return id;
}

export async function cleanupUsers(emails: string[]) {
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 200 });
  for (const u of list?.users ?? []) if (u.email && emails.includes(u.email)) await admin.auth.admin.deleteUser(u.id);
}

/** Fresh start for the e2e learner: no sessions, cards or writing. */
export async function resetLearner(id: string) {
  await admin.from("writing_submissions").delete().eq("user_id", id);
  await admin.from("sessions").delete().eq("user_id", id);
  await admin.from("cards").delete().eq("user_id", id);
  await admin.from("attempts").delete().eq("user_id", id);
  await admin.from("placements").delete().eq("user_id", id);
}

/** Sign in through the real login form (email + password). */
export async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
}

/** Answer whatever item is on screen with a generic response (right or wrong doesn't matter). */
export async function answerCurrent(page: Page) {
  const main = page.locator("main");
  const tiles = main.getByRole("group", { name: "Word tiles" });
  if (await tiles.count()) {
    const n = await tiles.getByRole("button").count();
    for (let i = 0; i < n; i++) await tiles.getByRole("button").first().click();
    await main.getByRole("button", { name: /^Check/ }).click();
    return "tiles";
  }
  const group = main.getByRole("group").first();
  if (await group.count()) {
    // Options answer with the 1–4 keys; tokens (spot the error) need a click.
    if ((await group.getAttribute("aria-label")) === "Options") await page.keyboard.press("1");
    else await group.getByRole("button").first().click();
    await main.getByRole("button", { name: /^Continue/ }).first().waitFor({ timeout: 15_000 });
    return "option";
  }
  const input = main.locator("input[id^=ans-], input[id^=v-], textarea[id^=v-]").first();
  await input.fill("test answer");
  await page.keyboard.press("Enter");
  return "typed";
}

/** The learner's day kind (04:00 boundary in Vietnam), so tests know what today's session contains. */
export function learnerDayKind(): "weekday" | "saturday" | "sunday" {
  const shifted = new Date(Date.now() - 4 * 3600_000);
  const dow = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Ho_Chi_Minh", weekday: "short" }).format(shifted);
  return dow === "Sun" ? "sunday" : dow === "Sat" ? "saturday" : "weekday";
}
