import { redirect } from "next/navigation";
import Link from "next/link";
import { getUser } from "@/platform/auth/session";
import { LogoMark } from "@/platform/ui/Logo";

const PILLARS = [
  {
    title: "Goals & phases",
    body: "Set what you're actually working toward, broken into the current phase you're in right now — not a vague resolution you'll forget in a week.",
  },
  {
    title: "Nutrition",
    body: "Log meals in seconds (barcode scan included), see today's totals against your targets, and get a plan built around how you actually eat.",
  },
  {
    title: "Exercise",
    body: "A workout plan built for your goal and experience level, with the reasoning behind today's session, not just a list of exercises.",
  },
  {
    title: "One daily schedule",
    body: "Meals, workouts, and your real calendar (Google, Outlook, or iCloud) in a single read-only timeline for the day, instead of four separate apps.",
  },
];

/**
 * Public marketing homepage, required as the "Application home page" on
 * Google's OAuth verification form (calendar.readonly is a sensitive
 * scope) -- that field has to be viewable without signing in, and this
 * route previously redirected everyone straight into the login-gated app
 * with nothing to see. Authenticated visitors still go straight to
 * /dashboard, unchanged from before; only a logged-out visitor sees this.
 */
export default async function RootPage() {
  const user = await getUser();
  if (user) {
    redirect("/dashboard");
  }

  return (
    <main className="min-h-full bg-canvas">
      <header className="mx-auto flex max-w-4xl items-center justify-between px-6 py-6">
        <span className="flex items-center gap-2 text-lg font-semibold text-hero">
          <LogoMark size={28} />
          Areta
        </span>
        <nav className="flex items-center gap-3">
          <Link href="/login" className="text-sm font-medium text-hero hover:underline">
            Log in
          </Link>
          <Link
            href="/signup"
            className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-brand-ink"
          >
            Sign up
          </Link>
        </nav>
      </header>

      <section className="mx-auto max-w-2xl px-6 pt-12 pb-16 text-center">
        <h1 className="text-4xl font-semibold text-hero sm:text-5xl">Become More of Who You Are</h1>
        <p className="mt-4 text-lg text-neutral-600 dark:text-neutral-300">
          Areta is a personal execution and weekly regeneration platform — one place for your
          goals, nutrition, exercise, and daily schedule, built around who you actually are and
          where you're actually headed.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link
            href="/signup"
            className="rounded-md bg-brand px-5 py-2.5 text-sm font-medium text-brand-ink"
          >
            Get started
          </Link>
          <Link
            href="/login"
            className="rounded-md border border-neutral-300 px-5 py-2.5 text-sm font-medium text-hero dark:border-neutral-700"
          >
            Log in
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 pb-20">
        <div className="grid gap-4 sm:grid-cols-2">
          {PILLARS.map((pillar) => (
            <div key={pillar.title} className="rounded-lg bg-card p-6 shadow-sm">
              <h2 className="font-semibold text-hero">{pillar.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-neutral-600 dark:text-neutral-300">
                {pillar.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      <footer className="mx-auto max-w-4xl px-6 pb-10 text-sm text-neutral-500 dark:text-neutral-400">
        <Link href="/privacy" className="hover:underline">
          Privacy Policy
        </Link>
      </footer>
    </main>
  );
}
