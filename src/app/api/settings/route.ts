import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { apiViewer, handle, HttpError, readJson } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type Body = Partial<{
  target_band: number; new_words_per_day: number; accent: "en-GB" | "en-US"; explain_lang: "en" | "vi";
  spellcheck: boolean; theme: "system" | "light" | "dark"; text_size: number; weekly_xp_goal: number; sound: boolean;
  ui_lang: "en" | "vi"; display_name: string;
}>;

const clamp = (n: unknown, lo: number, hi: number, step = 1) =>
  Math.min(hi, Math.max(lo, Math.round(Number(n) / step) * step));

export const POST = handle(async (req: Request) => {
  const viewer = await apiViewer();
  const b = await readJson<Body>(req);
  const jar = await cookies();
  if (b.theme) jar.set("theme", b.theme, { path: "/", maxAge: 31536000, sameSite: "lax" });

  // Profile fields (language, name) go through the service role: viewers have no write access at all.
  const profile: Record<string, unknown> = {};
  if (b.ui_lang === "en" || b.ui_lang === "vi") profile.ui_lang = b.ui_lang;
  if (typeof b.display_name === "string" && b.display_name.trim()) profile.display_name = b.display_name.trim().slice(0, 40);
  if (Object.keys(profile).length) await createAdminClient().from("profiles").update(profile).eq("id", viewer.id);

  if (viewer.role === "viewer") {
    // Viewers only choose language and theme (theme lives in a cookie).
    return NextResponse.json({ ok: true });
  }

  const s: Record<string, unknown> = {};
  if (b.target_band !== undefined) s.target_band = clamp(b.target_band, 5, 9, 0.5);
  if (b.new_words_per_day !== undefined) s.new_words_per_day = clamp(b.new_words_per_day, 5, 15);
  if (b.accent === "en-GB" || b.accent === "en-US") s.accent = b.accent;
  if (b.explain_lang === "en" || b.explain_lang === "vi") s.explain_lang = b.explain_lang;
  if (typeof b.spellcheck === "boolean") s.spellcheck = b.spellcheck;
  if (b.theme && ["system", "light", "dark"].includes(b.theme)) s.theme = b.theme;
  if (b.text_size !== undefined) s.text_size = clamp(b.text_size, 100, 130, 5);
  if (b.weekly_xp_goal !== undefined) s.weekly_xp_goal = clamp(b.weekly_xp_goal, 50, 5000, 10);
  if (typeof b.sound === "boolean") s.sound = b.sound;
  if (!Object.keys(s).length) return NextResponse.json({ ok: true });

  const db = await createClient();
  const { error } = await db.from("settings").update({ ...s, updated_at: new Date().toISOString() }).eq("user_id", viewer.id);
  if (error) throw new HttpError(500, "Could not save settings.");
  return NextResponse.json({ ok: true, settings: s });
});
