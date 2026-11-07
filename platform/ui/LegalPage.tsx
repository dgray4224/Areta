import Link from "next/link";

/** Where people reach a human about anything on these pages. One
 * constant so Privacy, Terms and Support can never list different ones. */
export const CONTACT_EMAIL = "dgrayze249@gmail.com";

const PAGES = [
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/support", label: "Support" },
];

/**
 * Shared shell for the public, signed-out pages App Store Connect links
 * to (privacy policy, terms, support URL). Plain and readable on purpose:
 * these are read by reviewers and by people with a problem, not browsed.
 */
export function LegalPage({
  title,
  effectiveDate,
  children,
}: {
  title: string;
  effectiveDate?: string;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <div className="mb-10 space-y-2">
        <Link
          href="/"
          className="text-sm text-neutral-500 hover:underline dark:text-neutral-400"
        >
          ← Areta
        </Link>
        <h1 className="text-2xl font-semibold">{title}</h1>
        {effectiveDate ? (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Effective {effectiveDate}
          </p>
        ) : null}
      </div>

      <div className="space-y-8">{children}</div>

      <nav className="mt-12 flex gap-5 border-t border-black/5 pt-6 text-sm text-neutral-500 dark:border-white/5 dark:text-neutral-400">
        {PAGES.map((p) => (
          <Link key={p.href} href={p.href} className="hover:underline">
            {p.label}
          </Link>
        ))}
      </nav>
    </main>
  );
}

export function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
        {children}
      </div>
    </section>
  );
}

export function ContactLink() {
  return (
    <a className="underline" href={`mailto:${CONTACT_EMAIL}`}>
      {CONTACT_EMAIL}
    </a>
  );
}
