// Site-wide structured data (schema.org JSON-LD). Facts only: no ratings, reviews or prices (plan prices are still placeholders, so
// SoftwareApplication carries no `offers` until the owner confirms them), no sameAs profiles that do not exist, no contact point while
// the public addresses have no mail server.
import { absoluteUrl, SITE_ORIGIN } from '@/lib/siteOrigin';
import { site } from '../content/site';

const ORG_ID = `${SITE_ORIGIN}/#organization`;
const SITE_ID = `${SITE_ORIGIN}/#website`;
const DESCRIPTION =
  'One platform for SEO, AEO and GEO: keyword research, written pages, technical audits, index coverage, AI search visibility and backlinks, so you rank on Google and get named in AI answers.';

/** Organization + WebSite: in the <head> of every prerendered page */
export function siteJsonLd(): object[] {
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      '@id': ORG_ID,
      name: site.name,
      url: absoluteUrl('/'),
      logo: { '@type': 'ImageObject', url: absoluteUrl('/android-chrome-512x512.png'), width: 512, height: 512 },
      slogan: site.descriptor,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      '@id': SITE_ID,
      name: site.name,
      url: absoluteUrl('/'),
      description: DESCRIPTION,
      inLanguage: 'en',
      publisher: { '@id': ORG_ID },
    },
  ];
}

/** SoftwareApplication for the home and pricing pages, WITHOUT offers (prices are placeholders: owner decision before adding them) */
export function softwareApplicationJsonLd(): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: site.name,
    url: absoluteUrl('/'),
    description: DESCRIPTION,
    applicationCategory: 'BusinessApplication',
    applicationSubCategory: 'SEO software',
    operatingSystem: 'Web',
    publisher: { '@id': ORG_ID },
  };
}

/** A JSON-LD block's text, safe inside a <script> element (no "</script>" can close it early) */
export const jsonLdText = (data: unknown): string => JSON.stringify(data).replace(/</g, '\\u003c');
