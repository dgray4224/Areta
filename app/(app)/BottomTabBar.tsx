"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_LINKS } from "./nav-links";
import { HomeIcon, CalendarIcon, ChartIcon, GearIcon, PlusIcon } from "@/platform/ui/icons";
import { QuickActionSheet } from "./QuickActionSheet";

const ICONS = {
  "/dashboard": HomeIcon,
  "/plan": CalendarIcon,
  "/review": ChartIcon,
  "/settings": GearIcon,
} as const;

export function BottomTabBar() {
  const pathname = usePathname();
  const [sheetOpen, setSheetOpen] = useState(false);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  const firstHalf = NAV_LINKS.slice(0, 2);
  const secondHalf = NAV_LINKS.slice(2);

  return (
    <>
      {sheetOpen ? <QuickActionSheet onClose={() => setSheetOpen(false)} /> : null}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-black/5 bg-card pb-[env(safe-area-inset-bottom)] xl:hidden dark:border-white/5">
        <div className="flex items-center justify-around px-2 py-2">
          {firstHalf.map((link) => {
            const Icon = ICONS[link.href as keyof typeof ICONS];
            const active = isActive(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex flex-col items-center gap-0.5 rounded-lg px-3 py-1 text-[11px] font-medium ${
                  active ? "text-brand" : "text-neutral-500"
                }`}
              >
                <Icon size={22} />
                {link.label}
              </Link>
            );
          })}

          <button
            type="button"
            onClick={() => setSheetOpen((o) => !o)}
            aria-label="Quick log"
            aria-expanded={sheetOpen}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-fill text-brand-ink shadow-md"
          >
            <PlusIcon size={22} />
          </button>

          {secondHalf.map((link) => {
            const Icon = ICONS[link.href as keyof typeof ICONS];
            const active = isActive(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex flex-col items-center gap-0.5 rounded-lg px-3 py-1 text-[11px] font-medium ${
                  active ? "text-brand" : "text-neutral-500"
                }`}
              >
                <Icon size={22} />
                {link.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
