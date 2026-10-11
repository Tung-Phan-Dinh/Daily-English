import { NextResponse } from "next/server";
import { apiViewer, handle, HttpError, readJson } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

type Bands = { gra: number; lr: number; tr?: number | null; cc?: number | null };

const band = (v: unknown, required: boolean): number | null => {
  if (v === null || v === undefined || v === "") {
    if (required) throw new HttpError(400, "Grammar (GRA) and vocabulary (LR) bands are required.");
    return null;
  }
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > 9 || Math.round(n * 2) !== n * 2) throw new HttpError(400, "Bands must be 0–9 in half steps.");
  return n;
};

// The admin's own grade for a writing piece. `clear: true` removes it (the AI estimate shows again).
export const POST = handle(async (req: Request) => {
  const me = await apiViewer(["admin"]);
  const body = await readJson<{ submission_id: string; bands?: Partial<Bands>; comment?: string; clear?: boolean }>(req);
  if (!body.submission_id) throw new HttpError(400, "Missing submission_id.");
  const admin = createAdminClient();

  const patch = body.clear
    ? { teacher_bands: null, teacher_comment: null, teacher_id: null, teacher_graded_at: null }
    : {
        teacher_bands: {
          gra: band(body.bands?.gra, true),
          lr: band(body.bands?.lr, true),
          tr: band(body.bands?.tr, false),
          cc: band(body.bands?.cc, false),
        },
        teacher_comment: (body.comment ?? "").trim().slice(0, 4000) || null,
        teacher_id: me.id,
        teacher_graded_at: new Date().toISOString(),
      };

  const { data, error } = await admin
    .from("writing_submissions")
    .update(patch)
    .eq("id", body.submission_id)
    .select("id, teacher_bands, teacher_comment, teacher_graded_at")
    .maybeSingle();
  if (error) throw new HttpError(500, "Could not save the grade.");
  if (!data) throw new HttpError(404, "Writing not found.");
  return NextResponse.json(data);
});
