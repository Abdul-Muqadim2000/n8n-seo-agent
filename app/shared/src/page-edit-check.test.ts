import { describe, expect, it } from 'vitest';
import { editCheckOf, pageWords, pointKind, quoteOnPage, quotedProblemsOf, withoutByline, type CheckAnswer } from './page-review';

// Prod 2026-11-03 (devaicon.com): the client removed the problem the review box showed, saved, and the check of their version answered
// "not ready" with points the box never showed (the page's own byline and sentences from the client's website read as unsupported claims,
// because the free check has the business facts only). Four saves, four "not ready". Fixtures are anonymised, shaped like those reports.

const BYLINE = '*Written by [Northwind](https://northwind.example/about), User · Updated 2 November 2026 · Reviewed by Sara Khan*';
const QUOTE = 'Regional banks tend to report four symptoms:';
const delivered = {
  markdown: `# Banking technology\n\n${BYLINE}\n\nIntro.\n\n## Symptoms\n\n${QUOTE}\n\n- slow onboarding\n- manual reports\n`,
  qa_blocking: [
    { code: 'review', text: `A second read of the page found a problem at "${QUOTE}": This presents an observed pattern with no source.`, action: 'correct or remove the words the second read quoted' },
    { code: 'duplicate_page', text: 'This website already has a page for the same search: https://northwind.example/banking.' },
  ],
  qa_second_read: { mode: 'enforce', gates: [{ kind: 'claim', location: QUOTE, issue: 'no source', fix: 'drop it' }] },
};
const claims = (n: number) => `${n} statement(s) about Northwind's services, process or terms that nothing on file supports (business facts, author profile, case studies, its own pages): "We deliver end-to-end development."; "We build modern desktop applications."`;
const answer = (reasons: string[], extra: Record<string, unknown> = {}): CheckAnswer => ({ ran: true, json: { publishable: reasons.length === 0, label: 'did not pass the quality check', reasons, advice: [], warnings: [], ...extra } });
const editedMd = delivered.markdown.replace(QUOTE, 'Common symptoms include:');

