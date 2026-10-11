"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, CalendarDays, ChartLine, House, LayoutGrid, Settings, Shield, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const LEARNER = [
  { href: "/today", label: "Today", icon: House },
  { href: "/words", label: "Words", icon: BookOpen },
  { href: "/grammar", label: "Grammar", icon: LayoutGrid },
  { href: "/progress", label: "Progress", icon: ChartLine },
  { href: "/settings", label: "Settings", icon: Settings },
];
const ADMIN = [
  { href: "/admin", label: "Admin", icon: Shield },
  { href: "/admin/sessions", label: "Sessions", icon: CalendarDays },
  { href: "/family", label: "Family", icon: Users },
  { href: "/settings", label: "Settings", icon: Settings },
];

/** Dark floating tab bar for phones (the design's bottom nav). Always dark, in both themes. */
export function MobileTabBar({ role }: { role: "learner" | "viewer" | "admin" }) {
  const pathname = usePathname();
  const items = role === "learner" ? LEARNER : ADMIN;
  return (
    <nav aria-label="Main" className="fixed inset-x-4 bottom-4 z-40 md:hidden">
      <ul className="mx-auto flex max-w-md items-center justify-between rounded-full bg-[#14161c] px-2 py-1.5 shadow-float ring-1 ring-white/10">
        {items.map(({ href, label, icon: Icon }) => {
          // Most specific match wins (/admin/sessions shouldn't also light up /admin).
          const matches = (h: string) => pathname === h || pathname.startsWith(h + "/");
          const active = matches(href) && !items.some((o) => o.href.length > href.length && o.href.startsWith(href) && matches(o.href));
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-full text-[0.6875rem] font-medium text-[#b7bccb] transition-colors hover:text-white focus-visible:outline-white",
                  active && "text-[#f6a057] hover:text-[#f6a057]",
                )}
              >
                <Icon className="size-5" strokeWidth={active ? 2.5 : 2} aria-hidden />
                <span className={cn(!active && "sr-only")}>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
