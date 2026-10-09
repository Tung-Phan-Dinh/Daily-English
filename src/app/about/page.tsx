import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "About" };

export default function AboutPage() {
  return (
    <article className="mx-auto max-w-2xl space-y-6 px-4 py-10 text-base leading-relaxed">
      <Link href="/" className="inline-flex min-h-11 items-center text-sm text-muted-foreground hover:text-foreground">← Daily English</Link>
      <h1 className="text-3xl font-semibold tracking-tight">About Daily English</h1>
      <p>
        A 25-minute daily session — review, grammar, new words, reading and a short writing task — built around the errors
        Vietnamese learners make most, with spaced repetition (FSRS) and focused feedback.
      </p>
      <section aria-labelledby="credits-h">
        <h2 id="credits-h" className="text-xl font-semibold">Credits and licences</h2>
        <ul className="mt-2 list-disc space-y-2 pl-6">
          <li>
            <a className="text-brand underline-offset-4 hover:underline" href="https://www.newgeneralservicelist.com/new-general-service-list">New General Service List 1.2</a> and{" "}
            <a className="text-brand underline-offset-4 hover:underline" href="https://www.newgeneralservicelist.com/new-academic-word-list">New Academic Word List 1.2</a> by Browne, Culligan and Phillips — CC BY-SA 4.0.
          </li>
          <li>
            Dictionary data from <a className="text-brand underline-offset-4 hover:underline" href="https://www.wiktionary.org/">Wiktionary</a> via{" "}
            <a className="text-brand underline-offset-4 hover:underline" href="https://kaikki.org/dictionary/rawdata.html">kaikki.org (Wiktextract)</a> — CC BY-SA. The app&apos;s dictionary table is shared under the same licence.
          </li>
          <li>
            Scheduling by <a className="text-brand underline-offset-4 hover:underline" href="https://open-spaced-repetition.github.io/ts-fsrs">ts-fsrs</a> (FSRS-6, open source).
          </li>
          <li>Writing feedback is guided by the public IELTS Writing band descriptors (paraphrased). Band numbers in this app are AI estimates, not official scores.</li>
          <li>Topic word sets, passages and exercises marked “generated” were created with the OpenAI API and checked before use.</li>
        </ul>
      </section>
      <section aria-labelledby="priv-h">
        <h2 id="priv-h" className="text-xl font-semibold">Privacy</h2>
        <p className="mt-2">Writing and typed answers are sent to OpenAI for grading. Names and emails are never sent. Accounts exist by invitation only.</p>
      </section>
    </article>
  );
}
