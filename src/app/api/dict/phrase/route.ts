import { NextResponse } from "next/server";
import { apiViewer, handle, HttpError, readJson } from "@/lib/auth";
import { AiUnavailableError } from "@/lib/ai/client";
import { aiPhrases } from "@/lib/ai/services";
import { createClient } from "@/lib/supabase/server";
import { localDate } from "@/lib/time";

const LIMIT_PER_TASK = 3;

// Phrase helper: Vietnamese idea → 2–3 natural English phrasings. 3 uses per
// writing task; each use is logged so the writing feedback knows what was assisted.
export const POST = handle(async (req: Request) => {
  const viewer = await apiViewer(["learner"]);
  const { text, session_id } = await readJson<{ text: string; session_id?: string }>(req);
  const idea = (text ?? "").trim().slice(0, 300);
  if (!idea) throw new HttpError(400, "Type an idea in Vietnamese first.");
  const db = await createClient();
  const today = localDate(viewer.timezone);
  const { count } = await db
    .from("lookups")
    .select("id", { count: "exact", head: true })
    .eq("user_id", viewer.id)
    .eq("local_date", today)
    .eq("context->>kind", "phrase");
  if ((count ?? 0) >= LIMIT_PER_TASK) {
    throw new HttpError(429, `You've used the phrase helper ${LIMIT_PER_TASK} times today. Try the dictionary instead.`);
  }
  try {
    const out = await aiPhrases(idea, viewer.id);
    const options = out.options.slice(0, 3);
    await db.from("lookups").insert({
      user_id: viewer.id, query: idea, lemma: null, local_date: today,
      context: { kind: "phrase", session_id: session_id ?? null, options: options.map((o) => o.english) },
    });
    return NextResponse.json({ options, remaining: LIMIT_PER_TASK - (count ?? 0) - 1 });
  } catch (e) {
    if (e instanceof AiUnavailableError) throw new HttpError(503, e.message);
    throw e;
  }
});
