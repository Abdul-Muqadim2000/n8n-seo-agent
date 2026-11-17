import { jsonLdText } from './schema';

/** A JSON-LD data block (allowed by the CSP: `type="application/ld+json"` is data, not a script). */
export function JsonLd({ data }: { data: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdText(data) }} />;
}
