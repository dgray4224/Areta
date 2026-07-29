"use client";

import { useState } from "react";
import Link from "next/link";
import { signOut } from "@/platform/auth/actions";
import { Logo } from "@/platform/ui/Logo";

const LINKS = [
  { href: "/dashboard", label: "Today" },
  { href: "/plan", label: "Plan" },
  { href: "/review", label: "Review" },
  { href: "/settings", label: "Settings" },
] as const;

export function AppHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="relative border-b border-neutral-200 dark:border-neutral-800">
      <div className="flex items-center justify-between px-4 py-3">
        <Logo />

        {/* Desktop: full inline nav. Hidden below sm, where it gets crammed. */}
        <nav className="hidden items-center gap-4 text-sm text-neutral-500 sm:flex">
          {LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="hover:underline">
              {link.label}
            </Link>
          ))}
          <form action={signOut}>
            <button type="submit" className="hover:underline">
              Sign out
            </button>
          </form>
        </nav>

        {/* Mobile: everything collapses into one dropdown. */}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label="Open menu"
          aria-expanded={open}
          className="flex h-8 w-8 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100 sm:hidden dark:hover:bg-neutral-900"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            {open ? (
              <path
                d="M5 5l10 10M15 5L5 15"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            ) : (
              <path
                d="M3 5h14M3 10h14M3 15h14"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            )}
          </svg>
        </button>
      </div>

      {open ? (
        <nav className="flex flex-col border-t border-neutral-200 px-4 py-2 text-sm sm:hidden dark:border-neutral-800">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="py-2.5 text-neutral-700 dark:text-neutral-300"
            >
              {link.label}
            </Link>
          ))}
          <form action={signOut}>
            <button
              type="submit"
              className="w-full py-2.5 text-left text-neutral-700 dark:text-neutral-300"
            >
              Sign out
            </button>
          </form>
        </nav>
      ) : null}
    </header>
  );
}
