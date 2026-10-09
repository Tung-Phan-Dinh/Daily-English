import type { Metadata, Viewport } from "next";
import { Be_Vietnam_Pro, Newsreader } from "next/font/google";
import { cookies } from "next/headers";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getViewer } from "@/lib/auth";
import "./globals.css";

// UI font designed for Vietnamese; serif reading font with a Vietnamese subset.
const ui = Be_Vietnam_Pro({
  variable: "--font-ui",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});
const reading = Newsreader({
  variable: "--font-reading",
  subsets: ["latin", "vietnamese"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Daily English", template: "%s · Daily English" },
  description: "A calm 25-minute daily English session with progress the family can follow.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8f5ee" },
    { media: "(prefers-color-scheme: dark)", color: "#161a24" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();
  const jar = await cookies();
  const theme = viewer?.settings.theme ?? (jar.get("theme")?.value as "light" | "dark" | "system" | undefined) ?? "system";
  const scale = (viewer?.settings.text_size ?? 100) / 100;
  return (
    <html
      lang={viewer?.ui_lang === "vi" ? "vi" : "en"}
      data-theme={theme === "system" ? undefined : theme}
      className={`${ui.variable} ${reading.variable}`}
      style={{ ["--text-scale" as string]: String(scale) }}
      suppressHydrationWarning
    >
      <body className="min-h-dvh">
        <TooltipProvider delayDuration={300}>{children}</TooltipProvider>
      </body>
    </html>
  );
}