describe('what a save of the client\'s version answers', () => {
  it('the byline never reaches the check', () => {
    const out = withoutByline(delivered.markdown);
    expect(out).not.toContain('Written by');
    expect(out).toContain('# Banking technology');
    expect(withoutByline('*By [Sara](https://x.example), Editor · Updated 1 May 2026*\n\nText')).toBe('\n\nText');
    expect(withoutByline('*Written by hand, as always*')).toBe('*Written by hand, as always*');   // no "Updated": not the byline
  });

  it('finds the second read\'s quoted words on the page, through links, marks and curly quotes', () => {
    const [p] = quotedProblemsOf(delivered);
    expect(p?.quote).toBe(QUOTE);
    expect(quotedProblemsOf(delivered)).toHaveLength(1);   // the duplicate-page decision is not text on the page
    expect(quoteOnPage('**Regional banks** tend to report [four](https://x.example) symptoms:', QUOTE)).toBe(true);
    expect(quoteOnPage('Regional banks tend to report four symptoms…', 'Regional banks tend to report four symptoms...')).toBe(true);
    expect(quoteOnPage(editedMd, QUOTE)).toBe(false);
    expect(pageWords('A “quote”')).toBe('a "quote"');
  });

  it('a quote shown only in the item text is still re-read', () => {
    const p = quotedProblemsOf({ qa_blocking: [{ code: 'review', text: `A second read of the page found a problem at "${QUOTE}": reason.` }] });
    expect(p[0]?.quote).toBe(QUOTE);
  });

  it('kinds ignore quoted words and numbers; a leading count is kept', () => {
    expect(pointKind(claims(7)).kind).toBe(pointKind(claims(4)).kind);
    expect(pointKind(claims(7)).count).toBe(7);
    expect(pointKind('Primary keyword used only 1 time(s)').count).toBeNull();
    expect(pointKind('Answer first: the Quick answer comes after 122 words').kind).toBe('answer first');
  });

  it('devaicon\'s case: the flagged sentence removed, the rest as delivered: fixed, ready, the delivered points as advice', () => {
    const c = editCheckOf({ md: editedMd, edited: answer([claims(6), 'Primary keyword missing from H1']), delivered: answer([claims(7), 'Primary keyword missing from H1']), box: quotedProblemsOf(delivered), openCount: 0, at: 't' });
    expect(c.status).toBe('ready');
    expect(c.blocking).toEqual([]);
    expect(c.fixed).toEqual([{ code: 'review', text: `"${QUOTE}"` }]);
    expect(c.advisory.map((a) => a.text).every((t) => t.startsWith('Also in the version we delivered: '))).toBe(true);
    expect(c.note).toBe('');
  });

  it('a point the engine lists as a reason and again as a warning is shown once', () => {
    const c = editCheckOf({ md: editedMd, edited: answer(['Primary keyword missing from H1'], { warnings: ['Primary keyword missing from H1', 'Add an image alt text', 'Add an image alt text'] }), delivered: answer(['Primary keyword missing from H1']), box: [], openCount: 0, at: 't' });
    expect(c.advisory.map((a) => a.text)).toEqual(['Also in the version we delivered: Primary keyword missing from H1', 'Add an image alt text']);
  });

  it('the flagged sentence left on the page still blocks, and says so', () => {
    const c = editCheckOf({ md: delivered.markdown, edited: answer([claims(7)]), delivered: answer([claims(7)]), box: quotedProblemsOf(delivered), openCount: 2, at: 't' });
    expect(c.status).toBe('not_ready');
    expect(c.blocking[0]?.text).toMatch(/^Still on the page: A second read/);
    expect(c.fixed).toEqual([]);
  });

  it('a problem the edit added blocks: a new kind of point, or more of the same kind', () => {
    const newKind = editCheckOf({ md: editedMd, edited: answer(['2 placeholder(s) left in the page: "[Price]"']), delivered: answer([]), box: quotedProblemsOf(delivered), openCount: 0, at: 't' });
    expect(newKind.status).toBe('not_ready');
    expect(newKind.blocking[0]).toMatchObject({ code: 'edit' });
    const more = editCheckOf({ md: editedMd, edited: answer([claims(9)]), delivered: answer([claims(7)]), box: quotedProblemsOf(delivered), openCount: 0, at: 't' });
    expect(more.status).toBe('not_ready');
  });

  it('when the delivered version could not be checked, every point blocks as before and the note says why', () => {
    for (const d of [null, { ran: false } as CheckAnswer]) {
      const c = editCheckOf({ md: editedMd, edited: answer([claims(6)]), delivered: d, box: quotedProblemsOf(delivered), openCount: 0, at: 't' });
      expect(c.status).toBe('not_ready');
      expect(c.note).toMatch(/could not compare/);
      expect(c.fixed).toHaveLength(1);
    }
    const label = editCheckOf({ md: editedMd, edited: answer([], { publishable: false }), delivered: null, box: [], openCount: 0, at: 't' });
    expect(label.blocking[0]?.text).toBe('did not pass the quality check');
  });

  it('a check that did not run is unknown, never ready', () => {
    const c = editCheckOf({ md: editedMd, edited: { ran: false }, delivered: answer([]), box: quotedProblemsOf(delivered), openCount: 0, at: 't' });
    expect(c.status).toBe('unknown');
    expect(c.ran).toBe(false);
  });

  it('customer words carry no dashes, curly quotes or ellipsis characters', () => {
    const c = editCheckOf({ md: delivered.markdown, edited: answer([`${claims(9)} — “x”…`]), delivered: answer([claims(7)]), box: quotedProblemsOf(delivered), openCount: 0, at: 't' });
    for (const t of [...c.blocking, ...c.advisory, ...(c.fixed ?? [])].map((x) => x.text).concat(c.note)) expect(t).not.toMatch(/[—–“”‘’…]/);
  });
});
