"use client";

import Link from "next/link";
import { LOG_LINKS } from "./nav-links";

export function QuickActionSheet({ onClose }: { onClose: () => void }) {
  return (
    <>
      <button
        type="button"
        aria-label="Close quick log"
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/30 xl:hidden"
      />
      <div className="fixed inset-x-4 bottom-24 z-50 rounded-2xl border border-black/5 bg-card p-3 shadow-xl xl:hidden dark:border-white/5">
        <p className="px-2 pb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
          Quick log
        </p>
        <div className="grid grid-cols-3 gap-2">
          {LOG_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={onClose}
              className="rounded-xl border border-neutral-200 px-3 py-3 text-center text-sm hover:bg-black/5 dark:border-neutral-700 dark:hover:bg-white/5"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
