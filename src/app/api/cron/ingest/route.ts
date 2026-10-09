import { NextResponse } from "next/server";
import { handle } from "@/lib/auth";
import { ingestBatches } from "@/lib/content/generate";
import { verifyCron } from "@/lib/cron";

export const maxDuration = 300;

// Daily: poll batches, validate (offsets, coverage, blind answer check) and insert as drafts.
export const GET = handle(async (req: Request) => {
  verifyCron(req);
  return NextResponse.json({ results: await ingestBatches() });
});
