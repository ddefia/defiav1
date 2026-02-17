import React from 'react';

interface PrivacyPolicyProps {
    onBack: () => void;
}

export const PrivacyPolicy: React.FC<PrivacyPolicyProps> = ({ onBack }) => {
    return (
        <div className="min-h-screen bg-[#0A0A0B] text-[#E0E0E0]">
            {/* Header */}
            <header className="sticky top-0 z-50 bg-[#0A0A0B]/90 backdrop-blur-md border-b border-[#1F1F23]">
                <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-4">
                    <button
                        onClick={onBack}
                        className="flex items-center gap-2 text-[#6B6B70] hover:text-[#FF5C00] transition-colors text-sm"
                    >
                        <span className="material-icons text-lg">arrow_back</span>
                        Back
                    </button>
                    <div className="h-4 w-px bg-[#1F1F23]" />
                    <span className="text-white font-semibold text-sm tracking-wide">Defia</span>
                </div>
            </header>

            {/* Content */}
            <main className="max-w-3xl mx-auto px-6 py-12 pb-24">
                <h1 className="text-3xl font-bold text-white mb-2">Privacy Policy</h1>
                <p className="text-[#6B6B70] text-sm mb-10">Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>

                <div className="space-y-8 text-[15px] leading-relaxed">
                    <Section title="1. Introduction">
                        <p>
                            Defia ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect,
                            use, disclose, and safeguard your information when you use our AI-powered marketing platform ("Service").
                        </p>
                        <p>
                            By accessing or using the Service, you agree to this Privacy Policy. If you do not agree with the terms of this
                            Privacy Policy, please do not access the Service.
                        </p>
                    </Section>

                    <Section title="2. Information We Collect">
                        <h4 className="text-white font-medium mb-2">Account Information</h4>
                        <ul className="list-disc pl-5 space-y-1 mb-4">
                            <li>Email address and password (encrypted)</li>
                            <li>Brand name and website URL</li>
                            <li>Profile preferences and settings</li>
                        </ul>

                        <h4 className="text-white font-medium mb-2">Brand & Content Data</h4>
                        <ul className="list-disc pl-5 space-y-1 mb-4">
                            <li>Website content analyzed during onboarding</li>
                            <li>Social media content and analytics you connect</li>
                            <li>AI-generated content, drafts, and campaign data</li>
                            <li>Brand identity profiles and style preferences</li>
                        </ul>

                        <h4 className="text-white font-medium mb-2">Usage Data</h4>
                        <ul className="list-disc pl-5 space-y-1">
                            <li>Feature usage patterns and interactions</li>
                            <li>Device type, browser, and operating system</li>
                            <li>IP address and approximate location</li>
                        </ul>
                    </Section>

                    <Section title="3. How We Use Your Information">
                        <p className="mb-3">We use the information we collect to:</p>
                        <ul className="list-disc pl-5 space-y-1">
                            <li>Provide, maintain, and improve the Service</li>
                            <li>Generate AI-powered marketing content tailored to your brand</li>
                            <li>Analyze your brand identity and competitive landscape</li>
                            <li>Schedule and publish content on connected social platforms</li>
                            <li>Process subscription payments and manage your account</li>
                            <li>Send transactional emails (account verification, billing)</li>
                            <li>Monitor and improve platform performance and security</li>
                        </ul>
                    </Section>

                    <Section title="4. Third-Party Services">
                        <p className="mb-3">We integrate with the following third-party services to deliver the Service:</p>
                        <ul className="list-disc pl-5 space-y-2">
                            <li><strong className="text-white">Supabase</strong> — Authentication and database hosting</li>
                            <li><strong className="text-white">Google Gemini AI</strong> — Content generation and brand analysis</li>
                            <li><strong className="text-white">Stripe</strong> — Payment processing (we never store your full card details)</li>
                            <li><strong className="text-white">X (Twitter) API</strong> — Social media publishing and analytics (only when you connect your account)</li>
                            <li><strong className="text-white">Vercel</strong> — Application hosting and serverless infrastructure</li>
                        </ul>
                        <p className="mt-3">
                            Each third-party service has its own privacy policy. We encourage you to review their policies.
                        </p>
                    </Section>

                    <Section title="5. Data Storage & Security">
                        <p>
                            Your data is stored using Supabase (powered by PostgreSQL) with encryption at rest and in transit.
                            We implement industry-standard security measures including:
                        </p>
                        <ul className="list-disc pl-5 space-y-1 mt-3">
                            <li>HTTPS/TLS encryption for all data in transit</li>
                            <li>Row-level security policies to isolate user data</li>
                            <li>API keys and secrets stored server-side only</li>
                            <li>OAuth 2.0 with PKCE for social platform connections</li>
                            <li>Regular security reviews and dependency updates</li>
                        </ul>
                    </Section>

                    <Section title="6. Data Retention">
                        <p>
                            We retain your data for as long as your account is active. If you delete your account,
                            we will remove your personal data within 30 days, except where we are required by law to retain it.
                            Aggregated, anonymized data may be retained for analytics purposes.
                        </p>
                    </Section>

                    <Section title="7. Your Rights">
                        <p className="mb-3">Depending on your jurisdiction, you may have the right to:</p>
                        <ul className="list-disc pl-5 space-y-1">
                            <li>Access the personal data we hold about you</li>
                            <li>Request correction of inaccurate data</li>
                            <li>Request deletion of your data</li>
                            <li>Export your data in a portable format</li>
                            <li>Withdraw consent at any time</li>
                            <li>Object to automated decision-making</li>
                        </ul>
                        <p className="mt-3">
                            To exercise any of these rights, contact us at <a href="mailto:privacy@defia.app" className="text-[#FF5C00] hover:underline">privacy@defia.app</a>.
                        </p>
                    </Section>

                    <Section title="8. Cookies & Local Storage">
                        <p>
                            We use browser local storage to persist your session, preferences, and cached content data.
                            We do not use third-party tracking cookies. Essential cookies may be used for authentication
                            and security purposes only.
                        </p>
                    </Section>

                    <Section title="9. Children's Privacy">
                        <p>
                            The Service is not intended for users under the age of 16. We do not knowingly collect
                            personal data from children. If you believe we have collected data from a minor, please contact us
                            and we will delete it promptly.
                        </p>
                    </Section>

                    <Section title="10. Changes to This Policy">
                        <p>
                            We may update this Privacy Policy from time to time. We will notify you of material changes
                            by posting the updated policy on this page and updating the "Last updated" date. Your continued
                            use of the Service after changes are posted constitutes acceptance of the revised policy.
                        </p>
                    </Section>

                    <Section title="11. Contact Us">
                        <p>
                            If you have any questions about this Privacy Policy, please contact us at{' '}
                            <a href="mailto:privacy@defia.app" className="text-[#FF5C00] hover:underline">privacy@defia.app</a>.
                        </p>
                    </Section>
                </div>
            </main>
        </div>
    );
};

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <section>
        <h3 className="text-lg font-semibold text-white mb-3">{title}</h3>
        <div className="text-[#A0A0A6] space-y-3">{children}</div>
    </section>
);
