"use client";

import { Search } from "lucide-react";
import { useDictionary } from "@/components/dictionary/dictionary-provider";

/** The design's search pill — opens the dictionary palette. */
export function OpenDictionaryButton() {
  const { openPalette } = useDictionary();
  return (
    <button
      type="button"
      onClick={openPalette}
      className="flex min-h-13 w-full items-center gap-3 rounded-full bg-card px-5 text-left text-base text-muted-foreground shadow-soft transition-colors hover:text-foreground"
    >
      <Search className="size-5" aria-hidden />
      <span className="min-w-0 flex-1 truncate">Look up a word · Tra từ</span>
      <kbd className="hidden rounded-full bg-muted px-2.5 py-0.5 font-mono text-xs sm:inline">/</kbd>
    </button>
  );
}
