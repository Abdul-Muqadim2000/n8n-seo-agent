// CR17-E (client report 2026-11-17, devaicon.com F9 + C4): the one link-building status model, on the production rows of 2026-11-17
// (seo_link_outreach / seo_link_prospects ids in the comments; a person's profile name is replaced by a placeholder).
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { anchorDisplay, linkReasonCode, linkStates, linkStatusCounts, prospectLinkState, type LinkStatusOutreach, type LinkStatusProspect, type LinkStatusSequence } from './link-status';

const steps = JSON.stringify([{ step: 0, subject: 'A resource for your Open edX readers', body: 'Hello, your comparison of Moodle and Open edX ...' }]);
const O = (o: Partial<LinkStatusOutreach> & { prospect_domain: string; type: string; status: string }): LinkStatusOutreach => ({ fit_reason: '', sequence_json: '', ...o });
const P = (p: Partial<LinkStatusProspect> & { prospect_domain: string; type: string; status: string }): LinkStatusProspect => ({ contacted_at: '', won_at: '', verified_at: '', ...p });

// devaicon.com as the client saw it on 2026-11-17 (before the engine fix)
const before = {
  outreach: [
    O({ prospect_domain: 'abstract-technology.de', type: 'ai_source', status: 'drafted', sequence_json: steps }),   // 292: "Ready to send"
    O({ prospect_domain: 'abstract-technology.de', type: 'resource', status: 'not_fit', fit_reason: 'a competing provider: their page sells what you sell (50% of your service words, topic match 100%, "book a consultation", "free trial")' }),   // 239
    O({ prospect_domain: 'bebee.com', type: 'mention', status: 'drafted', sequence_json: steps }),   // 238
    O({ prospect_domain: 'bebee.com', type: 'ai_source', status: 'not_fit', fit_reason: 'their page no longer carries a link to you' }),   // 302
    O({ prospect_domain: 'u.ae', type: 'ai_source', status: 'needs_contact' }),   // 319
    O({ prospect_domain: 'linkedin.com', type: 'ai_source', status: 'not_fit', fit_reason: 'a competing site of yours (linkedin.com): a site that outranks you for one of your own keywords (#3 for "open edx provider")' }),   // 325
    O({ prospect_domain: 'openpraxis.org', type: 'resource', status: 'needs_contact' }),   // 241
    O({ prospect_domain: 'example-blog.com', type: 'resource', status: 'needs_edit', sequence_json: steps }),
  ],
  prospects: [
    P({ prospect_domain: 'bebee.com', type: 'mention', status: 'won', won_at: '2026-11-06T01:08:08.812Z' }),   // 206: no contact, no check
    P({ prospect_domain: 'bebee.com', type: 'ai_source', status: 'won', won_at: '2026-11-06T01:08:08.812Z' }),   // 248
    P({ prospect_domain: 'github.com', type: 'ai_source', status: 'won', won_at: '2026-11-06T01:08:08.812Z', verified_at: '2026-11-06T01:08:08.812Z' }),   // 242: a developer profile, nobody written to
    P({ prospect_domain: 'for9a.com', type: 'ai_source', status: 'new' }),
  ],
  sequences: [] as LinkStatusSequence[],
};
// the same website after the engine's next run (section 195): bebee a job board, u.ae a government portal, linkedin a platform,
// the github / bebee "wins" taken off won
const after = {
  outreach: [
    ...before.outreach.filter((o) => !['bebee.com', 'u.ae', 'linkedin.com'].includes(o.prospect_domain)),
    O({ prospect_domain: 'bebee.com', type: 'mention', status: 'not_fit', fit_reason: 'a job board (bebee.com): its pages are job listings, nobody there adds a link', reason_code: 'job_board' }),
    O({ prospect_domain: 'bebee.com', type: 'ai_source', status: 'not_fit', fit_reason: 'a job board (bebee.com): its pages are job listings, nobody there adds a link', reason_code: 'job_board' }),
    O({ prospect_domain: 'u.ae', type: 'ai_source', status: 'not_fit', fit_reason: 'government site: you get on its lists by applying or being accredited, not by a pitch (see the listings checklist)', reason_code: 'government' }),
    O({ prospect_domain: 'linkedin.com', type: 'ai_source', status: 'not_fit', fit_reason: 'a platform page (linkedin.com): a post there belongs to whoever wrote it, nobody edits it for a pitch', reason_code: 'platform' }),
  ],
  prospects: [
    P({ prospect_domain: 'bebee.com', type: 'mention', status: 'new' }),
    P({ prospect_domain: 'bebee.com', type: 'ai_source', status: 'new' }),
    P({ prospect_domain: 'github.com', type: 'ai_source', status: 'low_value' }),
    P({ prospect_domain: 'for9a.com', type: 'ai_source', status: 'new' }),
  ],
  sequences: [] as LinkStatusSequence[],
};
const stateOf = (rows: ReturnType<typeof linkStates>, d: string, t: string) => rows.find((r) => r.prospectDomain === d && r.type === t);

