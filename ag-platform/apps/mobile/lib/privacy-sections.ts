// Privacy policy text — mirrors the web app's policy-sections.tsx (PR #77).
// In-app rendering must work offline, so the policy lives in the bundle.
// When the web policy changes, update both in the same PR.

export const POLICY_LAST_UPDATED = '17 May 2026';
export const POLICY_CONTACT_EMAIL = 'privacy@agassociates.example.com';
export const POLICY_DPO_EMAIL = 'dpo@agassociates.example.com';

export interface PolicySection {
    title: string;
    paragraphs: string[];
    bullets?: string[];
}

export const POLICY_SECTIONS: PolicySection[] = [
    {
        title: '1. Who we are',
        paragraphs: [
            'AG Associates ("we", "us") is a property law firm and panel advocate based in Thane, Maharashtra, India. We operate this platform on behalf of partner banks and NBFCs to process property-related legal matters (Title Search, Legal Vetting, Registration, NOI, Balance Transfer).',
        ],
    },
    {
        title: '2. What data we collect',
        paragraphs: [],
        bullets: [
            'Account data: name, work email, phone, role, organization assignment.',
            'Case data: matter type, bank partner, borrower / property identifiers strictly as required for legal processing.',
            'Documents: scanned property documents, KYC records, signed agreements uploaded to private encrypted storage.',
            'Field-app telemetry: GPS coordinates recorded only while you have toggled "on duty". Tracking stops immediately when toggled off.',
            'Diagnostic data: anonymous crash reports via Sentry (opt-out in Settings → Privacy).',
            'Communication metadata: WhatsApp / email delivery receipts for case-status notifications.',
        ],
    },
    {
        title: '3. How we use it',
        paragraphs: [
            'We do not sell personal data, and we do not use case or document content to train external AI models.',
        ],
        bullets: [
            'To fulfil legal services contracted by partner banks and NBFCs.',
            'To assign cases, track field activity, and audit transitions.',
            'To meet statutory record-keeping obligations under the Indian Stamp Act, Registration Act, and Bar Council rules.',
            'To improve reliability and security of the platform.',
        ],
    },
    {
        title: '4. Third-party processors',
        paragraphs: [
            'Data is processed by a small set of named processors under contract:',
        ],
        bullets: [
            'Supabase — primary database, authentication, and document storage.',
            'Sentry — application crash and error reporting (opt-out available).',
            'WhatsApp Business Cloud (Meta) — transactional case-update notifications to consenting parties.',
            'Resend — transactional email (magic-link sign-in and notifications).',
            'Google Gemini, vLLM-hosted models — used server-side only for document drafting and compliance review; raw case content is not exposed to client SDKs.',
        ],
    },
    {
        title: '5. Retention',
        paragraphs: [
            'Case documents are retained for at least seven years from case closure to satisfy regulatory requirements, then archived or securely deleted. Field-activity GPS logs are retained for 90 days. Account data is retained while the account is active and for one year after deactivation unless a longer period is required by law.',
        ],
    },
    {
        title: '6. Your rights under the DPDP Act',
        paragraphs: [],
        bullets: [
            'Right to access and correct your personal data.',
            'Right to erasure, subject to our statutory retention duties.',
            'Right to nominate another person to exercise your rights in the event of death or incapacity.',
            'Right to grievance redressal — contact our Data Protection Officer.',
        ],
    },
    {
        title: '7. Security',
        paragraphs: [
            'All transport is TLS-encrypted. Database access is gated by row-level security keyed on organization and role. Document storage uses private buckets accessed via short-lived signed URLs (60 seconds). Mobile-app sessions use device-bound tokens stored in the OS keystore.',
        ],
    },
    {
        title: '8. Children',
        paragraphs: [
            'The platform is not intended for users under 18. We do not knowingly collect personal data from minors.',
        ],
    },
    {
        title: '9. Changes to this policy',
        paragraphs: [
            'Material changes will be communicated by email and in-app notice at least 14 days before they take effect. The "Effective" date above is always current.',
        ],
    },
];
