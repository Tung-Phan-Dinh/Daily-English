import type { Metadata } from "next";
import { DictionaryProvider } from "@/components/dictionary/dictionary-provider";
import { requireViewer } from "@/lib/auth";

export const metadata: Metadata = { title: "Session" };

// Focus mode: no navigation chrome.
export default async function SessionLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireViewer(["learner"]);
  return (
    <DictionaryProvider accent={viewer.settings.accent} role={viewer.role}>
      {children}
    </DictionaryProvider>
  );
}
