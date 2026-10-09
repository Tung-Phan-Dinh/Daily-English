import { NextResponse } from "next/server";
import { handle } from "@/lib/auth";
import { AiUnavailableError } from "@/lib/ai/client";
import { aiWeeklySummary } from "@/lib/ai/services";
import { verifyCron } from "@/lib/cron";
import { getDashboardData } from "@/lib/dashboard/stats";
import { fallbackSummary, summaryStats } from "@/lib/dashboard/summary";
import { createAdminClient } from "@/lib/supabase/admin";
import { weekStart } from "@/lib/time";

export const maxDuration = 300;

// Sunday evening (Melbourne): five-sentence family summary in English and Vietnamese.
// Only the week's stats are sent to the model — never the writing text.
export const GET = handle(async (req: Request) => {
  verifyCron(req);
  const admin = createAdminClient();
  const { data: learners } = await admin.from("profiles").select("id, timezone, display_name").eq("role", "learner");
  const done: string[] = [];
  for (const l of learners ?? []) {
    const data = await getDashboardData(admin, l.id, l.timezone);
    const stats = summaryStats(data);
    let body: { en: string; vi: string };
    try {
      body = await aiWeeklySummary(stats);
    } catch (e) {
      if (!(e instanceof AiUnavailableError)) throw e;
      body = fallbackSummary(stats);
    }
    await admin.from("weekly_summaries").upsert(
      { learner_id: l.id, week_start: weekStart(data.today), body_en: body.en, body_vi: body.vi, stats },
      { onConflict: "learner_id,week_start" },
    );
    done.push(l.id);
  }
  return NextResponse.json({ summaries: done.length });
});
