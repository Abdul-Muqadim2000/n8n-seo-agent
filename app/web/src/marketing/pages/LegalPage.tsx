import { useLocation } from 'react-router';
import { Section, SectionHeading } from '../components';
import { useSeo } from '../useSeo';

const DOCS = {
  '/privacy': { title: 'Privacy policy', description: 'How Ascentra collects, uses and protects personal data.' },
  '/terms': { title: 'Terms of service', description: 'The terms that govern the use of Ascentra.' },
} as const;

// Stub — filled in by the page agents. Serves both /privacy and /terms (chosen by the path).
export default function LegalPage() {
  const { pathname } = useLocation();
  const path = pathname === '/terms' ? '/terms' : '/privacy';
  const doc = DOCS[path];
  useSeo({ title: doc.title, description: doc.description, path });
  return (
    <Section tone="page" spacing="lg" size="md">
      <SectionHeading as="h1" size="lg" eyebrow="Legal" title={doc.title} lead={doc.description} />
    </Section>
  );
}
