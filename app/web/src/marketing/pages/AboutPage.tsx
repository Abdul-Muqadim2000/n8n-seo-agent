import { Section, SectionHeading } from '../components';
import { useSeo } from '../useSeo';

// Stub — filled in by the page agents. Uses the marketing layout (header + footer) from the router.
export default function AboutPage() {
  useSeo({ title: 'About', description: 'Ascentra is enterprise-grade autonomous SEO: one weekly loop for research, content, audits, AI search visibility and backlinks.', path: '/about' });
  return (
    <Section tone="page" spacing="lg">
      <SectionHeading as="h1" size="lg" eyebrow="About" title="Enterprise-grade autonomous SEO." lead="We build the system that runs SEO as a weekly loop, so teams spend their time on the decisions that need a person." />
    </Section>
  );
}
