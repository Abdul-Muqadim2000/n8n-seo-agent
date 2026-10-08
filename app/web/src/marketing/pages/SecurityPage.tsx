import { Section, SectionHeading } from '../components';
import { useSeo } from '../useSeo';

// Stub — filled in by the page agents. Uses the marketing layout (header + footer) from the router.
export default function SecurityPage() {
  useSeo({ title: 'Security', description: 'How Ascentra protects your data: verified website ownership, roles, data isolation per company, budget guards and spend caps.', path: '/security' });
  return (
    <Section tone="page" spacing="lg">
      <SectionHeading as="h1" size="lg" eyebrow="Security" title="Your data, your websites, your rules." lead="Verified ownership before any data is shown, roles for every person, isolation per company and a budget check before any paid work." />
    </Section>
  );
}
