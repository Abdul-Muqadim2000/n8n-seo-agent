import { Section, SectionHeading } from '../components';
import { useSeo } from '../useSeo';

// Stub — filled in by the page agents. Uses the marketing layout (header + footer) from the router.
export default function PlatformPage() {
  useSeo({ title: 'Platform', description: 'Ten capabilities that run your SEO as one weekly loop: research, ladders, content, audits, tracking, AI visibility, backlinks, reports and an enterprise platform.', path: '/platform' });
  return (
    <Section tone="page" spacing="lg">
      <SectionHeading as="h1" size="lg" eyebrow="Platform" title="Ten capabilities. One system." lead="Research, content, audits, tracking, AI search visibility and backlinks — each one strong on its own, together one weekly loop." />
    </Section>
  );
}
