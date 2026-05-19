import { ReactNode } from 'react';

export const POLICY_LAST_UPDATED = '17 May 2026';
export const POLICY_CONTACT_EMAIL = 'privacy@agassociates.example.com';
export const POLICY_DPO_EMAIL = 'dpo@agassociates.example.com';

export interface PolicySection {
    title: string;
    body: ReactNode;
}

export const POLICY_SECTIONS: PolicySection[] = [
    {
        title: '1. Who we are',
        body: (
            <p>
                AG Associates ("we", "us") is a property law firm and panel advocate
                based in Thane, Maharashtra, India. We operate this platform on behalf
                of partner banks and NBFCs to process property-related legal matters
                (Title Search, Legal Vetting, Registration, NOI, Balance Transfer).
            </p>
        ),
    },
    {
        title: '2. What data we collect',
        body: (
            <ul className="list-disc pl-6 space-y-2">
                <li>
                    <strong>Account data:</strong> name, work email, phone, role
                    (advocate, executive, clerk, bank viewer), organization assignment.
                </li>
                <li>
                    <strong>Case data:</strong> matter type, bank partner, borrower /
                    property identifiers strictly as required for legal processing.
                </li>
                <li>
                    <strong>Documents:</strong> scanned property documents, KYC records,
                    signed agreements uploaded to our private encrypted storage.
                </li>
                <li>
                    <strong>Field-app telemetry (mobile only):</strong> GPS coordinates
                    recorded while a field executive has explicitly toggled "on duty",
                    attached to status updates and document captures. Tracking stops
                    immediately when toggled off.
                </li>
                <li>
                    <strong>Diagnostic data:</strong> crash reports via Sentry; aggregated
                    product usage via PostHog (you can opt out in app settings).
                </li>
                <li>
                    <strong>Communication metadata:</strong> WhatsApp / email delivery
                    receipts for case-status notifications.
                </li>
            </ul>
        ),
    },
    {
        title: '3. How we use it',
        body: (
            <>
                <ul className="list-disc pl-6 space-y-2">
                    <li>To fulfil legal services contracted by partner banks and NBFCs.</li>
                    <li>To assign cases, track field activity, and audit transitions.</li>
                    <li>
                        To meet statutory record-keeping obligations under the Indian
                        Stamp Act, Registration Act, and Bar Council rules.
                    </li>
                    <li>To improve reliability and security of the platform.</li>
                </ul>
                <p className="mt-3">
                    We do <strong>not</strong> sell personal data, and we do not use case
                    or document content to train external AI models.
                </p>
            </>
        ),
    },
    {
        title: '4. Third-party processors',
        body: (
            <>
                <p className="mb-2">
                    Data is processed by a small set of named processors under contract:
                </p>
                <ul className="list-disc pl-6 space-y-2">
                    <li>
                        <strong>Supabase</strong> — primary database, authentication, and
                        document storage.
                    </li>
                    <li>
                        <strong>Sentry</strong> — application crash and error reporting.
                    </li>
                    <li>
                        <strong>PostHog</strong> — anonymised product analytics; opt-out
                        available in app settings.
                    </li>
                    <li>
                        <strong>WhatsApp Business Cloud (Meta)</strong> — transactional
                        case-update notifications to consenting parties.
                    </li>
                    <li>
                        <strong>Resend</strong> — transactional email (magic-link sign-in
                        and notifications).
                    </li>
                    <li>
                        <strong>Google Gemini, vLLM-hosted models</strong> — used
                        server-side only for document drafting and compliance review; raw
                        case content is not exposed to client SDKs.
                    </li>
                </ul>
            </>
        ),
    },
    {
        title: '5. Retention',
        body: (
            <p>
                Case documents are retained for at least seven years from case closure to
                satisfy regulatory requirements, then archived or securely deleted.
                Field-activity GPS logs are retained for 90 days. Account data is retained
                while the account is active and for one year after deactivation unless a
                longer period is required by law.
            </p>
        ),
    },
    {
        title: '6. Your rights under the DPDP Act',
        body: (
            <ul className="list-disc pl-6 space-y-2">
                <li>Right to access and correct your personal data.</li>
                <li>Right to erasure, subject to our statutory retention duties.</li>
                <li>
                    Right to nominate another person to exercise your rights in the event
                    of death or incapacity.
                </li>
                <li>
                    Right to grievance redressal — contact our Data Protection Officer
                    using the addresses below.
                </li>
            </ul>
        ),
    },
    {
        title: '7. Security',
        body: (
            <p>
                All transport is TLS-encrypted. Database access is gated by row-level
                security keyed on organization and role. Document storage uses private
                buckets accessed via short-lived signed URLs (60 seconds). Mobile-app
                sessions use device-bound tokens stored in the OS keystore.
            </p>
        ),
    },
    {
        title: '8. Children',
        body: (
            <p>
                The platform is not intended for users under 18. We do not knowingly
                collect personal data from minors.
            </p>
        ),
    },
    {
        title: '9. Changes to this policy',
        body: (
            <p>
                Material changes will be communicated by email and in-app notice at least
                14 days before they take effect. The "Effective" date above is always
                current.
            </p>
        ),
    },
];
