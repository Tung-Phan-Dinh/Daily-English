"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Languages } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LanguageToggle({ lang }: { lang: "en" | "vi" }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const next = lang === "en" ? "vi" : "en";
  return (
    <Button
      variant="outline"
      size="sm"
      className="border-transparent shadow-soft"
      disabled={busy}
      aria-busy={busy}
      onClick={async () => {
        setBusy(true);
        await fetch("/api/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ui_lang: next }) });
        router.refresh();
        setBusy(false);
      }}
      aria-label={next === "vi" ? "Chuyển sang tiếng Việt" : "Switch to English"}
    >
      <Languages aria-hidden /> {next === "vi" ? "VI" : "EN"}
    </Button>
  );
}
