import type { Metadata } from "next";
import Link from "next/link";
import { ContactLink, LegalPage, Section } from "@/platform/ui/LegalPage";

export const metadata: Metadata = {
  title: "Terms of Use — Areta",
  description: "The terms for using the Areta app and areta-ai.com.",
};

const EFFECTIVE_DATE = "November 7, 2026";

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Use" effectiveDate={EFFECTIVE_DATE}>
      <Section title="The short version">
        <p>
          Areta helps you plan your training, food and week, and reflect on how
          it went. It is not a doctor, and nothing in it is medical advice. Use
          your own judgement, listen to your body, and talk to a professional
          about anything medical. Your data is yours; see the{" "}
          <Link href="/privacy" className="underline">
            privacy policy
          </Link>{" "}
          for how we handle it.
        </p>
        <p>
          The rest of this page is the full version. By creating an account or
          using Areta, you agree to these terms.
        </p>
      </Section>

      <Section title="Who can use Areta">
        <p>
          You must be at least 13 years old to use Areta. If you are under the
          age of majority where you live, you need a parent or guardian&apos;s
          permission. You&apos;re responsible for keeping your password private
          and for what happens under your account.
        </p>
      </Section>

      <Section title="Not medical advice">
        <p>
          Areta&apos;s plans, workouts, meal suggestions, nutrition targets,
          insights and weekly briefs are general information to help you
          organize your own routine. They are not medical, nutritional or
          psychological advice, diagnosis or treatment, and they don&apos;t
          replace a doctor, dietitian or other qualified professional.
        </p>
        <p>
          Check with a doctor before starting a new exercise or nutrition
          program, especially if you have a medical condition, an injury, an
          eating disorder or a history of one, or are pregnant. Stop exercising
          and get help if you feel pain, dizziness, chest pain or shortness of
          breath. In an emergency, call your local emergency number.
        </p>
      </Section>

      <Section title="AI-written content">
        <p>
          If you allow it, your weekly brief is written by an AI service from a
          summary of your data. AI can be wrong, incomplete or out of date, even
          when it sounds confident. Treat what it says as a suggestion to think
          about, not an instruction. Changes the brief suggests to your plan
          only take effect if you approve them.
        </p>
      </Section>

      <Section title="Trainers">
        <p>
          If you connect with a trainer through Areta, that trainer is
          independent of us. They are responsible for the programs and advice
          they give you, and we don&apos;t verify their qualifications. You can
          end that connection at any time.
        </p>
      </Section>

      <Section title="Your content">
        <p>
          You own what you put into Areta: your goals, notes, logs and connected
          data. You give us permission to store and process it only to run Areta
          for you, as described in the privacy policy. When you delete your
          account, that permission ends.
        </p>
      </Section>

      <Section title="Acceptable use">
        <p>Please don&apos;t:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>break the law using Areta, or use it to harm anyone</li>
          <li>try to access other people&apos;s accounts or data</li>
          <li>interfere with, overload or reverse-engineer the service</li>
          <li>scrape, copy or resell Areta or its content</li>
        </ul>
      </Section>

      <Section title="Other services">
        <p>
          Areta can connect to services like Apple Health, Google Calendar and
          Microsoft Outlook. Your use of those services is governed by their own
          terms, and we&apos;re not responsible for them or the data they
          provide.
        </p>
      </Section>

      <Section title="Price">
        <p>
          Areta is currently free. If we introduce paid features, we&apos;ll
          tell you before you are ever charged, and you&apos;ll choose whether
          to pay.
        </p>
      </Section>

      <Section title="Ending your use">
        <p>
          You can stop using Areta and delete your account at any time in
          Settings › Account. We may suspend or close an account that breaks
          these terms or puts other people or the service at risk. We may also
          change or stop offering parts of Areta; if we shut it down, we&apos;ll
          give you reasonable notice where we can.
        </p>
      </Section>

      <Section title="Disclaimers">
        <p>
          Areta is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo;.
          To the extent the law allows, we make no warranties, express or
          implied, including that Areta will be error-free, uninterrupted, or
          that its data, calculations or suggestions will be accurate or fit for
          a particular purpose.
        </p>
      </Section>

      <Section title="Limitation of liability">
        <p>
          To the extent the law allows, we are not liable for any indirect,
          incidental, special or consequential damages, or for any injury, loss
          of data or loss of profits, arising from your use of Areta. Nothing in
          these terms limits liability that can&apos;t be limited under the law
          where you live.
        </p>
      </Section>

      <Section title="If you downloaded Areta from the App Store">
        <p>
          These terms are between you and us, not Apple. Apple isn&apos;t
          responsible for Areta, its content, maintenance or support, or any
          claims relating to it. Apple and its subsidiaries are third-party
          beneficiaries of these terms and may enforce them against you. If
          Areta fails to meet any applicable warranty, you may notify Apple, and
          to the extent the law allows, Apple has no other warranty obligation
          for it.
        </p>
      </Section>

      <Section title="Changes to these terms">
        <p>
          If we make material changes, we&apos;ll update the effective date
          above and, where appropriate, tell you in the app. Continuing to use
          Areta after a change means you accept the updated terms.
        </p>
      </Section>

      <Section title="Contact">
        <p>
          Questions about these terms? Email <ContactLink />.
        </p>
      </Section>
    </LegalPage>
  );
}
