// Row-level security tests against a LOCAL Supabase (supabase start + migrations + seed).
//   npm run test:rls
// Signs in as the real viewer and learner accounts and tries every write.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });

// Temporary test users (deleted in afterAll so only the real accounts remain).
const TEST_PASSWORD = `rls-${Math.random().toString(36).slice(2)}-Aa1!`;
const created: string[] = [];

async function ensureUser(email: string, role: string, timezone = "Asia/Ho_Chi_Minh") {
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 200 });
  let id = list?.users.find((u) => u.email === email)?.id;
  if (id) {
    await admin.auth.admin.updateUserById(id, { password: TEST_PASSWORD });
  } else {
    const { data, error } = await admin.auth.admin.createUser({ email, password: TEST_PASSWORD, email_confirm: true });
    if (error) throw error;
    id = data.user.id;
  }
  created.push(id);
  await admin.from("profiles").upsert({ id, role, display_name: role, timezone });
  return id;
}

async function signIn(email: string): Promise<SupabaseClient> {
  const c = createClient(URL, ANON, { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword({ email, password: TEST_PASSWORD });
  if (error) throw error;
  return c;
}

afterAll(async () => {
  for (const id of created) await admin.auth.admin.deleteUser(id);
});

/** A write is blocked if it errors or affects no rows. */
async function blocked(p: PromiseLike<{ error: unknown; data: unknown }>) {
  const { error, data } = await p;
  if (error) return true;
  return Array.isArray(data) ? data.length === 0 : data === null;
}

const ALL_TABLES = [
  "profiles", "family_links", "settings", "topics", "grammar_points", "grammar_items", "dictionary_entries",
  "word_lists", "vocab_items", "reading_passages", "reading_questions", "writing_tasks", "sessions", "cards",
  "review_logs", "attempts", "writing_submissions", "writing_errors", "weakness", "lookups", "placements",
  "weekly_summaries", "ai_calls", "session_resets", "content_batches", "vocab_snapshots",
];

let learnerId: string;
let viewerId: string;
let otherLearnerId: string;
let viewer: SupabaseClient;
let learner: SupabaseClient;
let otherLearner: SupabaseClient;
let learnerSessionId: string;

beforeAll(async () => {
  learnerId = await ensureUser("rls-learner@example.test", "learner");
  viewerId = await ensureUser("rls-viewer@example.test", "viewer", "Australia/Melbourne");
  otherLearnerId = await ensureUser("rls-other@example.test", "learner");
  await admin.from("family_links").upsert({ viewer_id: viewerId, learner_id: learnerId }, { ignoreDuplicates: true });
  // A session and a writing piece for the linked learner, one hidden.
  const { data: today } = await admin.rpc("learner_today", { uid: learnerId });
  await admin.from("sessions").delete().eq("user_id", learnerId);
  const { data: s } = await admin
    .from("sessions")
    .insert({ user_id: learnerId, local_date: today, plan: { v: 1 }, progress: {} })
    .select("id")
    .single();
  learnerSessionId = s!.id;
  await admin.from("writing_submissions").delete().eq("user_id", learnerId);
  const { error: wErr } = await admin.from("writing_submissions").insert([
    { user_id: learnerId, session_id: learnerSessionId, text: "visible", word_count: 1, local_date: today, status: "graded", hidden_from_viewers: false },
    { user_id: learnerId, session_id: null, text: "hidden piece", word_count: 2, local_date: "2026-01-01", status: "graded", hidden_from_viewers: true },
  ]);
  if (wErr) throw new Error(`setup: ${wErr.message}`);
  viewer = await signIn("rls-viewer@example.test");
  learner = await signIn("rls-learner@example.test");
  otherLearner = await signIn("rls-other@example.test");
}, 60_000);

describe("viewer accounts are read-only", () => {
  it.each(ALL_TABLES)("cannot insert into %s", async (table) => {
    expect(await blocked(viewer.from(table).insert({ user_id: viewerId } as never).select())).toBe(true);
  });

  // A real column per table, so a failure is RLS/grants and not a schema error.
  const UPDATE_COL: Record<string, [string, unknown]> = {
    profiles: ["display_name", "x"], family_links: ["created_at", "2026-01-01"], settings: ["sound", true],
    topics: ["name_en", "x"], grammar_points: ["title", "x"], grammar_items: ["status", "retired"],
    dictionary_entries: ["definition_en", "x"], word_lists: ["rank", 1], vocab_items: ["status", "retired"],
    reading_passages: ["status", "retired"], reading_questions: ["answer", "x"], writing_tasks: ["status", "retired"],
    sessions: ["xp", 9999], cards: ["stability", 999], review_logs: ["correct", true], attempts: ["correct", true],
    writing_submissions: ["hidden_from_viewers", false], writing_errors: ["code", "OTH"], weakness: ["score", 0],
    lookups: ["saved", true], placements: ["known_lemmas", []], weekly_summaries: ["body_en", "x"],
    ai_calls: ["cost_usd", 0], session_resets: ["reason", "x"], content_batches: ["status", "x"], vocab_snapshots: ["mastered", 999],
  };
  it.each(ALL_TABLES)("cannot update %s", async (table) => {
    const [col, val] = UPDATE_COL[table];
    const res = await viewer.from(table).update({ [col]: val } as never).not(col as never, "is" as never, null as never).select();
    expect(res.error !== null || (res.data ?? []).length === 0).toBe(true);
    if (res.error) expect(res.error.code).not.toBe("PGRST204"); // not a schema error
  });

  it("cannot change its own role or profile directly", async () => {
    expect(await blocked(viewer.from("profiles").update({ role: "admin" }).eq("id", viewerId).select())).toBe(true);
    expect(await blocked(viewer.from("profiles").update({ display_name: "x" }).eq("id", viewerId).select())).toBe(true);
  });

  it("cannot delete anything", async () => {
    for (const table of ["sessions", "writing_submissions", "cards", "profiles"]) {
      const res = await viewer.from(table).delete().neq("id" as never, "00000000-0000-0000-0000-000000000000" as never).select();
      expect(res.error !== null || (res.data ?? []).length === 0).toBe(true);
    }
  });

  it("can read the linked learner's sessions", async () => {
    const { data } = await viewer.from("sessions").select("id").eq("user_id", learnerId);
    expect(data?.length).toBe(1);
  });

  it("cannot see writing the learner hid", async () => {
    const { data } = await viewer.from("writing_submissions").select("text").eq("user_id", learnerId);
    expect(data?.map((d) => d.text)).toEqual(["visible"]);
  });

  it("cannot read an unlinked learner's data", async () => {
    const { data } = await viewer.from("sessions").select("id").eq("user_id", otherLearnerId);
    expect(data ?? []).toEqual([]);
  });

  it("cannot read AI spend or reset logs", async () => {
    expect((await viewer.from("ai_calls").select("id")).data ?? []).toEqual([]);
    expect((await viewer.from("session_resets").select("id")).data ?? []).toEqual([]);
  });
});

describe("learner writes are limited to today's open session", () => {
  it("cannot create a second session for today (unique constraint)", async () => {
    const { data: today } = await admin.rpc("learner_today", { uid: learnerId });
    const res = await learner.from("sessions").insert({ user_id: learnerId, local_date: today, plan: {}, progress: {} }).select();
    expect(res.error).not.toBeNull();
  });

  it("cannot create a session for another day (device clock spoof)", async () => {
    const res = await learner.from("sessions").insert({ user_id: learnerId, local_date: "2030-01-01", plan: {}, progress: {} }).select();
    expect(res.error).not.toBeNull();
  });

  it("can record an attempt for today's open session", async () => {
    const { data: today } = await admin.rpc("learner_today", { uid: learnerId });
    const res = await learner.from("attempts").insert({
      user_id: learnerId, session_id: learnerSessionId, item_kind: "grammar", correct: true, local_date: today,
    }).select();
    expect(res.error).toBeNull();
  });

  it("cannot record attempts once the session is completed", async () => {
    await admin.from("sessions").update({ status: "completed" }).eq("id", learnerSessionId);
    const { data: today } = await admin.rpc("learner_today", { uid: learnerId });
    const res = await learner.from("attempts").insert({
      user_id: learnerId, session_id: learnerSessionId, item_kind: "grammar", correct: true, local_date: today,
    }).select();
    expect(res.error).not.toBeNull();
    // ...and cannot reopen it
    expect(await blocked(learner.from("sessions").update({ status: "in_progress" }).eq("id", learnerSessionId).select())).toBe(true);
    await admin.from("sessions").update({ status: "in_progress" }).eq("id", learnerSessionId);
  });

  it("cannot write rows for another learner", async () => {
    const res = await otherLearner.from("cards").insert({ user_id: learnerId, item_type: "vocab", item_id: learnerSessionId }).select();
    expect(res.error).not.toBeNull();
    expect(await blocked(otherLearner.from("sessions").update({ xp: 999 }).eq("user_id", learnerId).select())).toBe(true);
  });

  it("cannot edit grading results, only the hide flag", async () => {
    expect(await blocked(learner.from("writing_submissions").update({ band_gra: 9 }).eq("user_id", learnerId).select())).toBe(true);
    const ok = await learner.from("writing_submissions").update({ hidden_from_viewers: false }).eq("text", "visible").select();
    expect(ok.error).toBeNull();
    expect(ok.data?.length).toBe(1);
  });

  it("cannot write content tables", async () => {
    expect(await blocked(learner.from("grammar_items").update({ status: "approved" }).neq("id", "00000000-0000-0000-0000-000000000000").select())).toBe(true);
    expect(await blocked(learner.from("weakness").insert({ user_id: learnerId, error_code: "ART", score: 0 }).select())).toBe(true);
  });
});
