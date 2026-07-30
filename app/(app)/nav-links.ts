/** Shared by AppHeader (desktop) and BottomTabBar (mobile) so the two
 * navs can never drift out of sync. */
export const NAV_LINKS = [
  { href: "/dashboard", label: "Today" },
  { href: "/plan", label: "Plan" },
  { href: "/review", label: "Review" },
  { href: "/settings", label: "Settings" },
] as const;
