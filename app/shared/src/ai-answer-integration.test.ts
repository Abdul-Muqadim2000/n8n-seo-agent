import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { AI_CLIENT_TEXT_BANNED, AI_TARGET_ENGINE_CODES, aiTargetCode, aiTargetView } from './ai-target-status';
import { holdButtons, holdOf } from './hold';
import { liveGradeBody } from './live-grade';
import { aiTargetForEngine, finalizeBody, pageRunOf } from './page-review';

// Client reports 2026-11-16 (devaicon.com, issue 1), integration of the engine branch (fix/ai-answer-engine-1116) and the app branch
// (fix/ai-answer-app-1116): what one side produces, the other must read.
//   1. the final version and the live grade of an AI answer page carry the AI target back to the engine (page_run.ai_target)
//   2. every reason code the engine's kit AQ can write has a plain sentence and a badge in the app
//   3. the hold's `ai_refresh` alternative ("Improve <page> for this question") is the held page's first button, with the AI target

const here = dirname(fileURLToPath(import.meta.url));
const ENGINE = join(here, '../../../n8n/seo-agent');

const AIT_ENGINE = { question: 'Which companies offer the best AI automation services for businesses in Dubai?', kind: 'answer', target_id: 'ait_devaicon-com_q1', fanout: ['ai automation dubai'], sources: [{ url: 'https://rival.example/list', title: 'List' }], competitors: ['Rival AI'] };
const ORIGINAL = { stage: 'content', request_id: '13001', keyword: 'best ai automation services dubai', markdown: '# Best AI automation services in Dubai\n\nText.\n', meta: { page_type: 'Guide', title: 't', slug: 's', h1: 'h' }, page_run: { prc: 1, content_request_id: '13001', ai_target: AIT_ENGINE } };
const OLD_ORIGINAL = { ...ORIGINAL, page_run: { prc: 1, content_request_id: '13001' } };
const RUN_INPUT = { mode: 'keyword', keyword: 'best ai automation services dubai', aiTarget: { question: AIT_ENGINE.question, kind: 'answer', targetId: 'ait_devaicon-com_q1', fanout: ['ai automation dubai'], sources: [{ url: 'https://rival.example/list', title: 'List' }], competitors: ['Rival AI'] } };

const fin = (payload: Record<string, unknown>, aiTarget?: Record<string, unknown> | null) =>
  finalizeBody({ requestId: 'app-fin-1', domain: 'devaicon.com', siteId: 'site_devaicon-com', payload, markdown: String(payload.markdown), clientEdited: false, questions: [], answers: {}, businessFacts: '', facts: {}, original: payload, aiTarget });

describe('1. the final version of an AI page is judged as an AI page', () => {
  it('the page run context keeps the AI target the engine sent (page_run.ai_target)', () => {
    expect(pageRunOf(ORIGINAL).ai_target).toEqual(AIT_ENGINE);
    expect(fin(ORIGINAL).page_run.ai_target).toEqual(AIT_ENGINE);
  });
  it('a report from before it: the AI target of the run the app started, in the engine shape', () => {
    expect(pageRunOf(OLD_ORIGINAL).ai_target).toBeUndefined();
    const t = aiTargetForEngine(RUN_INPUT);
    expect(t).toEqual({ question: AIT_ENGINE.question, kind: 'answer', target_id: 'ait_devaicon-com_q1', fanout: ['ai automation dubai'], sources: [{ u: 'https://rival.example/list', t: 'List' }], competitors: ['Rival AI'] });
    expect(fin(OLD_ORIGINAL, t).page_run.ai_target).toEqual(t);
  });
  it("the engine's own target wins over the run's; a plain page stays plain", () => {
    expect(fin(ORIGINAL, { question: 'Another question entirely for this page?' }).page_run.ai_target).toEqual(AIT_ENGINE);
    expect(fin(OLD_ORIGINAL, null).page_run.ai_target).toBeUndefined();
    expect(aiTargetForEngine({ mode: 'keyword', keyword: 'x' })).toBeNull();
  });
  it('the live grade request carries it too', () => {
    const b = liveGradeBody({ requestId: 'app-live-1', domain: 'devaicon.com', siteId: 's', payload: OLD_ORIGINAL, original: OLD_ORIGINAL, businessFacts: '', facts: {}, aiTarget: aiTargetForEngine(RUN_INPUT), check: { url: 'https://devaicon.com/x', h1: 'h', title: 't' } });
    expect((b.page_run.ai_target as { question: string }).question).toBe(AIT_ENGINE.question);
  });
});

