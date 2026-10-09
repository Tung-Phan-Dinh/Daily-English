import type { Metadata } from "next";
import Link from "next/link";
import { requireViewer } from "@/lib/auth";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const viewer = await requireViewer(["learner", "admin"]);
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-muted-foreground">Signed in as {viewer.email}. Time zone: {viewer.timezone} (set by the admin).</p>
      </div>
      <SettingsForm initial={{ ...viewer.settings, ui_lang: viewer.ui_lang, display_name: viewer.display_name }} isLearner={viewer.role === "learner"} />
      <section className="surface p-5" aria-labelledby="priv-h">
        <h2 id="priv-h" className="font-semibold">Privacy</h2>
        <p className="mt-1 text-base">
          Your writing and typed answers are sent to OpenAI to be checked and graded. Names and email addresses are never included.
          Your family can see your progress and writing (you can hide any piece of writing from them).
        </p>
        <p lang="vi" className="mt-2 text-base text-muted-foreground">
          Bài viết và câu trả lời được gửi tới OpenAI để chấm. Tên và email không bao giờ được gửi kèm.
        </p>
        <Link href="/about" className="mt-2 inline-flex min-h-11 items-center text-brand underline-offset-4 hover:underline">About &amp; credits</Link>
      </section>
    </div>
  );
}
