import type { Metadata } from "next";
import Link from "next/link";
import { LogOut } from "lucide-react";
import { Dashboard } from "@/components/dashboard/dashboard";
import { Avatar } from "@/components/shell/avatar";
import { getLinkedLearner, requireViewer } from "@/lib/auth";
import { getDashboardData } from "@/lib/dashboard/stats";
import { createClient } from "@/lib/supabase/server";
import { LanguageToggle } from "./language-toggle";

export const metadata: Metadata = { title: "Family dashboard" };

// Read-only, phone-first: is he practising, making fewer mistakes, growing vocabulary?
export default async function FamilyPage() {
  const viewer = await requireViewer(["viewer", "admin"]);
  const learner = await getLinkedLearner(viewer);
  const lang = viewer.ui_lang;
  return (
    <div className="mx-auto min-h-dvh max-w-3xl px-4 pt-4 pb-16">
      <header className="flex items-center gap-3 pb-5">
        {learner && <Avatar name={learner.display_name} size={52} />}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-bold tracking-tight">{learner?.display_name ?? (lang === "vi" ? "Chưa liên kết" : "No learner linked")}</h1>
          <p className="truncate text-sm text-muted-foreground">{lang === "vi" ? "Tiến độ tiếng Anh" : "English progress"}</p>
        </div>
        <LanguageToggle lang={lang} />
        {viewer.role === "admin" && (
          <Link href="/admin" className="flex min-h-11 items-center rounded-full bg-card px-4 text-sm font-semibold shadow-soft hover:bg-muted">Admin</Link>
        )}
        <form action="/auth/signout" method="post">
          <button
            className="grid size-11 place-items-center rounded-full bg-card text-muted-foreground shadow-soft hover:text-foreground"
            type="submit"
            aria-label={lang === "vi" ? "Đăng xuất" : "Sign out"}
            title={lang === "vi" ? "Đăng xuất" : "Sign out"}
          >
            <LogOut className="size-5" aria-hidden />
          </button>
        </form>
      </header>
      {learner ? (
        <FamilyData learnerId={learner.id} tz={learner.timezone} lang={lang} />
      ) : (
        <p className="surface p-6 text-muted-foreground">
          {lang === "vi" ? "Tài khoản này chưa được liên kết với học viên nào." : "This account isn't linked to a learner yet."}
        </p>
      )}
    </div>
  );
}

async function FamilyData({ learnerId, tz, lang }: { learnerId: string; tz: string; lang: "en" | "vi" }) {
  const db = await createClient();
  const data = await getDashboardData(db, learnerId, tz);
  return <Dashboard data={data} lang={lang} mode="family" />;
}
