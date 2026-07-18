import type { Metadata } from "next";
import Link from "next/link";

import { LegalPage, LegalSection } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Terms of Service — dots",
  description: "The terms that govern your use of dots.",
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated="July 18, 2026">
      <LegalSection title="1. Acceptance of these terms">
        <p>
          By creating an account or using dots (the &ldquo;Service&rdquo;), you
          agree to be bound by these Terms of Service. If you do not agree to
          these terms, do not use the Service.
        </p>
      </LegalSection>

      <LegalSection title="2. The Service">
        <p>
          dots is a personal habit-tracking application. It lets you create
          habits, record completions, and view your progress over time. The
          Service is provided as-is and may change, gain, or lose features at
          any time without notice.
        </p>
      </LegalSection>

      <LegalSection title="3. Your account">
        <p>
          You need an account to use the Service. You are responsible for
          safeguarding your credentials and for all activity that occurs under
          your account. You must provide accurate information and keep it up to
          date, and you must notify us promptly if you suspect unauthorized use
          of your account.
        </p>
      </LegalSection>

      <LegalSection title="4. Your content">
        <p>
          The habits, notes, and records you create in dots belong to you. By
          using the Service you grant us permission to store and process this
          content solely to operate and improve the Service. We do not sell
          your content or use it for advertising.
        </p>
      </LegalSection>

      <LegalSection title="5. Acceptable use">
        <p>
          You agree not to misuse the Service. Among other things, you must
          not: attempt to access accounts or data that are not yours, interfere
          with or disrupt the Service, reverse engineer it except where
          permitted by law, or use it for any unlawful purpose.
        </p>
      </LegalSection>

      <LegalSection title="6. Termination">
        <p>
          You may stop using the Service and delete your account at any time.
          We may suspend or terminate your access if you violate these terms or
          if we discontinue the Service. Upon termination, your data will be
          deleted in accordance with our{" "}
          <Link
            href="/privacy"
            className="underline underline-offset-4 hover:text-foreground"
          >
            Privacy Policy
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection title="7. Disclaimers and limitation of liability">
        <p>
          The Service is provided &ldquo;as is&rdquo; without warranties of any
          kind, express or implied, including fitness for a particular purpose
          and non-infringement. To the maximum extent permitted by law, we are
          not liable for any indirect, incidental, or consequential damages, or
          for loss of data, arising from your use of the Service.
        </p>
      </LegalSection>

      <LegalSection title="8. Changes to these terms">
        <p>
          We may update these terms from time to time. If we make material
          changes, we will update the &ldquo;Last updated&rdquo; date above.
          Continuing to use the Service after changes take effect constitutes
          acceptance of the revised terms.
        </p>
      </LegalSection>

      <LegalSection title="9. Contact">
        <p>
          Questions about these terms? Contact us at{" "}
          <a
            href="mailto:j4vianz01@gmail.com"
            className="underline underline-offset-4 hover:text-foreground"
          >
            j4vianz01@gmail.com
          </a>
          .
        </p>
      </LegalSection>
    </LegalPage>
  );
}
