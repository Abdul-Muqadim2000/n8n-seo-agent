import { ArrowRight } from 'lucide-react';
import { ButtonLink } from '@/components/ui/button';
import { Section, SectionHeading } from './Section';

/** Fallback for a slug the registry does not know (the router already answers those with a 404; this covers a stale registry). */
export function MarketingNotFound() {
  return (
    <Section tone="page" spacing="lg">
      <SectionHeading as="h1" size="lg" align="center" eyebrow="404" title="Page not found" lead="The page you opened does not exist or was moved.">
        <ButtonLink to="/" size="lg" className="group">
          Back to home
          <ArrowRight className="size-4 transition-transform duration-200 ease-brand group-hover:translate-x-0.5" aria-hidden />
        </ButtonLink>
      </SectionHeading>
    </Section>
  );
}
