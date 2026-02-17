import React from 'react';

interface TermsOfServiceProps {
    onBack: () => void;
}

export const TermsOfService: React.FC<TermsOfServiceProps> = ({ onBack }) => {
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
                <h1 className="text-3xl font-bold text-white mb-2">Terms of Service</h1>
                <p className="text-[#6B6B70] text-sm mb-10">Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>

                <div className="space-y-8 text-[15px] leading-relaxed">
                    <Section title="1. Acceptance of Terms">
                        <p>
                            By accessing or using Defia ("Service"), you agree to be bound by these Terms of Service ("Terms").
                            If you do not agree to these Terms, you may not use the Service. These Terms constitute a legally
                            binding agreement between you and Defia ("we," "our," or "us").
                        </p>
                    </Section>

                    <Section title="2. Description of Service">
                        <p>
                            Defia is an AI-powered marketing platform that helps Web3 brands create, schedule, and manage
                            social media content. The Service includes brand analysis, AI content generation, campaign management,
                            analytics, and social media publishing tools.
                        </p>
                    </Section>

                    <Section title="3. Account Registration">
                        <ul className="list-disc pl-5 space-y-2">
                            <li>You must provide accurate and complete information when creating an account.</li>
                            <li>You are responsible for maintaining the security of your account credentials.</li>
                            <li>You must be at least 16 years of age to use the Service.</li>
                            <li>One person or entity may not maintain more than one free account.</li>
                            <li>You are responsible for all activity that occurs under your account.</li>
                        </ul>
                    </Section>

                    <Section title="4. Subscription & Billing">
                        <ul className="list-disc pl-5 space-y-2">
                            <li>The Service offers free and paid subscription tiers with different feature limits.</li>
                            <li>Paid subscriptions are billed monthly through Stripe. Prices are listed on our pricing page.</li>
                            <li>You may cancel your subscription at any time through the Settings page. Cancellation takes effect at the end of the current billing period.</li>
                            <li>Refunds are handled on a case-by-case basis. Contact us within 7 days of a charge for refund consideration.</li>
                            <li>We reserve the right to change pricing with 30 days' notice to existing subscribers.</li>
                        </ul>
                    </Section>

                    <Section title="5. AI-Generated Content">
                        <ul className="list-disc pl-5 space-y-2">
                            <li><strong className="text-white">Ownership:</strong> You retain full ownership of all content generated through the Service using your brand data and inputs.</li>
                            <li><strong className="text-white">No Guarantee:</strong> AI-generated content is provided as suggestions. You are responsible for reviewing and approving all content before publishing.</li>
                            <li><strong className="text-white">Accuracy:</strong> We do not guarantee the accuracy, completeness, or appropriateness of AI-generated content. Always review content for factual correctness and brand alignment.</li>
                            <li><strong className="text-white">Compliance:</strong> You are solely responsible for ensuring published content complies with applicable laws, regulations, and platform policies.</li>
                        </ul>
                    </Section>

                    <Section title="6. Social Media Connections">
                        <p>
                            When you connect social media accounts (such as X/Twitter), you authorize Defia to:
                        </p>
                        <ul className="list-disc pl-5 space-y-1 mt-3">
                            <li>Read your profile information and public posts</li>
                            <li>Post content on your behalf (only when you explicitly schedule or approve it)</li>
                            <li>Access engagement metrics for analytics</li>
                        </ul>
                        <p className="mt-3">
                            You may revoke social media access at any time through your account settings or through
                            the connected platform's settings. We will never post content without your explicit approval.
                        </p>
                    </Section>

                    <Section title="7. Acceptable Use">
                        <p className="mb-3">You agree not to use the Service to:</p>
                        <ul className="list-disc pl-5 space-y-1">
                            <li>Generate or distribute spam, misleading, or deceptive content</li>
                            <li>Violate any applicable laws or regulations</li>
                            <li>Infringe on intellectual property rights of others</li>
                            <li>Generate content promoting illegal activities, hate speech, or violence</li>
                            <li>Attempt to reverse-engineer, exploit, or circumvent platform limitations</li>
                            <li>Share account credentials or allow unauthorized access</li>
                            <li>Interfere with the operation of the Service or its infrastructure</li>
                        </ul>
                    </Section>

                    <Section title="8. Intellectual Property">
                        <p>
                            The Service, including its design, code, AI models, and branding, is owned by Defia and
                            protected by intellectual property laws. You are granted a limited, non-exclusive, non-transferable
                            license to use the Service for its intended purpose during your subscription period.
                        </p>
                    </Section>

                    <Section title="9. Data & Privacy">
                        <p>
                            Your use of the Service is also governed by our{' '}
                            <a href="/privacy" className="text-[#FF5C00] hover:underline">Privacy Policy</a>,
                            which describes how we collect, use, and protect your data. By using the Service,
                            you consent to the data practices described in the Privacy Policy.
                        </p>
                    </Section>

                    <Section title="10. Service Availability">
                        <ul className="list-disc pl-5 space-y-2">
                            <li>We strive for high availability but do not guarantee uninterrupted access to the Service.</li>
                            <li>We may perform maintenance, updates, or modifications that temporarily affect availability.</li>
                            <li>Third-party services (AI providers, social platforms, payment processors) may experience outages beyond our control.</li>
                            <li>We are not liable for any losses resulting from service interruptions.</li>
                        </ul>
                    </Section>

                    <Section title="11. Limitation of Liability">
                        <p>
                            TO THE MAXIMUM EXTENT PERMITTED BY LAW, DEFIA SHALL NOT BE LIABLE FOR ANY INDIRECT,
                            INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO
                            LOSS OF PROFITS, DATA, OR BUSINESS OPPORTUNITIES, ARISING FROM YOUR USE OF THE SERVICE.
                        </p>
                        <p>
                            Our total liability for any claims related to the Service shall not exceed the amount
                            you paid us in the 12 months preceding the claim.
                        </p>
                    </Section>

                    <Section title="12. Disclaimer of Warranties">
                        <p>
                            THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND,
                            EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY,
                            FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
                        </p>
                    </Section>

                    <Section title="13. Termination">
                        <p>
                            We may suspend or terminate your account if you violate these Terms or engage in activity
                            that harms the Service or other users. You may delete your account at any time through
                            Settings. Upon termination, your right to use the Service ceases immediately.
                        </p>
                    </Section>

                    <Section title="14. Changes to Terms">
                        <p>
                            We may modify these Terms at any time. Material changes will be communicated via email
                            or an in-app notification at least 14 days before they take effect. Continued use of the
                            Service after changes take effect constitutes acceptance of the updated Terms.
                        </p>
                    </Section>

                    <Section title="15. Governing Law">
                        <p>
                            These Terms are governed by and construed in accordance with applicable law.
                            Any disputes arising from these Terms or the Service shall be resolved through
                            good-faith negotiation first, and if unresolved, through binding arbitration.
                        </p>
                    </Section>

                    <Section title="16. Contact">
                        <p>
                            Questions about these Terms? Contact us at{' '}
                            <a href="mailto:legal@defia.app" className="text-[#FF5C00] hover:underline">legal@defia.app</a>.
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
