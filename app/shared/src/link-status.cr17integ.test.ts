// CR17 integration (client report 2026-11-17): the seams between package E (link building) and package F (competitor roles), and the
// junk-page rule the recommendations read for a lost link.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DOMAIN_REASON_CODES, JOB_HOST_NAMES, junkLinkSite, linkReasonCode } from './link-status';
import { leftOutWords } from './competitor-roles';

const kit = (f: string) => readFileSync(join(__dirname, '..', '..', '..', 'n8n', 'seo-agent', 'v5', 'code', f), 'utf8');

describe('CR17 integration: link building x competitor roles', () => {
  it("every code the competitor gate returns is a reason code in both tables, and the gate's own words map back to it", () => {
    // OK.competitorCheck(o).code is one of CMP.LEFT_OUT's keys; the Link Builder stores it, and OK.reasonCode / linkReasonCode read its words
    const codes = ['competitor', 'competitor_list', 'listing', 'your_platform', 'software'];
    const comp = kit('_competitors.js');
    for (const c of codes) {
      expect(comp.includes(`    ${c}: '`)).toBe(true);
      expect(leftOutWords(c)).not.toBe('');
      expect(linkReasonCode(leftOutWords(c))).toBe(c);
    }
    // the old competitor sentence with "its own list ranks itself" is the list code, as competitorCheck returns it
    expect(linkReasonCode('a competing site of yours (code-brew.ae): a business AI recommends instead of you, and its own list ranks itself, not you')).toBe('competitor_list');
    expect(linkReasonCode('a competing provider: their own site offers custom AI solutions in UAE')).toBe('competitor');
  });
  it('a competitor (also through its own list) is a website-level verdict; a directory, your platform or a software maker is not', () => {
    expect(DOMAIN_REASON_CODES.has('competitor')).toBe(true);
    expect(DOMAIN_REASON_CODES.has('competitor_list')).toBe(true);
    for (const c of ['listing', 'your_platform', 'software']) expect(DOMAIN_REASON_CODES.has(c)).toBe(false);
    const ok = kit('_outreach_kit.js');
    expect(/const DOMAIN_CODES = new Set\(\[[^\]]*'competitor_list'/.test(ok)).toBe(true);
  });
  it('the Link Builder re-judges a stored ready row with the gate code, not a regex over its words', () => {
    const lb = kit('LB_Assemble.js');
    expect(lb.includes('const cc = OK.competitorCheck(')).toBe(true);
    expect(lb.includes("reason_code: cc.code || OK.reasonCode(why)")).toBe(true);
    // a prospect retired with its AI question is never offered again (2b, digests), nor read for qualification, nor counted open
    expect(lb.includes("x.type !== 'reclaim' && !String(x.retired_at || '').trim()")).toBe(true);
    expect(kit('LB_Page_Requests.js').includes("!String(x.retired_at || '').trim()")).toBe(true);
    expect(kit('LB_Plan.js').includes("!String(p.retired_at || '').trim()")).toBe(true);
    expect(lb.includes("retired_at: '' });")).toBe(true);
  });
});

describe('CR17 integration: a lost link on a junk page is never worth winning back', () => {
  it('job boards, job pages, code hosts, profiles, farms and scrapers are junk; a real article is not', () => {
    expect(junkLinkSite({ domain: 'bebee.com', url: 'https://bebee.com/ae/jobs/machine-learning-engineer-devaicon' })).toBe('a job listing');
    expect(junkLinkSite({ domain: 'example-jobs.ae', url: 'https://example-jobs.ae/jobs/x', title: '25 AI jobs in Dubai' })).toBe('a job listing');
    expect(junkLinkSite({ domain: 'linkedin.com', url: 'https://www.linkedin.com/jobs/view/123' })).toBe('a job listing');
    expect(junkLinkSite({ domain: 'github.com', url: 'https://github.com/someone' })).toBe('a code host');
    expect(junkLinkSite({ domain: 'linkedin.com', url: 'https://www.linkedin.com/in/someone/' })).toBe('a profile');
    expect(junkLinkSite({ domain: 'medium.com', url: 'https://medium.com/@someone' })).toBe('a profile');
    expect(junkLinkSite({ domain: 'farm.example', linkType: 'spam' })).not.toBe('');
    expect(junkLinkSite({ domain: 'stats.example', linkType: 'scraper' })).not.toBe('');
    expect(junkLinkSite({ domain: 'x.example', spam: 45 })).not.toBe('');
    expect(junkLinkSite({ domain: 'peppol.org', url: 'https://peppol.org/members/providers/', title: 'Peppol service providers' })).toBe('');
    expect(junkLinkSite({ domain: 'medium.com', url: 'https://medium.com/some-pub/an-article-123' })).toBe('');
  });
  it("the job-board host list is the engine's (LK in v5/code/_link_kit.js), name for name", () => {
    // CR17 CodeQL (PR #71): the app reads the list label by label (JOB_HOST_NAMES, isJobHost) instead of a copy of the engine's pattern,
    // which backtracked on a crafted host; so the names are compared here, and linear-text.test.ts checks every answer against the pattern
    const names = (kit('_link_kit.js').match(/const JOB_HOST = \/\(\^\|\\\.\)\(([a-z|]+)\)/) ?? [])[1] ?? '';
    expect(names.length).toBeGreaterThan(50);
    expect(new Set(names.split('|'))).toEqual(new Set(JOB_HOST_NAMES));
  });
});
