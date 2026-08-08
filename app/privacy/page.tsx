import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — Areta",
  description: "How Areta collects, uses, and protects your data.",
};

const EFFECTIVE_DATE = "August 8, 2026";
const CONTACT_EMAIL = "dgrayze249@gmail.com";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
        {children}
      </div>
    </section>
  );
}

export default function PrivacyPolicyPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <div className="mb-10 space-y-2">
        <Link href="/" className="text-sm text-neutral-500 hover:underline dark:text-neutral-400">
          ← Areta
        </Link>
        <h1 className="text-2xl font-semibold">Privacy Policy</h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">Effective {EFFECTIVE_DATE}</p>
      </div>

      <div className="space-y-8">
        <Section title="Overview">
          <p>
            Areta is a personal operating system for your health, fitness, nutrition, and weekly
            planning. This policy explains what information Areta collects, why, how it&apos;s
            used, who it&apos;s shared with, and the choices you have. It applies to the Areta
            mobile app and the areta-ai.com web app.
          </p>
          <p>
            Most of what Areta collects is information you choose to connect or enter yourself —
            we don&apos;t sell your data, and we don&apos;t use it for advertising.
          </p>
        </Section>

        <Section title="Information we collect">
          <p>
            <strong>Account information.</strong> Email address, name, and password (handled by
            our authentication provider, Supabase — we never see your raw password) when you
            create an account.
          </p>
          <p>
            <strong>Profile and goals.</strong> Information you enter during onboarding and in
            Settings — your mission, goals, current phases, coaching preferences, time zone,
            wake/bed times, and recurring days you set for weekly review, grocery shopping, and
            meal prep.
          </p>
          <p>
            <strong>Health and fitness data (opt-in).</strong> If you connect Apple Health,
            Areta reads categories including body weight, body composition, steps, heart rate
            (including resting and variability), VO2 max, active/basal energy, distance,
            flights climbed, walking metrics, blood oxygen, respiratory rate, sleep, and workout
            sessions. This is read-only — Areta never writes to Apple Health. Data older than a
            rolling 3-year window is not imported. You can disconnect Apple Health at any time
            in Settings, which stops future syncing (previously imported data is handled per the
            retention and deletion terms below).
          </p>
          <p>
            <strong>Nutrition data.</strong> Meals and food items you log, including quantities,
            units, macros, and notes. If you use the barcode scanner, the scanned barcode is sent
            to the free, third-party Open Food Facts database to look up product nutrition
            information — no other personal data is sent with that lookup.
          </p>
          <p>
            <strong>Calendar data (opt-in, read-only).</strong> If you connect Google Calendar,
            Microsoft Outlook, or Apple Calendar, Areta reads your event titles and times so they
            can appear alongside your meals and workouts in your daily schedule. Areta requests
            read-only access and cannot create, edit, or delete events in your calendar. OAuth
            tokens for Google and Microsoft are encrypted at rest; Apple Calendar uses an
            app-specific password you provide, which is also encrypted at rest. You can
            disconnect any calendar at any time in Settings.
          </p>
          <p>
            <strong>Usage and device information.</strong> Standard technical information such as
            app version, device type, and basic request logs, used for debugging and reliability.
          </p>
        </Section>

        <Section title="How we use your information">
          <ul className="list-disc space-y-1 pl-5">
            <li>To generate and adjust your personalized nutrition and workout plans</li>
            <li>To build your daily schedule, combining calendar events with meals and workouts</li>
            <li>To generate your weekly review brief and other AI-assisted summaries</li>
            <li>To track progress toward the goals you set</li>
            <li>To operate, maintain, and secure the app</li>
          </ul>
        </Section>

        <Section title="AI-assisted features">
          <p>
            Some features — such as your weekly review brief and parts of onboarding — use a
            third-party AI provider (Anthropic) to turn your account information into structured,
            personalized content. This can include information like your goals, a summary of your
            recent metrics (for example, derived from health or nutrition data you&apos;ve logged
            or synced), and your own notes. The AI provider processes this information solely to
            generate the requested content for you, under its own data-processing and
            confidentiality terms with us; it is not used to train third-party models.
          </p>
        </Section>

        <Section title="Who we share information with">
          <p>We share information only as needed to run Areta:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>Service providers:</strong> Supabase (database, authentication, file
              storage) and Vercel (app hosting) — both process data on our behalf under their own
              security commitments.
            </li>
            <li>
              <strong>Calendar and health platforms:</strong> Google, Microsoft, and Apple, solely
              to read the calendar data you&apos;ve authorized; Apple Health, solely on your
              device, through Apple&apos;s HealthKit framework.
            </li>
            <li>
              <strong>Open Food Facts,</strong> for barcode-to-nutrition lookups (barcode only, no
              account data).
            </li>
            <li>
              <strong>Anthropic,</strong> for the AI-assisted features described above.
            </li>
            <li>
              <strong>Your trainer,</strong> if you&apos;ve connected with one through Areta —
              trainers can see the client data needed to build and adjust your programs. You can
              end that relationship at any time in Settings.
            </li>
          </ul>
          <p>We do not sell your personal information, and we do not share it for advertising.</p>
        </Section>

        <Section title="Data retention">
          <p>
            We keep your data for as long as your account is active. Imported Apple Health data is
            kept on a rolling 3-year window — older records are not retained. If you delete your
            account, we delete your personal data within a reasonable period, except where we&apos;re
            required to retain it (for example, financial records) or where it&apos;s been
            aggregated so it no longer identifies you.
          </p>
        </Section>

        <Section title="Your choices">
          <ul className="list-disc space-y-1 pl-5">
            <li>Disconnect Apple Health, or any calendar connection, at any time in Settings</li>
            <li>Edit or delete the goals, notes, and logged data you&apos;ve entered</li>
            <li>Request a copy of your data or deletion of your account by contacting us below</li>
          </ul>
        </Section>

        <Section title="Security">
          <p>
            Data is encrypted in transit (HTTPS) and calendar OAuth tokens/credentials are
            encrypted at rest. Access to your data is restricted by row-level security policies
            scoped to your account. No method of storage or transmission is 100% secure, but we
            work to protect your information using industry-standard practices.
          </p>
        </Section>

        <Section title="Children's privacy">
          <p>
            Areta is not directed to children under 13, and we do not knowingly collect
            information from them.
          </p>
        </Section>

        <Section title="International users">
          <p>
            Areta is operated from the United States, and your information is processed there.
          </p>
        </Section>

        <Section title="Changes to this policy">
          <p>
            If we make material changes to this policy, we&apos;ll update the effective date above
            and, where appropriate, notify you in the app.
          </p>
        </Section>

        <Section title="Contact us">
          <p>
            Questions about this policy or your data? Email{" "}
            <a className="underline" href={`mailto:${CONTACT_EMAIL}`}>
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        </Section>
      </div>
    </main>
  );
}
