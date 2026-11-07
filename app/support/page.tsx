import type { Metadata } from "next";
import Link from "next/link";
import { ContactLink, LegalPage, Section } from "@/platform/ui/LegalPage";

export const metadata: Metadata = {
  title: "Support — Areta",
  description:
    "Get help with Areta: contact, account, Apple Health, AI brief and privacy questions.",
};

/**
 * The App Store Connect support URL. Every answer below names the exact
 * screen in the current iOS app -- if a setting moves, this page moves
 * with it, or a person following it gets lost.
 */
export default function SupportPage() {
  return (
    <LegalPage title="Support">
      <Section title="Contact us">
        <p>
          Email <ContactLink /> with any question, problem or idea. Include the
          email address you signed up with and, if something isn&apos;t working,
          what you tapped and what you saw. Every message is read by a person.
        </p>
      </Section>

      <Section title="Signing in">
        <p>
          <strong>Forgot your password?</strong> On the sign-in screen, tap
          &ldquo;Forgot password?&rdquo; and enter your email. You&apos;ll get a
          link to choose a new one. If it doesn&apos;t arrive within a few
          minutes, check your spam folder.
        </p>
      </Section>

      <Section title="Apple Health">
        <p>
          <strong>Connecting or reconnecting.</strong> In Areta, go to Settings
          › Health Sync.
        </p>
        <p>
          <strong>Data isn&apos;t showing up.</strong> Open the iPhone Settings
          app, then Privacy &amp; Security › Health › Areta, and make sure the
          categories you want are turned on. Then open Areta again so it can
          sync.
        </p>
        <p>
          <strong>Stopping it.</strong> Turn the categories off in the same
          place in iPhone Settings. Areta only reads from Apple Health; it never
          writes to it.
        </p>
      </Section>

      <Section title="Your weekly brief and AI">
        <p>
          Your weekly brief is written by an AI service, and only if you allow
          it. To turn it on or off, go to Settings › AI. With it off, nothing
          about you is sent to an AI service and the rest of Areta works as
          normal. See the{" "}
          <Link href="/privacy" className="underline">
            privacy policy
          </Link>{" "}
          for exactly what is sent.
        </p>
      </Section>

      <Section title="Location and Evening Nudge">
        <p>
          Evening Nudge is optional and off until you turn it on in Settings ›
          Evening Nudge. Your home location stays on your phone. To stop it,
          turn it off there; to remove location access completely, use iPhone
          Settings › Areta › Location.
        </p>
      </Section>

      <Section title="Your account and data">
        <p>
          <strong>Deleting your account.</strong> In Areta, go to Settings ›
          Account › Delete account. This permanently deletes your account and
          your data, and can&apos;t be undone.
        </p>
        <p>
          <strong>Getting a copy of your data.</strong> Email <ContactLink />{" "}
          from the address you signed up with.
        </p>
      </Section>

      <Section title="A note on health">
        <p>
          Areta helps you plan and reflect. It isn&apos;t medical advice. If you
          have a medical condition, are pregnant, or feel pain, dizziness or
          shortness of breath while exercising, stop and talk to a doctor. In an
          emergency, call your local emergency number.
        </p>
      </Section>
    </LegalPage>
  );
}
