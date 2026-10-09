import { DictionaryProvider } from "@/components/dictionary/dictionary-provider";
import { AppNav } from "@/components/shell/app-nav";
import { requireViewer } from "@/lib/auth";

export default async function LearnerLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireViewer(["learner", "admin"]);
  return (
    <DictionaryProvider accent={viewer.settings.accent} role={viewer.role}>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-card focus:px-4 focus:py-3">
        Skip to content
      </a>
      <AppNav role={viewer.role} name={viewer.display_name} />
      <main id="main" className="mx-auto max-w-6xl px-4 pt-4 pb-32 sm:pt-6 md:pb-16">
        {children}
      </main>
    </DictionaryProvider>
  );
}
