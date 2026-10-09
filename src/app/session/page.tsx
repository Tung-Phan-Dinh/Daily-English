import { SessionPlayer } from "@/components/session/player";
import { requireViewer } from "@/lib/auth";

export default async function SessionPage({ searchParams }: { searchParams: Promise<{ short?: string }> }) {
  const viewer = await requireViewer(["learner"]);
  const { short } = await searchParams;
  const { accent, explain_lang, spellcheck, sound } = viewer.settings;
  return <SessionPlayer short={short === "1"} name={viewer.display_name} settings={{ accent, explain_lang, spellcheck, sound }} />;
}
