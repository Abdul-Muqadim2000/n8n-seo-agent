import { Section, SectionHeading } from '../components';
import { useSeo } from '../useSeo';

// Stub — filled in by the page agents. Uses the marketing layout (header + footer) from the router.
export default function HowItWorksPage() {
  useSeo({ title: 'How it works', description: 'How Ascentra runs your SEO as a weekly loop: research, plan, write, publish, track and learn — with your team approving what matters.', path: '/how-it-works' });
  return (
    <Section tone="page" spacing="lg">
      <SectionHeading as="h1" size="lg" eyebrow="How it works" title="Research to results, every week." lead="Connect a website, describe the business, choose the plan — Ascentra runs the loop and asks for the decisions that need a person." />
    </Section>
  );
}
