import { redirect } from "next/navigation";
import Link from "next/link";
import { getUser } from "@/platform/auth/session";
import { LogoMark } from "@/platform/ui/Logo";
import { Reveal } from "@/platform/ui/Reveal";
import { TargetIcon, LeafIcon, DumbbellIcon, ScheduleIcon } from "@/platform/ui/marketing-icons";

const PILLARS = [
  {
    icon: TargetIcon,
    title: "Goals & phases",
    body: "Set what you're actually working toward, broken into the current phase you're in right now — not a vague resolution you'll forget in a week.",
  },
  {
    icon: LeafIcon,
    title: "Nutrition",
    body: "Log meals in seconds (barcode scan included), see today's totals against your targets, and get a plan built around how you actually eat.",
  },
  {
    icon: DumbbellIcon,
    title: "Exercise",
    body: "A workout plan built for your goal and experience level, with the reasoning behind today's session, not just a list of exercises.",
  },
  {
    icon: ScheduleIcon,
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
 *
 * Deliberately no app screenshots yet -- nothing clean/launch-ready exists
 * today (only fixture-account Simulator captures) -- so the hero is an
 * abstract brand-color aurora instead. Swap in a real device mockup once
 * real screenshots exist.
 */
export default async function RootPage() {
  const user = await getUser();
  if (user) {
    redirect("/dashboard");
  }

  return (
    <main className="min-h-full bg-canvas">
      <header className="sticky top-0 z-50 border-b border-black/5 bg-canvas/75 backdrop-blur-md dark:border-white/5">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <span className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <LogoMark size={28} />
            Areta
          </span>
          <nav className="flex items-center gap-2">
            <Link
              href="/login"
              className="rounded-full px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-black/5 dark:hover:bg-white/5"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="rounded-full bg-brand px-4 py-2 text-sm font-medium text-brand-ink shadow-sm transition-all hover:shadow-md hover:brightness-105 active:scale-[0.98]"
            >
              Sign up
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative isolate overflow-hidden">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
          <div className="animate-aurora-a absolute -top-32 -left-24 h-[28rem] w-[28rem] rounded-full bg-brand/30 blur-[100px] dark:bg-brand/20" />
          <div className="animate-aurora-b absolute top-10 -right-32 h-[26rem] w-[26rem] rounded-full bg-accent/25 blur-[100px] dark:bg-accent/20" />
          <div className="animate-aurora-c absolute top-64 left-1/3 h-[22rem] w-[22rem] rounded-full bg-hero/10 blur-[100px] dark:bg-hero/30" />
        </div>

        <div className="mx-auto max-w-3xl px-6 pt-20 pb-24 text-center sm:pt-28 sm:pb-32">
          <Reveal>
            <span className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-card/80 px-3 py-1 text-xs font-medium text-neutral-600 backdrop-blur-sm dark:border-white/10 dark:text-neutral-300">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              Personal execution &amp; weekly regeneration
            </span>
          </Reveal>

          <Reveal delayMs={80}>
            <h1 className="mt-6 text-5xl leading-[1.05] font-semibold tracking-tight text-foreground sm:text-6xl">
              Become <span className="text-brand">More</span> of
              <br />
              Who You Are
            </h1>
          </Reveal>

          <Reveal delayMs={160}>
            <p className="mx-auto mt-6 max-w-xl text-lg text-neutral-600 dark:text-neutral-300">
              One place for your goals, nutrition, exercise, and daily schedule — built around who
              you actually are and where you&apos;re actually headed.
            </p>
          </Reveal>

          <Reveal delayMs={240}>
            <div className="mt-9 flex items-center justify-center gap-3">
              <Link
                href="/signup"
                className="rounded-full bg-brand px-6 py-3 text-sm font-semibold text-brand-ink shadow-lg shadow-brand/25 transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-brand/30 active:translate-y-0 active:scale-[0.98]"
              >
                Get started
              </Link>
              <Link
                href="/login"
                className="rounded-full border border-black/10 px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/5"
              >
                Log in
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Pillars */}
      <section className="mx-auto max-w-5xl px-6 pb-24">
        <Reveal>
          <div className="mx-auto mb-12 max-w-xl text-center">
            <h2 className="text-2xl font-semibold text-foreground sm:text-3xl">
              Everything that runs your week, in one place
            </h2>
            <p className="mt-3 text-neutral-600 dark:text-neutral-300">
              Not four separate apps fighting for your attention — one system that actually talks
              to itself.
            </p>
          </div>
        </Reveal>

        <div className="grid gap-5 sm:grid-cols-2">
          {PILLARS.map((pillar, i) => {
            const Icon = pillar.icon;
            return (
              <Reveal key={pillar.title} delayMs={i * 90}>
                <div className="group h-full rounded-2xl border border-black/5 bg-card p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg dark:border-white/5">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand/10 text-brand transition-colors group-hover:bg-brand/15">
                    <Icon />
                  </div>
                  <h3 className="mt-4 font-semibold text-foreground">{pillar.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-neutral-600 dark:text-neutral-300">
                    {pillar.body}
                  </p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* CTA band */}
      <section className="mx-auto max-w-5xl px-6 pb-24">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl bg-hero px-8 py-14 text-center sm:px-16">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-gradient-to-br from-brand/30 via-transparent to-accent/20"
            />
            <div className="relative">
              <h2 className="text-2xl font-semibold text-hero-ink sm:text-3xl">
                Ready to become more of who you are?
              </h2>
              <p className="mx-auto mt-3 max-w-md text-hero-ink/70">
                Free to start. Set your goals, connect your calendar, and get a plan built around
                you.
              </p>
              <Link
                href="/signup"
                className="mt-8 inline-block rounded-full bg-brand px-7 py-3 text-sm font-semibold text-brand-ink shadow-lg transition-all hover:-translate-y-0.5 hover:shadow-xl active:translate-y-0 active:scale-[0.98]"
              >
                Get started free
              </Link>
            </div>
          </div>
        </Reveal>
      </section>

      <footer className="mx-auto max-w-5xl px-6 pb-10">
        <div className="flex flex-col items-center justify-between gap-4 border-t border-black/5 pt-8 text-sm text-neutral-500 sm:flex-row dark:border-white/5 dark:text-neutral-400">
          <span className="flex items-center gap-2">
            <LogoMark size={16} />
            Areta
          </span>
          <Link href="/privacy" className="hover:underline">
            Privacy Policy
          </Link>
        </div>
      </footer>
    </main>
  );
}
