import { useParams } from 'react-router';
import { FeatureVisual, MarketingNotFound, Section, SectionHeading } from '../components';
import { featureBySlug } from '../content/features';
import { useSeo } from '../useSeo';

// Stub — filled in by the page agents. /platform/:slug renders from the features registry; an unknown slug is a 404.
export default function FeaturePage() {
  const { slug } = useParams();
  const feature = featureBySlug(slug);
  useSeo({ title: feature?.name ?? 'Page not found', description: feature?.summary ?? 'The page you opened does not exist.', path: `/platform/${slug ?? ''}` });
  if (!feature) return <MarketingNotFound />;
  return (
    <Section tone="page" spacing="lg">
      <SectionHeading as="h1" size="lg" eyebrow={feature.shortName} title={feature.tagline} lead={feature.summary} />
      <div className="mt-14">
        <FeatureVisual kind={feature.visual} />
      </div>
    </Section>
  );
}
