import { describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { deliveryOf, type PageReviewView, type ReviewStage } from '@seo/shared';
import { GuideProvider } from '@/components/guide';
import { TooltipProvider } from '@/components/ui/overlay';
import { ReviewBody } from '@/components/reports/review/ReviewPanels';
import { Compare } from '@/components/reports/review/PageEditor';
import {
  answeredCount,
  blocksToMarkdown,
  choicesFor,
  contextLines,
  currentChoice,
  diffCounts,
  editableBlocks,
  groupQuestions,
  historyPush,
  historyStart,
  historyUndo,
  moveBlock,
  setHeadingLevel,
} from '@/components/reports/review/model';
import { ReviewLine } from '@/pages/site/_components/review-status';
import { factRows } from '@/components/site/StoredFacts';
import { makeCan, OrgContext } from '@/lib/context';
import { ThemeProvider } from '@/lib/theme';
import type { Me, Org } from '@seo/shared';
import { renderReport, report, text } from './renderReport';

// H3 (2026-10-28): the review of a written page on the web: the delivered status in plain words, the ranked questions (top three first,
// stored facts never asked), the final version, the approval, the editor's helpers and the content board line. Fixtures are anonymised.

vi.mock('@/components/reports/article', async (orig) => ({ ...(await orig<typeof import('@/components/reports/article')>()), ArticleViewer: () => null }));

const q = (id: string, rank: number, extra: Partial<PageReviewView['questions'][number]> = {}): PageReviewView['questions'][number] => ({
  id,
  rank,
  impact: 0.9 - rank / 100,
  kind: 'process',
  category: 'service',
  fact_key: `service.${id}`,
  source: 'claim',
  question: `Is this true for Nova&? Statement ${rank}`,
  why: 'Nothing on file says it, so the page does not claim it.',
  original: `Nova& runs a workshop before every project (${rank}).`,
  neutral: rank === 2 ? '' : `A workshop before a project helps (${rank}).`,
  in_page: rank === 2 ? 'left_out' : 'neutral',
  section: 'How a project starts',
  answer_type: 'choice',
  prefill: rank === 1 ? 'We start every project with a discovery workshop.' : '',
  prefill_source: rank === 1 ? 'https://www.novaand-demo.com/whatwedo' : '',
  use_for_future_pages: true,
  stored: null,
  ...extra,
});

const baseView = (over: Partial<PageReviewView> = {}): PageReviewView => {
  const questions = [q('q1', 1), q('q2', 2), q('q3', 3), q('q4', 4, { prefill: 'We run a workshop with every new client.', prefill_source: 'your business facts' }), q('q5', 5, { source: 'brief', answer_type: 'text', question: 'Is there a client result you are happy to publish?', original: '', neutral: '', in_page: 'left_out' }), q('q6', 6, { stored: { decision: 'yes', text: 'Offices in Ajman.', question: 'Where are your offices?', category: 'detail', at: '2026-10-20T00:00:00Z', by: null, reportId: null } })];
  return {
    reportId: 'rep-1',
    siteId: 'site-1',
    keyword: 'erp software uae',
    delivery: deliveryOf({ qa_delivery_status: 'ready_with_questions', qa_client_questions: questions, qa_grade: { score: 91, first_draft_review: 62 } }),
    questions,
    answers: { q1: { questionId: 'q1', factKey: 'service.q1', decision: 'yes', text: '', at: '2026-10-28T00:00:00Z', by: 'u1' } },
    delivered: { markdown: '# ERP software in the UAE\n\nIntro text.\n\n## How a project starts\n\nA workshop before a project helps.\n', title: 'ERP software in the UAE', metaDescription: '', slug: 'erp-software-uae' },
    clientVersion: null,
    finalize: { status: 'none', runId: null, reportId: null, error: null, startedAt: null, quote: { credits: 2, usd: 0.1 }, needed: true, reason: '' },
    approval: null,
    publish: { status: 'not_published', url: null, at: null },
    stage: 'questions',
    isFinal: false,
    finalOf: null,
    ...over,
  };
};

const org = { id: 'org-test', name: 'Test Co', slug: 'test-co', role: 'owner' } as unknown as Org;
const me = { user: { id: 'u1', email: 'owner@example.org', name: 'Owner' }, orgs: [], platformAdmin: false } as unknown as Me;
const render = (el: React.ReactNode, role: 'owner' | 'viewer' = 'owner') =>
  renderToString(
    <ThemeProvider>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, enabled: false } } })}>
        <TooltipProvider>
          <GuideProvider>
            <MemoryRouter>
              <OrgContext.Provider value={{ me, org, role, sites: [], can: makeCan(role) }}>{el}</OrgContext.Provider>
            </MemoryRouter>
          </GuideProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>,
  );
