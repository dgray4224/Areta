/** Shared by AppHeader (desktop) and BottomTabBar (mobile) so the two
 * navs can never drift out of sync. */
export const NAV_LINKS = [
  { href: "/dashboard", label: "Today" },
  { href: "/plan", label: "Plan" },
  { href: "/review", label: "Review" },
  { href: "/settings", label: "Settings" },
] as const;

/** True when `href` is the current route or an ancestor of it (e.g. "/plan"
 * stays active on "/plan/setup"). Shared so every nav in the app answers
 * "am I active?" the same way. */
export function isNavLinkActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Project-wide active-nav-link rule (see README "Development rules"):
 * an active link/tab/pill always gets brand-colored text (`text-brand`),
 * not just a bolder weight or a border — color is what actually reads as
 * "selected" at a glance, especially on desktop where there's no separate
 * tab-bar chrome to lean on. Inactive items stay on the muted neutral
 * scale. Apply this via `navLinkClass`/`navTabClass`/`navPillClass` below
 * rather than inventing a one-off className, so every nav in the app stays
 * visually consistent. */
export function navLinkClass(active: boolean): string {
  return active ? "text-brand font-medium" : "text-neutral-500 hover:text-brand";
}

export function navTabClass(active: boolean): string {
  return active
    ? "border-brand text-brand font-medium"
    : "border-transparent text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100";
}

export function navPillClass(active: boolean): string {
  return active
    ? "border-brand/40 bg-brand/10 text-brand font-medium"
    : "border-neutral-200 text-neutral-600 hover:bg-neutral-100 dark:border-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-900";
}