describe('2. every reason code the engine writes reads as a plain sentence in the app', () => {
  // the engine's kit, evaluated from the engine folder: a code added there without a mapping here fails this suite
  const KIT = new Function(readFileSync(join(ENGINE, 'v5/code/_ai_question.js'), 'utf8') + '\nreturn AQ;')() as { CODES: string[]; reason: (c: string, a: Record<string, unknown>) => string };
  const STATUSES = ['queued', 'writing', 'written', 'skipped', 'set_aside'];
  it('the app lists every engine code', () => {
    expect([...KIT.CODES].sort()).toEqual([...AI_TARGET_ENGINE_CODES].sort());
  });
  it.each(KIT.CODES)('code %s: known to the app, a badge and a clean sentence for every status', (code) => {
    const args = { page_url: 'https://devaicon.com/services/engagement-models', keyword: 'agentic ai development in uae', date: '2026-11-13', reason: 'government' };
    expect(aiTargetCode({ reasonCode: code, reasonArgs: args, status: 'queued' })).not.toBe('');
    for (const status of STATUSES) {
      const v = aiTargetView({ status, kind: 'answer', keyword: 'governed vs autonomous ai agents', reasonCode: code, reasonArgs: JSON.stringify(args), reason: KIT.reason(code, args) });
      expect(v.badge).not.toBe('');
      expect(v.badge).not.toMatch(/_/);
      expect(v.sentence.length).toBeGreaterThan(10);
      expect(AI_CLIENT_TEXT_BANNED.filter((re) => re.test(v.sentence + ' ' + v.badge)).map(String)).toEqual([]);
    }
  });
  it('the engine spellings map onto what the app shows', () => {
    const view = (status: string, code: string, args: Record<string, unknown> = {}) => aiTargetView({ status, kind: 'answer', keyword: 'k', reasonCode: code, reasonArgs: JSON.stringify(args) });
    expect(view('queued', 'ladder_page', { keyword: 'agentic ai development in uae' })).toMatchObject({ badge: 'Via the ladder', viaLadder: true });
    expect(view('queued', 'ladder_page', { keyword: 'agentic ai development in uae' }).sentence).toContain('"agentic ai development in uae"');
    expect(view('skipped', 'kept_by_you')).toMatchObject({ state: 'kept_out', badge: 'Kept out by you' });
    expect(view('writing', 'draft_failed')).toMatchObject({ state: 'needs_fix', badge: 'Needs a fix' });
    expect(view('set_aside', 'not_for_site', { reason: 'job' }).sentence).toMatch(/jobs or careers/);
    expect(view('set_aside', 'not_for_site', { reason: 'government' }).sentence).toMatch(/government/);
    expect(view('set_aside', 'not_for_site', { reason: 'navigational' }).sentence).toMatch(/one particular website/);
    expect(view('set_aside', 'not_for_site', { reason: 'brand' }).sentence).toMatch(/another company/);
    expect(view('set_aside', 'not_for_site').sentence).toMatch(/another company/);
    expect(view('queued', 'lost_again').sentence).toMatch(/stopped/);
    expect(view('skipped', 'suggested', { page_url: 'https://devaicon.com/services/engagement-models' })).toMatchObject({ badge: 'Suggested' });
    expect(view('skipped', 'unjudged')).toMatchObject({ badge: 'Suggested' });
    expect(view('skipped', 'off_panel')).toMatchObject({ hidden: true });
    expect(view('queued', 'not_asked').sentence).toMatch(/not asked/);
  });
});

