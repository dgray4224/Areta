"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/platform/auth/actions";
import { Logo } from "@/platform/ui/Logo";
import { NAV_LINKS, isNavLinkActive, navLinkClass } from "./nav-links";

export function AppHeader({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();

  return (
    <header className="border-b border-black/5 dark:border-white/5">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <Logo />
          <span className="hidden text-sm text-neutral-400 sm:inline">
            | Become more of who you are
          </span>
        </div>

        {/* Phone/tablet keeps just the logo — BottomTabBar owns primary nav
         * there, matching native app tab-bar conventions on those sizes
         * (including iPad portrait/landscape, which is wider than
         * Tailwind's `sm` but still a touch device, not a desktop). */}
        <nav className="hidden items-center gap-4 text-sm xl:flex">
          {NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className={navLinkClass(isNavLinkActive(pathname, link.href))}>
              {link.label}
            </Link>
          ))}
          {/* Admin-only, desktop-only entry point (this nav row is already
           * `hidden xl:flex` above — mobile gets its own entry via the
           * Settings tabs instead, rather than adding a 5th icon to the
           * tuned 4-item BottomTabBar). */}
          {isAdmin ? (
            <Link href="/admin" className={navLinkClass(pathname.startsWith("/admin"))}>
              Admin
            </Link>
          ) : null}
          <form action={signOut}>
            <button type="submit" className="text-neutral-500 hover:text-brand">
              Sign out
            </button>
          </form>
        </nav>
      </div>
    </header>
  );
}
