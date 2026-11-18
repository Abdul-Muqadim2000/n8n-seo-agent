import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { SITE_ORIGIN } from '@/lib/siteOrigin';
import { changelog } from '@/marketing/content/changelog';
import { features } from '@/marketing/content/features';
import { tutorials } from '@/marketing/content/tutorials';
import { dataLocation, notYet, retention, subprocessors, TRUST_FACTS_AS_OF, VENDOR_DPA } from '@/marketing/content/trust';
import { legalDocs } from '@/marketing/components/company/legal';
import { llmsTxt, robotsTxt, sitemapXml } from '@/marketing/seo/files';
import { featureLastmod, sitePages, STATIC_PATHS } from '@/marketing/seo/paths';

// C2 + M1 + C1 (client report 2026-11-17): sitemap lastmod from real content dates (never the build time), llms.txt in the
// llmstxt.org format from the registries, a dated security.txt on the host that serves it, and dated trust facts.

const today = new Date().toISOString().slice(0, 10);
const daysAgo = (iso: string) => (Date.parse(today) - Date.parse(iso)) / 86_400_000;
const AI_TELLS = /[\u2014\u2013\u2018\u2019\u201C\u201D\u2026]|\.\.\./;

describe('sitemap.xml', () => {
  const pages = sitePages();
  const xml = sitemapXml(pages);

  it('lists every public page once, on the public origin', () => {
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    expect(new Set(locs).size).toBe(locs.length);
    for (const p of STATIC_PATHS) expect(locs).toContain(`${SITE_ORIGIN}${p}`);
    for (const f of features) expect(locs).toContain(`${SITE_ORIGIN}/platform/${f.slug}`);
    for (const t of tutorials) expect(locs).toContain(`${SITE_ORIGIN}/tutorials/${t.slug}`);
    expect(locs.every((l) => l.startsWith(`${SITE_ORIGIN}/`))).toBe(true);
  });

  it('every lastmod is a real date from the content: valid, not in the future, not one build date for every page', () => {
    const dates = pages.map((p) => p.lastmod).filter((d): d is string => !!d);
    expect(dates.length).toBeGreaterThan(features.length);
    for (const d of dates) {
      expect(d).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isNaN(Date.parse(d))).toBe(false);
      expect(d <= today, d).toBe(true);
    }
    expect(new Set(dates).size).toBeGreaterThan(3);
    // pages without a known content date carry no lastmod at all
    expect(pages.find((p) => p.path === '/how-it-works')).toEqual({ path: '/how-it-works' });
    expect(xml).toMatch(/<url><loc>[^<]+\/how-it-works<\/loc><\/url>/);
  });

  it('a capability page dates from the newest release that changed it; a tutorial from its film; legal from its own date', () => {
    for (const f of features) {
      const newest = changelog.filter((e) => e.features.includes(f.slug)).map((e) => e.date).sort().at(-1);
      expect(featureLastmod(f.slug)).toBe(newest);
      expect(pages.find((p) => p.path === `/platform/${f.slug}`)?.lastmod).toBe(newest);
    }
    for (const t of tutorials) expect(pages.find((p) => p.path === `/tutorials/${t.slug}`)?.lastmod).toBe(t.film?.published);
    expect(pages.find((p) => p.path === '/privacy')?.lastmod).toBe(legalDocs['/privacy'].updated);
    expect(pages.find((p) => p.path === '/changelog')?.lastmod).toBe(changelog.map((e) => e.date).sort().at(-1));
    expect(pages.find((p) => p.path === '/security')?.lastmod).toBe(TRUST_FACTS_AS_OF);
  });
});

describe('robots.txt', () => {
  it('keeps the app out and names the sitemap on the public origin', () => {
    const t = robotsTxt();
    for (const p of ['/o/', '/admin', '/login', '/share/', '/api/']) expect(t).toContain(`Disallow: ${p}`);
    expect(t).toContain(`Sitemap: ${SITE_ORIGIN}/sitemap.xml`);
  });
});

