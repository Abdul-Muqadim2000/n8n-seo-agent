import { Section, SectionHeading } from '../components';
import { useSeo } from '../useSeo';

// Stub — filled in by the page agents. Uses the marketing layout (header + footer) from the router.
export default function SolutionsPage() {
  useSeo({ title: 'Solutions', description: 'Ascentra for agencies, in-house marketing teams, B2B and SaaS companies, and local and multi-location businesses.', path: '/solutions' });
  return (
    <Section tone="page" spacing="lg">
      <SectionHeading as="h1" size="lg" eyebrow="Solutions" title="Built for the teams that own organic growth." lead="Agencies, in-house marketing teams, B2B and SaaS companies, and businesses with many locations." />
    </Section>
  );
}
