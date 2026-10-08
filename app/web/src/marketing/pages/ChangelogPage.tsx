import { Section, SectionHeading } from '../components';
import { useSeo } from '../useSeo';

// Stub — filled in by the page agents. Uses the marketing layout (header + footer) from the router.
export default function ChangelogPage() {
  useSeo({ title: 'Changelog', description: 'What is new in Ascentra: every release in plain language.', path: '/changelog' });
  return (
    <Section tone="page" spacing="lg">
      <SectionHeading as="h1" size="lg" eyebrow="Changelog" title="What’s new in Ascentra." lead="Every release, in plain language." />
    </Section>
  );
}
