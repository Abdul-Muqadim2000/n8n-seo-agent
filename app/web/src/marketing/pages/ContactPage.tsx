import { Section, SectionHeading } from '../components';
import { useSeo } from '../useSeo';

// Stub — filled in by the page agents. Uses the marketing layout (header + footer) from the router.
export default function ContactPage() {
  useSeo({ title: 'Contact', description: 'Talk to the Ascentra team about plans, onboarding and running many websites.', path: '/contact' });
  return (
    <Section tone="page" spacing="lg">
      <SectionHeading as="h1" size="lg" eyebrow="Contact" title="Talk to us." lead="Questions about plans, onboarding or running many websites — write to us and a person will answer." />
    </Section>
  );
}
