import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getViewer, homeFor } from "@/lib/auth";
import Link from "next/link";
import { BookOpenText, PenLine, Sparkles } from "lucide-react";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const viewer = await getViewer();
  if (viewer) redirect(homeFor(viewer.role));
  const { next } = await searchParams;
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-4 py-10">
      <section className="hero-card p-7" aria-labelledby="login-h">
        <div className="flex items-center justify-between">
          <span className="grid size-12 place-items-center rounded-full bg-[#14161c] text-sm font-bold text-white" aria-hidden>DE</span>
          <span className="flex gap-1.5" aria-hidden>
            <span className="grid size-10 place-items-center rounded-full bg-orange"><Sparkles className="size-4" /></span>
            <span className="grid size-10 place-items-center rounded-full bg-pink"><BookOpenText className="size-4" /></span>
            <span className="grid size-10 place-items-center rounded-full bg-lime"><PenLine className="size-4" /></span>
          </span>
        </div>
        <h1 id="login-h" className="mt-8 text-3xl leading-tight font-bold tracking-tight">
          25 minutes a day.
          <br />
          Fewer mistakes every week.
        </h1>
        <p className="mt-2 text-base font-medium">
          Daily English · <span lang="vi">Học tiếng Anh mỗi ngày</span>
        </p>
      </section>
      <section className="surface p-6" aria-labelledby="signin-h">
        <h2 id="signin-h" className="text-xl font-bold">Sign in</h2>
        <LoginForm next={next} />
      </section>
      <Link href="/about" className="text-center text-sm text-muted-foreground underline-offset-4 hover:underline">About &amp; credits</Link>
    </main>
  );
}
