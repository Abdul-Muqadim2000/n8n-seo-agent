import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { INDEX_JOB_PARENTS, INDEX_UTILITY_SEGMENTS, INDEX_UTILITY_TOP_ONLY, isJobPosting, isUtilityPage } from './indexing';

// Index coverage wave 2 (DESIGN_WAVE2 §2.4): the app's list of policy and utility pages is a mirror of the engine's `IX.UTILITY`
// (n8n/seo-agent/v5/code/_index_kit.js). This test reads the engine's kit and holds the two lists identical. It is skipped only on a tree
// whose engine kit has no `UTILITY` yet (the app branch before the engine's wave 2 is merged); IX_KIT_PATH points it at another kit.
const KIT = process.env.IX_KIT_PATH || fileURLToPath(new URL('../../../n8n/seo-agent/v5/code/_index_kit.js', import.meta.url));
const src = existsSync(KIT) ? readFileSync(KIT, 'utf8') : '';
const block = src.match(/const UTILITY = \{([\s\S]*?)\};/)?.[1] ?? '';
const list = (key: string) => [...(block.match(new RegExp(`${key}:\\s*\\[([\\s\\S]*?)\\]`))?.[1] ?? '').matchAll(/'([^']+)'/g)].map((m) => m[1]);

describe('the utility list is the engine\'s IX.UTILITY', () => {
  it.skipIf(!block)('same segments, same top-level-only segments, same job directories', () => {
    expect([...INDEX_UTILITY_SEGMENTS]).toEqual(list('segments'));
    expect([...INDEX_UTILITY_TOP_ONLY]).toEqual(list('top_level_only'));
    expect([...INDEX_JOB_PARENTS]).toEqual(list('job_dirs'));
  });
  it('the same matching rule as the engine (whole segment, any case, any depth, a page extension dropped)', () => {
    const U = (p: string) => `https://novaand-demo.com${p}`;
    for (const p of ['/privacy.html', '/Legal/Terms.php', '/en/cookie-policy', '/security']) expect(isUtilityPage(U(p)), p).toBe(true);
    for (const p of ['/services/security', '/privacy-matters', '/']) expect(isUtilityPage(U(p)), p).toBe(false);
    expect(isJobPosting(U('/careers/data-engineer'))).toBe(true);
    expect(isUtilityPage(U('/careers/data-engineer'))).toBe(false);
  });
});
