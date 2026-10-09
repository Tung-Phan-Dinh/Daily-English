import { NextResponse } from "next/server";
import { handle } from "@/lib/auth";
import { submitWeeklyBatch } from "@/lib/content/generate";
import { verifyCron } from "@/lib/cron";

export const maxDuration = 300;

// Sunday: submit next week's passages, items and writing tasks via the OpenAI Batch API.
export const GET = handle(async (req: Request) => {
  verifyCron(req);
  return NextResponse.json(await submitWeeklyBatch());
});