describe('llms.txt', () => {
  const t = llmsTxt();
  it('follows the llmstxt.org format: one H1, a summary quote, then H2 sections of links', () => {
    const lines = t.split('\n');
    expect(lines[0]).toBe('# Alaventra');
    expect(lines.filter((l) => l.startsWith('# '))).toHaveLength(1);
    expect(lines[2]).toMatch(/^> \S/);
    expect(lines.filter((l) => l.startsWith('## ')).map((l) => l.slice(3))).toEqual(['Platform', 'Solutions', 'Company', 'Optional']);
    const links = lines.filter((l) => l.startsWith('- '));
    for (const l of links) expect(l).toMatch(/^- \[[^\]]+\]\(https:\/\/[^)\s]+\): \S/);
    expect(links.every((l) => l.includes(`](${SITE_ORIGIN}/`))).toBe(true);
  });
  it('names every capability, the trust pages and every tutorial, in plain text without AI tells', () => {
    for (const f of features) expect(t).toContain(`(${SITE_ORIGIN}/platform/${f.slug})`);
    for (const tu of tutorials) expect(t).toContain(`(${SITE_ORIGIN}/tutorials/${tu.slug})`);
    for (const p of ['/pricing', '/security', '/subprocessors', '/data-retention']) expect(t).toContain(`(${SITE_ORIGIN}${p})`);
    // the summary lines we write (registry text is checked by its own tests)
    const own = t.split('\n').filter((l) => !l.startsWith('- [')).join('\n');
    expect(own).not.toMatch(AI_TELLS);
  });
});

describe('security.txt', () => {
  const txt = readFileSync(fileURLToPath(new URL('../public/.well-known/security.txt', import.meta.url)), 'utf8');
  it('is canonical on the hosts that serve it, points at the security page and expires within a year', () => {
    const canon = [...txt.matchAll(/^Canonical: (.+)$/gm)].map((m) => m[1]);
    expect(canon).toEqual(expect.arrayContaining([`${SITE_ORIGIN}/.well-known/security.txt`, 'https://app.alaventra.com/.well-known/security.txt']));
    expect(txt.split(/\r?\n/)).toContain(`Policy: ${SITE_ORIGIN}/security`);
    expect(txt).toMatch(/^Contact: mailto:\S+@\S+$/m);
    const exp = /^Expires: (\S+)$/m.exec(txt)?.[1] ?? '';
    const days = -daysAgo(exp.slice(0, 10));
    // RFC 9116: less than a year ahead; a month of margin so it is renewed before it lapses
    expect(days).toBeGreaterThan(30);
    expect(days).toBeLessThanOrEqual(366);
  });
});

describe('trust facts (security, subprocessors, data retention)', () => {
  it('are dated, and re-checked at least every 120 days', () => {
    expect(TRUST_FACTS_AS_OF).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(TRUST_FACTS_AS_OF <= today).toBe(true);
    expect(daysAgo(TRUST_FACTS_AS_OF)).toBeLessThanOrEqual(120);
  });
  it('every subprocessor says what it does, which data it gets and where, never a guessed location', () => {
    expect(subprocessors.length).toBeGreaterThan(5);
    for (const s of subprocessors) {
      expect(s.name && s.purpose && s.data && s.location, s.name).toBeTruthy();
      expect(s.location === VENDOR_DPA || s.location.startsWith('Google Cloud region me-central1'), s.name).toBe(true);
    }
    expect(new Set(subprocessors.map((s) => s.name)).size).toBe(subprocessors.length);
  });
  it('every retention row says how long, and no client text has AI tells', () => {
    for (const r of retention) expect(r.kept.length, r.data).toBeGreaterThan(3);
    const all = [...subprocessors.flatMap((s) => [s.name, s.purpose, s.data, s.location]), ...retention.flatMap((r) => [r.data, r.kept]), ...dataLocation, ...notYet];
    for (const line of all) expect(line, line).not.toMatch(AI_TELLS);
  });
  it('the security page says what is not in place yet, and claims no certification', () => {
    expect(notYet.join(' ')).toMatch(/SOC 2/);
    expect(notYet.join(' ')).toMatch(/penetration test/);
    expect(dataLocation.join(' ')).not.toMatch(/certified|compliant|SOC 2|ISO 27001/i);
  });
});
