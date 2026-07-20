import type { Metadata } from "next";
import Link from "next/link";

import { LegalPage, LegalSection } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Privacy Policy — dots",
  description: "How dots collects, uses, and protects your data.",
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="July 18, 2026">
      <LegalSection title="1. What we collect">
        <p>
          When you create an account we collect your name, email address, and
          password (or your Google account profile if you sign in with Google).
          As you use dots we store the content you create: your habits, their
          settings, and your completion history.
        </p>
      </LegalSection>

      <LegalSection title="2. How we use your data">
        <p>
          We use your data only to provide the Service: authenticating you,
          syncing your habits across devices, and showing you your own
          progress. We do not sell your data, use it for advertising, or share
          it with third parties except the service providers described below.
        </p>
      </LegalSection>

      <LegalSection title="3. Where your data lives">
        <p>
          dots is built on Google Firebase. Your account is managed by Firebase
          Authentication and your habit data is stored in Cloud Firestore,
          operated by Google LLC. Google processes this data on our behalf
          under its own privacy and security commitments.
        </p>
      </LegalSection>

      <LegalSection title="4. Cookies and local storage">
        <p>
          We use browser local storage for essentials only: keeping you signed
          in and remembering your theme preference. We do not use tracking or
          advertising cookies.
        </p>
      </LegalSection>

      <LegalSection title="5. Data retention and deletion">
        <p>
          We keep your data for as long as your account exists. If you delete
          your account, your habits and completion history are permanently
          deleted. You can also request deletion by contacting us at the email
          address below.
        </p>
      </LegalSection>

      <LegalSection title="6. Security">
        <p>
          Your data is transmitted over encrypted connections and protected by
          Firebase security rules so that only you can read or write your own
          records. No system is perfectly secure, but we take reasonable
          measures to protect your information.
        </p>
      </LegalSection>

      <LegalSection title="7. Children">
        <p>
          The Service is not directed at children under 13, and we do not
          knowingly collect personal information from them.
        </p>
      </LegalSection>

      <LegalSection title="8. Changes to this policy">
        <p>
          We may update this policy from time to time. If we make material
          changes, we will update the &ldquo;Last updated&rdquo; date above.
          Your continued use of the Service after changes take effect
          constitutes acceptance of the revised policy. See also our{" "}
          <Link
            href="/terms"
            className="underline underline-offset-4 hover:text-foreground"
          >
            Terms of Service
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection title="9. Contact">
        <p>
          Questions about your data? Contact us at{" "}
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