describe('3. the hold of an AI page: "Improve <page> for this question" first, with the AI target', () => {
  const HOLD_PAYLOAD = {
    stage: 'content', keyword: 'best crm service provider uae',
    hold: {
      held: true, mode: 'enforce', score: 48, kinds: ['duplicate'], reasons: ['Your page https://www.techand.ai/dynamics-365-crm-uae is already the page for "best crm service provider uae".'],
      duplicates: [{ url: 'https://www.techand.ai/dynamics-365-crm-uae', title: '' }],
      alternatives: [{ kind: 'ai_refresh', label: 'Improve /dynamics-365-crm-uae for this question', url: 'https://www.techand.ai/dynamics-365-crm-uae', keyword: 'best crm service provider uae', page_type: 'Service Page',
        existing_page_url: 'https://www.techand.ai/dynamics-365-crm-uae', ai_target: { ...AIT_ENGINE, question: 'Who is the best CRM service provider in the UAE?', kind: 'refresh' }, why: 'your page already answers searches like this one' }],
    },
  };
  it('holdOf keeps the ai_refresh alternative with its AI target', () => {
    const h = holdOf(HOLD_PAYLOAD)!;
    expect(h.alternatives.map((a) => a.kind)).toEqual(['ai_refresh']);
    expect(h.alternatives[0]!.aiTarget?.kind).toBe('refresh');
  });
  it('its button comes first and starts a refresh of that page for the question; Write it anyway keeps the question as a new answer page', () => {
    const b = holdButtons(holdOf(HOLD_PAYLOAD)!, { keyword: 'best crm service provider uae', pageType: 'Guide', country: 'United Arab Emirates' });
    expect(b.map((x) => x.id)).toEqual(['ai_refresh', 'write_anyway']);
    expect(b[0]!.label).toBe('Improve /dynamics-365-crm-uae for this question');
    expect(b[0]!.prefill).toMatchObject({ keyword: 'best crm service provider uae', pageType: 'Service Page', existingPageUrl: 'https://www.techand.ai/dynamics-365-crm-uae', country: 'United Arab Emirates' });
    expect(b[0]!.prefill.aiTarget).toMatchObject({ question: 'Who is the best CRM service provider in the UAE?', kind: 'refresh', targetId: 'ait_devaicon-com_q1', sources: [{ url: 'https://rival.example/list', title: 'List' }] });
    expect(b[1]!.prefill.aiTarget).toMatchObject({ question: 'Who is the best CRM service provider in the UAE?', kind: 'answer' });
  });
  it("an 'improve' alternative of an AI page keeps the AI target (as a refresh)", () => {
    const p = { ...HOLD_PAYLOAD, hold: { ...HOLD_PAYLOAD.hold, alternatives: [{ kind: 'improve', label: 'Improve the existing page', url: 'https://www.techand.ai/crm', keyword: 'best crm service provider uae', why: 'w' }] } };
    const run = { question: 'Who is the best CRM service provider in the UAE?', kind: 'answer' as const, targetId: 't1', fanout: [], sources: [], competitors: [] };
    const b = holdButtons(holdOf(p)!, { keyword: 'best crm service provider uae', pageType: 'Guide', aiTarget: run });
    expect(b[0]!.id).toBe('improve');
    expect(b[0]!.prefill.aiTarget).toMatchObject({ question: run.question, kind: 'refresh' });
    expect(b[1]!.prefill.aiTarget).toMatchObject({ question: run.question, kind: 'answer' });
  });
  it('a plain page has no AI target on any button', () => {
    const p = { ...HOLD_PAYLOAD, hold: { ...HOLD_PAYLOAD.hold, alternatives: [{ kind: 'improve', label: 'Improve the existing page', url: 'https://www.techand.ai/crm', keyword: 'crm', why: 'w' }] } };
    expect(holdButtons(holdOf(p)!, { keyword: 'crm' }).every((x) => !('aiTarget' in x.prefill))).toBe(true);
  });
});
