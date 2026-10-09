import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export type Role = "learner" | "viewer" | "admin";

export type Settings = {
  target_band: number;
  new_words_per_day: number;
  accent: "en-GB" | "en-US";
  explain_lang: "en" | "vi";
  spellcheck: boolean;
  theme: "system" | "light" | "dark";
  text_size: number;
  weekly_xp_goal: number;
  sound: boolean;
};

export type Viewer = {
  id: string;
  email: string;
  display_name: string;
  role: Role;
  ui_lang: "en" | "vi";
  timezone: string;
  settings: Settings;
};

const DEFAULT_SETTINGS: Settings = {
  target_band: 6.5, new_words_per_day: 8, accent: "en-GB", explain_lang: "en", spellcheck: false,
  theme: "system", text_size: 100, weekly_xp_goal: 400, sound: false,
};

/** The signed-in user with profile and settings, memoised per request. */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const [{ data: profile }, { data: settings }] = await Promise.all([
    supabase.from("profiles").select("display_name, role, ui_lang, timezone").eq("id", auth.user.id).single(),
    supabase.from("settings").select("*").eq("user_id", auth.user.id).maybeSingle(),
  ]);
  if (!profile) return null;
  return {
    id: auth.user.id,
    email: auth.user.email ?? "",
    display_name: profile.display_name,
    role: profile.role as Role,
    ui_lang: profile.ui_lang as "en" | "vi",
    timezone: profile.timezone,
    settings: { ...DEFAULT_SETTINGS, ...(settings ?? {}) } as Settings,
  };
});

export async function requireViewer(roles?: Role[]): Promise<Viewer> {
  const v = await getViewer();
  if (!v) redirect("/login");
  if (roles && !roles.includes(v.role)) redirect(homeFor(v.role));
  return v;
}

export function homeFor(role: Role): string {
  return role === "learner" ? "/today" : role === "admin" ? "/admin" : "/family";
}

/** Learner whose data a page shows: self for learners, first linked learner otherwise. */
export const getLinkedLearner = cache(async (viewer: Viewer) => {
  const supabase = await createClient();
  if (viewer.role === "learner") return { id: viewer.id, display_name: viewer.display_name, timezone: viewer.timezone };
  const { data: links } = await supabase.from("family_links").select("learner_id").eq("viewer_id", viewer.id).limit(1);
  let learnerId = links?.[0]?.learner_id as string | undefined;
  if (!learnerId && viewer.role === "admin") {
    const { data } = await supabase.from("profiles").select("id").eq("role", "learner").limit(1);
    learnerId = data?.[0]?.id;
  }
  if (!learnerId) return null;
  const { data: p } = await supabase.from("profiles").select("id, display_name, timezone").eq("id", learnerId).single();
  return p as { id: string; display_name: string; timezone: string } | null;
});

// ---------------------------------------------------------------------------
// Route-handler helpers
// ---------------------------------------------------------------------------

export class HttpError extends Error {
  constructor(public status: number, message: string, public extra?: Record<string, unknown>) {
    super(message);
  }
}

export async function apiViewer(roles?: Role[]) {
  const v = await getViewer();
  if (!v) throw new HttpError(401, "Please sign in again.");
  if (roles && !roles.includes(v.role)) throw new HttpError(403, "You don't have permission to do that.");
  return v;
}

/** Wrap a route handler: converts thrown HttpErrors into JSON responses. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof HttpError) {
        return NextResponse.json({ error: err.message, ...(err.extra ?? {}) }, { status: err.status });
      }
      console.error(err);
      return NextResponse.json({ error: "Something went wrong. Your progress is saved — please try again." }, { status: 500 });
    }
  };
}

export async function readJson<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new HttpError(400, "Invalid request body.");
  }
}
