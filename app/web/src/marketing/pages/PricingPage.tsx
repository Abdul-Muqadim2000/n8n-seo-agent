import { Section, SectionHeading } from '../components';
import { useSeo } from '../useSeo';

// Stub — filled in by the page agents. Uses the marketing layout (header + footer) from the router.
export default function PricingPage() {
  useSeo({ title: 'Pricing', description: 'Ascentra plans for one website to a whole portfolio. Every run shows its cost before it starts.', path: '/pricing' });
  return (
    <Section tone="page" spacing="lg">
      <SectionHeading as="h1" size="lg" eyebrow="Pricing" title="Plans that grow with your portfolio." lead="Start free. Every run shows its cost before it starts, and budgets keep spend where you set it." />
    </Section>
  );
}
