import { Logo } from "@/platform/ui/Logo";

/** Phone/tablet-only top strip — BottomTabBar owns primary nav there,
 * matching native app tab-bar conventions on those sizes (including iPad
 * portrait/landscape, which is wider than Tailwind's `sm` but still a
 * touch device, not a desktop). At `xl` and up, Sidebar replaces this
 * entirely (nav, quick-log, admin/coaching, sign out all live there
 * instead), so this component just goes `xl:hidden`. */
export function AppHeader() {
  return (
    <header className="border-b border-black/5 xl:hidden dark:border-white/5">
      <div className="flex items-center gap-3 px-4 py-3">
        <Logo size={32} />
        <span className="hidden text-sm text-neutral-400 sm:inline">
          | Become more of who you are
        </span>
      </div>
    </header>
  );
}
