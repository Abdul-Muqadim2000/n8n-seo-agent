import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { INDEX_JOB_PARENTS, INDEX_UTILITY_DIRS, INDEX_UTILITY_SEGMENTS, INDEX_UTILITY_TOP_ONLY, isJobPosting, isUtilityPage } from './indexing';

// Index coverage wave 2 (DESIGN_WAVE2 §2.4): the app's list of policy and utility pages is a mirror of the engine's `IX.UTILITY`
// (n8n/seo-agent/v5/code/_index_kit.js). This test reads the engine's kit and holds the two lists identical, and (wave 2 review W3) runs the
// engine's own `IX.isUtility` / `IX.isJobPosting` against the app's over the same addresses. The list case is skipped only on a tree whose kit
// has no `UTILITY`; the rule case only on a kit that still matches a utility word at any depth (the engine's W3 not merged yet: its kit calls
// /industries/legal a utility page). IX_KIT_PATH points the test at another kit.
const KIT = process.env.IX_KIT_PATH || fileURLToPath(new URL('../../../n8n/seo-agent/v5/code/_index_kit.js', import.meta.url));
const src = existsSync(KIT) ? readFileSync(KIT, 'utf8') : '';
const block = src.match(/const UTILITY = \{([\s\S]*?)\};/)?.[1] ?? '';
const list = (key: string) => [...(block.match(new RegExp(`${key}:\\s*\\[([\\s\\S]*?)\\]`))?.[1] ?? '').matchAll(/'([^']+)'/g)].map((m) => m[1]);

type Kit = { isUtility: (u: string) => boolean; isJobPosting: (u: string) => boolean };
const kit: Kit | null = (() => {
  if (!src) return null;
  try {
    const ix = new Function(`${src}\n;return IX;`)() as Partial<Kit>;
    return typeof ix.isUtility === 'function' && typeof ix.isJobPosting === 'function' ? (ix as Kit) : null;
  } catch {
    return null;
  }
})();
const U = (p: string) => `https://novaand-demo.com${p}`;
const kitHasW3 = !!kit && !kit.isUtility(U('/industries/legal'));

/** Addresses both sides must classify the same way (the review's cases and the rule's edges). */
const CORPUS = [
  '/', '/privacy', '/privacy.html', '/Privacy-Policy', '/cookies', '/cookie-policy/', '/terms', '/terms-of-service', '/legal', '/legal/terms',
  '/Legal/Terms.php', '/legal/privacy/eu', '/policies', '/policies/refund', '/policies/cookies', '/policies/shipping.html', '/imprint', '/impressum', '/accessibility',
  '/sitemap', '/login', '/sign-in', '/account/orders', '/cart', '/checkout/step-2', '/search?q=x', '/thank-you', '/thanks', '/security',
  '/security/', '/security.html', '/security/report', '/services/security', '/industries/legal', '/features/search', '/solutions/accessibility',
  '/services/legal/contracts', '/blog/thanks', '/en/privacy', '/en/cookie-policy', '/privacy-matters', '/careers', '/careers/data-engineer',
  '/jobs/1', '/jobs', '/about', '/insights/value-driven-innovation-automation',
];

describe('the utility list is the engine\'s IX.UTILITY', () => {
  it.skipIf(!block)('same segments, same top-level-only segments, same job directories', () => {
    expect([...INDEX_UTILITY_SEGMENTS]).toEqual(list('segments'));
    expect([...INDEX_UTILITY_TOP_ONLY]).toEqual(list('top_level_only'));
    expect([...INDEX_JOB_PARENTS]).toEqual(list('job_dirs'));
    // wave 2 review W3: the engine's `dirs` (absent from a kit before its W3)
    if (/\bdirs:/.test(block.replace(/job_dirs/g, ''))) expect([...INDEX_UTILITY_DIRS]).toEqual(list('(?<!job_)dirs'));
  });
  it.skipIf(!kitHasW3)('the engine\'s isUtility / isJobPosting answer the same for every address', () => {
    for (const p of CORPUS) {
      expect(isUtilityPage(U(p)), `isUtility ${p}`).toBe(kit!.isUtility(U(p)));
      expect(isJobPosting(U(p)), `isJobPosting ${p}`).toBe(kit!.isJobPosting(U(p)));
    }
  });
  it('W3: the first path segment only (or /legal, /policies and under them), security only as the whole path; any case, a page extension dropped', () => {
    for (const p of ['/privacy.html', '/Legal/Terms.php', '/legal/privacy/eu', '/policies', '/policies/refund', '/policies/cookies', '/cookie-policy/', '/checkout/step-2', '/security', '/security.html'])
      expect(isUtilityPage(U(p)), p).toBe(true);
    // a utility word deeper down is the subject of a content page (wave 2 review W3)
    for (const p of ['/industries/legal', '/features/search', '/solutions/accessibility', '/services/legal/contracts', '/blog/thanks', '/en/cookie-policy', '/services/security', '/security/report', '/privacy-matters', '/'])
      expect(isUtilityPage(U(p)), p).toBe(false);
    expect(isJobPosting(U('/careers/data-engineer'))).toBe(true);
    expect(isUtilityPage(U('/careers/data-engineer'))).toBe(false);
  });
});
