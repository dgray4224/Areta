"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/platform/auth/actions";
import { Logo } from "@/platform/ui/Logo";
import { HomeIcon, CalendarIcon, ChartIcon, GearIcon, PlusIcon } from "@/platform/ui/icons";
import { NAV_LINKS, LOG_LINKS, ADMIN_LINK, COACHING_LINK, isNavLinkActive } from "./nav-links";

const ICONS = {
  "/dashboard": HomeIcon,
  "/plan": CalendarIcon,
  "/review": ChartIcon,
  "/settings": GearIcon,
} as const;

/** Desktop's persistent left nav, replacing AppHeader's top strip at `xl`
 * and up (AppHeader itself goes `xl:hidden` — see app/(app)/AppHeader.tsx).
 * Below `xl`, BottomTabBar still owns navigation; this component renders
 * nothing there. Mirrors BottomTabBar's link set and active-state rule
 * (via nav-links.ts) so desktop and phone/tablet never drift apart. */
export function Sidebar({ isAdmin, isTrainer }: { isAdmin: boolean; isTrainer: boolean }) {
  const pathname = usePathname();
  const [logOpen, setLogOpen] = useState(false);
  const logMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!logOpen) return;
    function onClick(e: MouseEvent) {
      if (logMenuRef.current && !logMenuRef.current.contains(e.target as Node)) {
        setLogOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setLogOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [logOpen]);

  const secondaryLinks = [...(isAdmin ? [ADMIN_LINK] : []), ...(isTrainer ? [COACHING_LINK] : [])];

  return (
    <aside
      className="sticky top-0 hidden h-screen shrink-0 flex-col overflow-y-auto border-r border-black/5 bg-card px-3 py-4 xl:flex xl:w-[86px]"
      aria-label="Primary"
    >
      <Link href="/dashboard" className="mb-6 flex items-center justify-center" aria-label="Areta home">
        <Logo size={28} />
      </Link>

      <nav className="flex flex-1 flex-col items-center gap-1">
        {NAV_LINKS.map((link) => {
          const Icon = ICONS[link.href as keyof typeof ICONS];
          const active = isNavLinkActive(pathname, link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex w-full flex-col items-center gap-1 rounded-xl px-1 py-2 text-[11px] font-medium ${
                active ? "bg-brand/10 text-brand" : "text-neutral-500 hover:bg-black/[0.03] dark:hover:bg-white/5"
              }`}
            >
              <Icon size={20} />
              {link.label}
            </Link>
          );
        })}

        <div ref={logMenuRef} className="relative mt-2 w-full">
          <button
            type="button"
            onClick={() => setLogOpen((o) => !o)}
            aria-haspopup="menu"
            aria-expanded={logOpen}
            className="flex w-full flex-col items-center gap-1 rounded-xl bg-brand-fill px-1 py-2 text-[11px] font-medium text-brand-ink hover:opacity-90"
          >
            <PlusIcon size={20} />
            Log
          </button>
          {logOpen ? (
            <div
              role="menu"
              className="absolute left-full top-0 z-30 ml-2 w-40 rounded-xl border border-black/5 bg-card p-1.5 shadow-xl dark:border-white/5"
            >
              <p className="px-2.5 pb-1.5 pt-1 text-[11px] font-medium uppercase tracking-wide text-neutral-500">
                Quick log
              </p>
              {LOG_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  role="menuitem"
                  onClick={() => setLogOpen(false)}
                  className="block rounded-lg px-2.5 py-2 text-sm text-foreground hover:bg-black/[0.03] dark:hover:bg-white/5"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          ) : null}
        </div>

        {secondaryLinks.length > 0 ? (
          <>
            <div className="my-2 h-px w-full bg-black/5 dark:bg-white/5" />
            {secondaryLinks.map((link) => {
              const active = isNavLinkActive(pathname, link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`w-full rounded-xl px-1 py-2 text-center text-[11px] font-semibold ${
                    active ? "bg-accent text-accent-ink" : "bg-accent/10 text-accent hover:bg-accent/20"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </>
        ) : null}
      </nav>

      <form action={signOut} className="mt-2">
        <button type="submit" className="w-full text-[11px] text-neutral-500 hover:text-brand">
          Sign out
        </button>
      </form>
    </aside>
  );
}
