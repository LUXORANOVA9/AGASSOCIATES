import { Shield, Mail } from 'lucide-react';
import {
    POLICY_LAST_UPDATED,
    POLICY_CONTACT_EMAIL,
    POLICY_DPO_EMAIL,
    POLICY_SECTIONS,
} from './policy-sections';

// Single source of truth for AG Associates' privacy policy. Both the web app
// route (/privacy) and the React Native app's in-app privacy screen render
// this exact text. App Store / Play Store listings must link to the hosted
// /privacy URL.

export function PrivacyPolicy() {
    return (
        <div className="max-w-3xl mx-auto px-6 py-10 text-slate-800 leading-relaxed">
            <header className="mb-8 pb-6 border-b border-slate-200">
                <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">
                        <Shield size={22} />
                    </div>
                    <h1 className="text-2xl font-serif font-bold text-slate-900">
                        Privacy Policy
                    </h1>
                </div>
                <p className="text-sm text-slate-600">
                    Effective {POLICY_LAST_UPDATED}. This policy explains how AG Associates
                    collects, uses, stores, and discloses personal data through our web
                    platform and mobile field app, in compliance with India's Digital
                    Personal Data Protection Act, 2023 (DPDP Act).
                </p>
            </header>

            {POLICY_SECTIONS.map((section) => (
                <section key={section.title} className="mb-7">
                    <h2 className="text-lg font-semibold text-slate-900 mb-2">
                        {section.title}
                    </h2>
                    <div className="text-sm">{section.body}</div>
                </section>
            ))}

            <section className="mb-7">
                <h2 className="text-lg font-semibold text-slate-900 mb-2">
                    10. Contact
                </h2>
                <div className="text-sm">
                    <p className="mb-2">For questions or to exercise your rights:</p>
                    <ul className="list-none space-y-1">
                        <li className="flex items-center gap-2">
                            <Mail size={14} /> Privacy team:&nbsp;
                            <a
                                className="text-indigo-700 hover:underline"
                                href={`mailto:${POLICY_CONTACT_EMAIL}`}
                            >
                                {POLICY_CONTACT_EMAIL}
                            </a>
                        </li>
                        <li className="flex items-center gap-2">
                            <Mail size={14} /> Data Protection Officer:&nbsp;
                            <a
                                className="text-indigo-700 hover:underline"
                                href={`mailto:${POLICY_DPO_EMAIL}`}
                            >
                                {POLICY_DPO_EMAIL}
                            </a>
                        </li>
                    </ul>
                </div>
            </section>
        </div>
    );
}
