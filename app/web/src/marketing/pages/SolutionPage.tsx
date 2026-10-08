import { useParams } from 'react-router';
import { MarketingNotFound, Section, SectionHeading } from '../components';
import { solutionBySlug } from '../content/solutions';
import { useSeo } from '../useSeo';

// Stub — filled in by the page agents. /solutions/:slug renders from the solutions registry; an unknown slug is a 404.
export default function SolutionPage() {
  const { slug } = useParams();
  const solution = solutionBySlug(slug);
  useSeo({ title: solution?.name ?? 'Page not found', description: solution?.summary ?? 'The page you opened does not exist.', path: `/solutions/${slug ?? ''}` });
  if (!solution) return <MarketingNotFound />;
  return (
    <Section tone="page" spacing="lg">
      <SectionHeading as="h1" size="lg" eyebrow={solution.shortName} title={solution.tagline} lead={solution.summary} />
    </Section>
  );
}
