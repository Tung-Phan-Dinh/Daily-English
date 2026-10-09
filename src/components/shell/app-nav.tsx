"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, ChartLine, House, LayoutGrid, LogOut, Search, Settings, Shield, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDictionary } from "@/components/dictionary/dictionary-provider";
import { cn } from "@/lib/utils";
import { Avatar } from "./avatar";
import { MobileTabBar } from "./mobile-tab-bar";

const LEARNER = [
  { href: "/today", label: "Today", icon: House },
  { href: "/words", label: "My words", icon: BookOpen },
  { href: "/grammar", label: "Grammar", icon: LayoutGrid },
  { href: "/progress", label: "Progress", icon: ChartLine },
  { href: "/settings", label: "Settings", icon: Settings },
];
const ADMIN = [
  { href: "/admin", label: "Admin", icon: Shield },
  { href: "/family", label: "Family view", icon: Users },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppNav({ role, name }: { role: "learner" | "viewer" | "admin"; name: string }) {
  const pathname = usePathname();
  const { openPalette } = useDictionary();
  const items = role === "learner" ? LEARNER : ADMIN;
  return (
    <>
      <header className="sticky top-0 z-40 bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
        <div className="mx-auto flex h-18 max-w-6xl items-center gap-3 px-4">
          <Link href="/" className="flex min-h-11 items-center gap-2.5 font-semibold tracking-tight">
            <span aria-hidden className="grid size-10 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
              DE
            </span>
            <span className="hidden text-lg sm:inline">Daily English</span>
          </Link>

          <nav aria-label="Main" className="hidden flex-1 justify-center md:flex">
            <ul className="flex items-center gap-1 rounded-full bg-card p-1 shadow-soft">
              {items.map(({ href, label, icon: Icon }) => {
                const active = pathname === href || pathname.startsWith(href + "/");
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold whitespace-nowrap text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                        active && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
                      )}
                    >
                      <Icon className="size-4 shrink-0" aria-hidden />
                      <span className="hidden lg:inline">{label}</span>
                      <span className="sr-only lg:hidden">{label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="ml-auto flex items-center gap-2 md:ml-0">
            <button
              type="button"
              onClick={openPalette}
              aria-label="Open dictionary (Ctrl or Command + K)"
              className="flex min-h-11 items-center gap-2 rounded-full bg-card px-4 text-sm text-muted-foreground shadow-soft transition-colors hover:text-foreground"
            >
              <Search className="size-4" aria-hidden />
              <span className="hidden lg:inline">Dictionary</span>
              <kbd className="hidden rounded-full bg-muted px-2 py-0.5 font-mono text-xs lg:inline">⌘K</kbd>
            </button>
            <span title={name} className="hidden md:inline">
              <Avatar name={name} size={44} />
            </span>
            <form action="/auth/signout" method="post">
              <Button type="submit" variant="ghost" size="icon" aria-label="Sign out">
                <LogOut aria-hidden />
              </Button>
            </form>
          </div>
        </div>
      </header>
      <MobileTabBar role={role} />
    </>
  );
}
