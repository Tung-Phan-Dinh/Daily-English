import { expect, test } from "@playwright/test";
import { admin, cleanupUsers, ensureUser, resetLearner, signIn } from "./helpers";

const LEARNER = "e2e-learner2@example.test";
const ADMIN = "e2e-admin@example.test";

test.afterAll(async () => {
  await cleanupUsers([LEARNER, ADMIN]);
});

test("admin sees a past session's answers and grades the writing; the learner sees the grade", async ({ page, browser }) => {
  const learnerId = await ensureUser(LEARNER, "learner", "Tester");
  const adminId = await ensureUser(ADMIN, "learner", "Admin");
  await admin.from("profiles").update({ role: "admin" }).eq("id", adminId);
  await admin.from("family_links").upsert({ viewer_id: adminId, learner_id: learnerId }, { ignoreDuplicates: true });
  await resetLearner(learnerId);

  // A finished session from two days ago, with one grammar answer and a writing piece.
  const { data: item } = await admin.from("grammar_items").select("id, grammar_point_id, format, error_code").eq("format", "mcq").limit(1).single();
  const date = new Date(Date.now() - 2 * 86_400_000).toISOString().slice(0, 10);
  const { data: s } = await admin
    .from("sessions")
    .insert({
      user_id: learnerId, local_date: date, kind: "weekday", status: "completed", minutes: 27, xp: 120,
      plan: { v: 1, kind: "weekday", local_date: date, topic: { id: 1, slug: "education", name_en: "Education", name_vi: "Giáo dục" }, week_index: 0, blocks: ["grammar", "writing", "wrapup"], review: { entries: [], due_total: 0 }, grammar: { point_id: item!.grammar_point_id, head: [item!.id], tail_normal: [], tail_hard: [] }, writing: { task_id: null } },
      progress: { current: "finished", xp: 120, own_sentence_count: 0, words_learned: 0, blocks: { grammar: { status: "done", index: 1, correct: 0, answered: 1, ms: 0 }, writing: { status: "done", index: 0, correct: 0, answered: 1, ms: 0 }, wrapup: { status: "done", index: 0, correct: 0, answered: 0, ms: 0 } } },
    })
    .select("id")
    .single();
  await admin.from("attempts").insert({
    user_id: learnerId, session_id: s!.id, item_kind: "grammar", item_id: item!.id, grammar_point_id: item!.grammar_point_id,
    format: item!.format, response: "my wrong choice", correct: false, error_code: item!.error_code, local_date: date,
  });
  await admin.from("writing_submissions").insert({
    user_id: learnerId, session_id: s!.id, text: "Online learning are very flexible for student who work.", word_count: 9,
    status: "pending", local_date: date, hidden_from_viewers: false,
  });

  // Admin: list → detail → grade
  await signIn(page, ADMIN);
  await page.goto("/admin/sessions");
  await expect(page.getByRole("heading", { name: "Sessions" })).toBeVisible();
  await expect(page.getByText("Writing waiting for a grade")).toBeVisible();
  await page.getByRole("link", { name: /Writing waiting for a grade/ }).click();
  await expect(page.getByText("my wrong choice")).toBeVisible(); // his actual answer
  await expect(page.getByText("Online learning are very flexible")).toBeVisible();
  await page.getByLabel("Grammar (GRA)").selectOption("5.5");
  await page.getByLabel("Vocabulary (LR)").selectOption("6");
  await page.getByLabel("Comment for him (optional)").fill("Watch subject–verb agreement: learning IS.");
  await page.getByRole("button", { name: "Save grade" }).click();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();

  const { data: graded } = await admin.from("writing_submissions").select("teacher_bands, teacher_comment").eq("session_id", s!.id).single();
  expect(graded!.teacher_bands).toMatchObject({ gra: 5.5, lr: 6 });

  // Learner: My progress shows the teacher's grade and comment.
  const ctx = await browser.newContext();
  const lp = await ctx.newPage();
  await signIn(lp, LEARNER);
  await lp.goto("/progress");
  await lp.getByRole("button", { name: /words/ }).filter({ hasText: "Teacher" }).first().click();
  await expect(lp.getByText("Teacher's grade")).toBeVisible();
  await expect(lp.getByText("Watch subject–verb agreement")).toBeVisible();
  await ctx.close();
});