describe('CR17-E link status (F9 / C4)', () => {
  it('a website-level verdict leaves every row of that website out: abstract-technology.de is never both pitched and left out', () => {
    const rows = linkStates(before);
    expect(stateOf(rows, 'abstract-technology.de', 'ai_source')?.state).toBe('left_out');
    expect(stateOf(rows, 'abstract-technology.de', 'ai_source')?.reasonCode).toBe('competitor');
    expect(stateOf(rows, 'abstract-technology.de', 'resource')?.state).toBe('left_out');
  });
  it('a page-level verdict next to a live pitch of the same website is not listed (the queue and the left-out list never share a website)', () => {
    const rows = linkStates(before);
    expect(stateOf(rows, 'bebee.com', 'mention')?.state).toBe('to_review');
    expect(stateOf(rows, 'bebee.com', 'ai_source')?.hidden).toBe(true);
    const listed = rows.filter((r) => !r.hidden);
    const queue = new Set(listed.filter((r) => ['needs_contact', 'to_write', 'needs_edit', 'to_review', 'no_page'].includes(r.state)).map((r) => r.site));
    const out = new Set(listed.filter((r) => r.state === 'left_out').map((r) => r.site));
    expect([...queue].filter((x) => out.has(x))).toEqual([]);
  });
  it('a "won" nobody wrote to is never a won link: 0 won this month (the client saw 3)', () => {
    const c = linkStatusCounts(before, { month: '2026-11' });
    expect(c.won).toBe(0);
    expect(c.wonThisMonth).toBe(0);
    expect(c.alreadyLinks).toBe(1);   // github.com: a link that was there anyway, counted apart
    expect(stateOf(linkStates(before), 'github.com', 'ai_source')?.state).toBe('already_links');
  });
  it('every screen reads the same numbers: before the engine run 1 pitch to review (bebee), after it 0', () => {
    const b = linkStatusCounts(before);
    expect(b.toReview).toBe(1);
    expect(b.needsEdit).toBe(1);
    expect(b.waitingForYou).toBe(2);
    const a = linkStatusCounts(after);
    expect(a.toReview).toBe(0);
    expect(a.won).toBe(0);
    expect(a.lowValue).toBe(1);
    expect(a.leftOut).toBe(4);   // abstract-technology.de, bebee.com, u.ae, linkedin.com: one per website
    expect(a.needsContact).toBe(1);   // openpraxis.org
    expect(a.found).toBe(1);   // for9a.com, not qualified yet
  });
  it('won = contacted + our own check; a claim is not a win', () => {
    const seq = (o: Partial<LinkStatusSequence>): LinkStatusSequence => ({ prospectDomain: 'blog.example.org', type: 'resource', status: 'active', startedAt: '2026-11-02T09:00:00Z', approvedAt: '2026-11-01T09:00:00Z', replyAt: null, replyClass: null, wonAt: null, ...o });
    const base = { outreach: [O({ prospect_domain: 'blog.example.org', type: 'resource', status: 'drafted', sequence_json: steps })] };
    expect(linkStates({ ...base, sequences: [seq({})] })[0]?.state).toBe('sent');
    // they said it is live (a claim): replied, not won
    expect(linkStates({ ...base, sequences: [seq({ status: 'replied', replyAt: '2026-11-05T09:00:00Z', replyClass: 'says_linked' })], prospects: [P({ prospect_domain: 'blog.example.org', type: 'resource', status: 'replied', contacted_at: '2026-11-02T09:00:00Z' })] })[0]?.state).toBe('replied');
    // the engine's check found it (prospect won + verified, we wrote to them): won, this month
    const won = { ...base, sequences: [seq({ status: 'replied', replyAt: '2026-11-05T09:00:00Z', replyClass: 'says_linked' })], prospects: [P({ prospect_domain: 'blog.example.org', type: 'resource', status: 'won', contacted_at: '2026-11-02T09:00:00Z', verified_at: '2026-11-10T09:00:00Z', won_at: '2026-11-10T09:00:00Z' })] };
    expect(linkStates(won)[0]?.state).toBe('won');
    expect(linkStatusCounts(won, { month: '2026-11' }).wonThisMonth).toBe(1);
    expect(linkStatusCounts(won, { month: '2026-12' }).wonThisMonth).toBe(0);
    // "I sent it myself": contacted_at only, no app sequence
    expect(linkStates({ ...base, prospects: [P({ prospect_domain: 'blog.example.org', type: 'resource', status: 'contacted', contacted_at: '2026-11-02T09:00:00Z' })] })[0]?.state).toBe('sent');
    // the link went away twice running
    expect(linkStates({ ...base, prospects: [P({ prospect_domain: 'blog.example.org', type: 'resource', status: 'lost', contacted_at: '2026-11-02T09:00:00Z' })] })[0]?.state).toBe('lost');
  });
  it('a drafted row without a written sequence is still to write; a held pitch waits for a page; a redirect is never a pitch', () => {
    const rows = linkStates({ outreach: [O({ prospect_domain: 'a.example', type: 'resource', status: 'drafted' }), O({ prospect_domain: 'b.example', type: 'ai_source', status: 'held', fit_reason: 'no page of yours covers their topic ("Moodle vs Open edX"): publish one first, then this pitch can go out' }), O({ prospect_domain: 'devaicon.com/old', type: 'redirect', status: 'fix' })] });
    expect(rows.map((r) => r.state).sort()).toEqual(['no_page', 'to_write']);
    expect(rows.find((r) => r.state === 'no_page')?.reasonCode).toBe('no_matching_page');
  });
  it('prospectLinkState (AI growth list, Backlinks board)', () => {
    expect(prospectLinkState(P({ prospect_domain: 'bebee.com', type: 'mention', status: 'won' }))).toBe('found');
    expect(prospectLinkState(P({ prospect_domain: 'x.example', type: 'gap', status: 'won', verified_at: '2026-11-01', contacted_at: '2026-10-20' }))).toBe('won');
    expect(prospectLinkState(P({ prospect_domain: 'x.example', type: 'gap', status: 'linked' }))).toBe('already_links');
  });
  it('the reason codes are the engine table (v5/code/_outreach_kit.js OK.reasonCode), word for word', () => {
    expect(linkReasonCode('government site: you get on its lists by applying')).toBe('government');
    expect(linkReasonCode('a platform page (linkedin.com): a post there belongs to whoever wrote it')).toBe('platform');
    expect(linkReasonCode('a job board (bebee.com): its pages are job listings')).toBe('job_board');
    expect(linkReasonCode('the same website is left out: a competing provider: their own site ...')).toBe('competitor');
    expect(linkReasonCode('topic match 26%')).toBe('other');
    const kit = readFileSync(join(__dirname, '..', '..', '..', 'n8n', 'seo-agent', 'v5', 'code', '_outreach_kit.js'), 'utf8');
    const engine = (kit.match(/const REASON_CODES = \[([\s\S]*?)\n {2}\];/) || [])[1] ?? '';
    const app = (readFileSync(join(__dirname, 'link-status.ts'), 'utf8').match(/const REASON_CODES: \[string, RegExp\]\[\] = \[([\s\S]*?)\n\];/) || [])[1] ?? '';
    const pairs = (t: string) => [...t.matchAll(/\['([a-z_]+)', (\/.*?\/i)\]/g)].map((m) => m[1] + ' ' + m[2]);
    expect(pairs(engine).length).toBeGreaterThan(10);
    expect(pairs(app)).toEqual(pairs(engine));
  });
  it('the link text is the text itself, never a kind label ("Your brand name")', () => {
    expect(anchorDisplay({ anchorText: 'Open edX Services', anchorHint: 'title' }, 'Devaicon', 'devaicon.com')).toEqual({ text: 'Open edX Services', kind: 'title', kindLabel: "your page's title" });
    expect(anchorDisplay({ anchorText: '', anchorHint: 'brand' }, 'Devaicon', 'devaicon.com').text).toBe('Devaicon');
    expect(anchorDisplay({ anchorText: '', anchorHint: 'title', targetUrl: 'https://devaicon.com/x' }, 'Devaicon', 'devaicon.com').text).toBe('Devaicon');
    expect(anchorDisplay({ anchorText: '', anchorHint: 'brand', targetUrl: 'https://www.devaicon.com/' }, '', 'devaicon.com')).toMatchObject({ text: 'devaicon.com', kind: 'url' });
    const src = readFileSync(join(__dirname, 'link-status.ts'), 'utf8') + readFileSync(join(__dirname, '..', '..', 'web', 'src', 'pages', 'site', '_components', 'links', 'common.tsx'), 'utf8');
    expect(src.includes("'Your brand name'")).toBe(false);
  });
});