const page = { id: 'rep-1', siteId: 'site-1', siteDomain: 'novaand-demo.com', stage: 'content', status: 'completed', title: 'Page', summary: {}, receivedAt: '2026-10-28T00:00:00Z', scheduled: false, files: [], runId: null, payload: {} } as never;
const NO_TELLS = /[\u2014\u2013\u201C\u201D\u2018\u2019\u2026]/;

describe('review helpers', () => {
  it('groups the open questions: the top three, the optional rest, the stored ones apart', () => {
    const g = groupQuestions(baseView().questions);
    expect(g.top.map((x) => x.id)).toEqual(['q1', 'q2', 'q3']);
    expect(g.optional.map((x) => x.id)).toEqual(['q4', 'q5']);
    expect(g.stored.map((x) => x.id)).toEqual(['q6']);
    expect(answeredCount(baseView())).toEqual({ answered: 1, total: 5 });
    expect(answeredCount(baseView({ answers: { q1: { questionId: 'q1', factKey: 'k', decision: 'skip', text: '', at: '', by: null } } })).answered).toBe(0);
  });

  it('says what the page says now, and offers "Leave it general" on every question', () => {
    expect(contextLines(q('a', 1)).nowLabel).toMatch(/instead for now/);
    expect(contextLines(q('b', 2)).nowLabel).toBe('The page leaves this out for now');
    expect(contextLines(q('c', 3, { in_page: 'cta' })).nowLabel).toMatch(/invitation/);
    expect(choicesFor({ answer_type: 'choice' })).toEqual(['yes', 'edit', 'general', 'remove', 'skip']);
    expect(choicesFor({ answer_type: 'text' })).toEqual(['answer', 'general', 'skip']);
    expect(currentChoice(q('t', 5, { answer_type: 'text', prefill: 'Ten projects' }), undefined)).toEqual({ decision: null, text: 'Ten projects' });
    expect(currentChoice(q('e', 1), { questionId: 'e', factKey: 'k', decision: 'edit', text: 'Mine', at: '', by: null })).toEqual({ decision: 'edit', text: 'Mine' });
  });

  it('editor: blocks round-trip, heading levels, moves, undo, comparison counts', () => {
    const md = '# Title\n\nFirst paragraph\nstill first.\n\n## Section\n\n- a\n- b\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n';
    const blocks = editableBlocks(md);
    expect(blocks.map((b) => b.kind)).toEqual(['heading', 'paragraph', 'heading', 'list', 'table']);
    expect(blocksToMarkdown(blocks)).toBe(md);
    expect(setHeadingLevel('## Section', 3)).toBe('### Section');
    expect(setHeadingLevel('Plain', 9)).toBe('#### Plain');
    expect(moveBlock(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a']);
    expect(moveBlock(['a', 'b'], 0, 5)).toEqual(['a', 'b']);
    let h = historyStart('one');
    h = historyPush(h, 'two');
    h = historyPush(h, 'two');
    expect(h.past).toEqual(['one']);
    expect(historyUndo(h).present).toBe('one');
    expect(diffCounts(md, md.replace('First paragraph', 'Changed paragraph') + '\nNew block.\n')).toMatchObject({ changed: 1, added: 1, removed: 0 });
  });

  it('stored facts are listed newest first', () => {
    const rows = factRows({ a: { decision: 'yes', text: 'A', question: 'qa', category: 'detail', at: '2026-10-01', by: null, reportId: null }, b: { decision: 'general', text: '', question: 'qb', category: 'detail', at: '2026-10-20', by: null, reportId: null } });
    expect(rows.map((r) => r.key)).toEqual(['b', 'a']);
  });
});

describe('review screens', () => {
  it('questions: the top three highlighted, the rest optional, stored facts not asked, suggestions to accept', () => {
    const t = text(render(<ReviewBody view={baseView()} report={page} />));
    expect(t).toContain('Questions only you can answer');
    expect(t).toContain('These 3 matter most');
    expect(t).toContain('Optional: 2 more questions');
    expect(t).toMatch(/Answered in your business details \( ?1 ?\)/);
    expect(t).toMatch(/Accept all suggestions \( ?1 ?\)/);
    expect(t).toContain('Leave it general');
    expect(t).toContain('Your website says');
    expect(t).toContain('Our suggestion');
    expect(t).toContain('1 of 5 answered');
    expect(t).toContain('Make the final version');
    expect(t).toContain('2 credits');
    expect(t).toContain('Approve and publish');
    expect(t).not.toMatch(NO_TELLS);
  });

  it('a viewer sees the questions but cannot answer, approve or start the final version', () => {
    const html = render(<ReviewBody view={baseView()} report={page} />, 'viewer');
    expect(html).toMatch(/<fieldset[^>]*disabled/);
    expect(text(html)).not.toContain('Accept all suggestions');
  });

  it('finalising, done, failed and the final version itself', () => {
    expect(text(render(<ReviewBody view={baseView({ finalize: { ...baseView().finalize, status: 'running' }, stage: 'finalising' })} report={page} />))).toContain('Making the final version');
    const done = text(render(<ReviewBody view={baseView({ finalize: { ...baseView().finalize, status: 'done', reportId: 'rep-2', needed: false } })} report={page} />));
    expect(done).toContain('Open the final version');
    expect(done).toContain('Approve the final version and publish');
    expect(text(render(<ReviewBody view={baseView({ finalize: { ...baseView().finalize, status: 'failed', error: 'The engine did not answer.' } })} report={page} />))).toContain('Try again');
    const fin = text(render(<ReviewBody view={baseView({ isFinal: true, finalOf: 'rep-0', questions: [] })} report={page} />));
    expect(fin).toContain('This is the final version of your page');
    expect(fin).not.toContain('Make the final version');
  });

  it('not ready: approval waits and says why', () => {
    const v = baseView({ delivery: deliveryOf({ qa_delivery_status: 'not_ready', qa_blocking: [{ code: 'duplicate_page', text: 'This website already has a page for the same search: https://www.novaand-demo.com/erp', action: 'publish it as an update' }] }), stage: 'not_ready' });
    const t = text(render(<ReviewBody view={v} report={page} />));
    expect(t).toContain('Approval opens once nothing stops the page');
    expect(t).toContain('Not ready');
  });

  it('approved: the stage and the publishing options', () => {
    const t = text(render(<ReviewBody view={baseView({ approval: { approvedAt: '2026-10-28T10:00:00Z', approvedBy: 'Owner', reportId: 'rep-1' }, stage: 'approved' })} report={page} />));
    expect(t).toContain('Approved');
    expect(t).not.toContain('Approve and publish</button>');
  });

  it('the comparison names each change in words, not colour only', () => {
    const t = text(renderToString(<Compare before={'# A\n\nOld text.\n'} after={'# A\n\nNew text.\n\nAdded text.\n'} />));
    expect(t).toContain('Changed');
    expect(t).toContain('Before:');
    expect(t).toContain('Now:');
  });

  it('content board line: stage, answered count, grade, link to the questions', () => {
    const stages: ReviewStage[] = ['questions', 'live_verified'];
    const html = render(<ReviewLine review={{ reportId: 'rep-1', stage: stages[0]!, label: '', questions: 4, answered: 1, grade: 88 }} orgId="org-test" />);
    expect(text(html)).toContain('Ready, stronger with your input');
    expect(text(html)).toContain('1 of 4 questions answered');
    expect(text(html)).toContain('grade 88/100');
    expect(html).toContain('/o/org-test/reports/rep-1#questions');
    expect(text(render(<ReviewLine review={{ reportId: 'rep-1', stage: stages[1]!, label: '', questions: 0, answered: 0, grade: null }} orgId="org-test" />))).toContain('Live, checked');
  });
});

describe('page report with the delivered status', () => {
  const md = '# ERP software in the UAE\n\nIntro.\n';
  it('leads with the status in plain words and the grade of the delivered page', () => {
    const t = text(
      renderReport(
        report('content', {
          keyword: 'erp software uae',
          html: '<article><h1>ERP software in the UAE</h1><p>Intro.</p></article>',
          markdown: md,
          meta: { title: 'ERP software in the UAE', slug: 'erp-software-uae', content_score: 91 },
          qa_delivery_status: 'ready_with_questions',
          qa_client_questions: [q('q1', 1), q('q2', 2)],
          qa_grade: { score: 91, first_draft_review: 62 },
          qa_publishable: true,
        }),
      ),
    );
    expect(t).toContain('Ready, and stronger with your input (2 questions)');
    expect(t).toContain('Grade of the page you receive');
    expect(t).toContain('The first draft, before any fix, was rated 62/100');
    expect(t).toContain('Answer 2 questions');
    expect(t).not.toContain('needs your edits before you publish it');
  });

  it('not ready: the reason, what we did and what you do', () => {
    const t = text(
      renderReport(
        report('content', {
          keyword: 'erp software uae',
          html: '<article><h1>x</h1></article>',
          markdown: md,
          meta: {},
          qa_delivery_status: 'not_ready',
          qa_blocking: [{ code: 'duplicate_page', text: 'This website already has a page for the same search: https://www.novaand-demo.com/erp', action: 'publish it as an update' }],
          qa_not_ready: true,
        }),
      ),
    );
    expect(t).toContain('Not ready: this website already has a page for the same search');
    expect(t).toContain('What you do: publish it as an update of your existing page');
  });

  it('an older report keeps the finish-by-hand path', () => {
    const t = text(renderReport(report('content', { keyword: 'erp software uae', html: '<article><h1>x</h1></article>', markdown: md, meta: {}, qa_not_ready: true, qa_reasons: ['A bracket left in the text'] })));
    expect(t).toContain('needs your edits before you publish it');
    expect(t).not.toContain('Grade of the page you receive');
  });
});
