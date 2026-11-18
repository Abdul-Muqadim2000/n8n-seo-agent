import { describe, expect, it } from 'vitest';
import type { PipelineData } from './data';
import { aiTargetView } from './ai-target-status';
import { aiAnsweredView, aiNextCheck, aiPermanentMoves, aiQuestionAction, aiQuestionPages, type AiQuestionInputs, type AiTargetForAction } from './ai-question-action';
import { pipelineNotices } from './pipeline-notices';

// Client report 2026-11-17 (devaicon.com, Q3 / Q2): the AI visibility page said "Write the page" for a question while the write form said
// "Your page /services/agentic-ai-development-in-uae already answers searches like this one". The two read different page lists, and the AI
// page let the engine's weekly decision (settled at 01:23) win over a page published at 09:30 the same day. These cases are the production
// rows of 17 Nov 2026 (inv7/sim.ts), reduced to what decides them: ONE page list, ONE decision, the same page on every screen.

const NOW = Date.parse('2026-11-17T14:00:00Z');
const AE = 'United Arab Emirates';
const s = (v: unknown) => (v == null ? '' : String(v));

type T = Record<string, unknown>;
function decide(o: { logs: T[]; ladders: T[]; targets: T[]; prompts: T[]; runs?: Map<string, { targetId: string; question: string }>; moves?: T[] }) {
  const written = aiQuestionPages({ logs: o.logs, ladders: o.ladders, aiRuns: o.runs, moves: aiPermanentMoves(o.moves ?? []), now: NOW });
  const ladderHeads = [...new Set(o.ladders.map((l) => s(l.head_keyword)))];
  const dec = { written, market: AE, ladderHeads, nextAiCheck: '2026-11-18T06:30:00Z' };
  const targets: AiTargetForAction[] = o.targets.map((t) => {
    const v = aiTargetView({ status: s(t.status), kind: s(t.kind), keyword: s(t.keyword), question: s(t.question), pageUrl: s(t.page_url), reason: s(t.reason), requestId: s(t.request_id), updatedAt: s(t.updated_at) }, o.logs);
    const a = aiAnsweredView({ targetId: s(t.target_id), question: s(t.question), keyword: s(t.keyword), state: v.state, updatedAt: s(t.updated_at), hidden: v.hidden }, dec);
    const w = a ? { ...v, ...a } : v;
    return { targetId: s(t.target_id), promptId: s(t.prompt_id), question: s(t.question), keyword: s(t.keyword), kind: s(t.kind), pageUrl: s(t.page_url), status: s(t.status), state: w.state, statePageUrl: w.pageUrl, reason: w.sentence, badge: w.badge, updatedAt: s(t.updated_at), hidden: w.hidden };
  });
  const prompts = o.prompts.map((p) => ({ promptId: s(p.prompt_id), prompt: s(p.prompt), keyword: s(p.keyword), topic: s(p.topic), kind: s(p.kind) }));
  const inputs: AiQuestionInputs = { prompts, targets, ...dec };
  const pipe = {
    written: [], ladders: ladderHeads.map((h, i) => ({ id: `l${i}`, head: h, pages: 1, published: 0, planned: [], keywords: [h] })), aiPages: written, aiTargets: targets, nextAiCheck: dec.nextAiCheck,
    activeRuns: [], automations: [], running: [], queue: { pagesPerWeek: 1, next: [], later: [], waiting: [], engineUpcoming: [], engineUpcomingAt: null }, automation: {},
  } as unknown as PipelineData;
  const page = (promptId: string) => {
    const p = prompts.find((x) => x.promptId === promptId)!;
    return aiQuestionAction({ promptId, question: p.prompt, kind: p.kind }, inputs);
  };
  const form = (promptId: string) => {
    const p = prompts.find((x) => x.promptId === promptId)!;
    const t = targets.find((x) => x.promptId === promptId);
    return pipelineNotices('keyword', { keyword: p.keyword, country: AE, receiveContent: true, aiTarget: { question: p.prompt, kind: 'answer', targetId: t?.targetId } }, pipe, { now: new Date(NOW) }).filter((n) => /^ai-/.test(n.id));
  };
  return { targets, page, form, prompts };
}

// ---- devaicon.com (17 Nov): question 37 and its ladder's main page, live since 13 Nov 09:30 ----
const Q37 = 'Who are the top agentic AI development companies in the UAE for building autonomous business agents?';
const devaicon = {
  logs: [
    { id: 59, keyword: 'ai app development companies', page_type: 'Service Page', source: 'ladder', status: 'published', published_url: 'https://devaicon.com/services/ai-app-development-companies', published_at: '2026-11-06T09:22:28Z', started_at: '2026-11-06T01:28:11Z', rung: 2, request_id: 'cad_20261106_devaicon-com_2' },
    { id: 65, keyword: 'agentic ai development in uae', page_type: 'Service Page', source: 'ladder', status: 'published', published_url: 'https://devaicon.com/services/agentic-ai-development-in-uae', published_at: '2026-11-13T09:30:35Z', started_at: '2026-11-13T01:28:16Z', rung: 4, request_id: 'cad_20261113_devaicon-com_1' },
    { id: 17, keyword: 'ai automation services pakistan', page_type: 'Service Page', source: 'ladder', status: 'published', published_url: 'https://devaicon.com/ai-automation-services-pakistan', published_at: '2026-10-30T07:52:35Z', started_at: '2026-10-30T01:28:10Z', rung: 4, request_id: 'cad_20261030_devaicon-com_2' },
    { id: 24, keyword: 'engagement models', page_type: 'Service Page', source: 'app', status: 'published', published_url: 'https://devaicon.com/services/engagement-models', published_at: '2026-11-11T09:29:10Z', started_at: '2026-11-03T11:18:16Z', rung: 0, request_id: '7491' },
  ],
  ladders: [
    { keyword: 'agentic ai development in uae', head_keyword: 'agentic ai development in uae', rung: 4, status: 'published', target_url: 'https://devaicon.com/services/agentic-ai-development-in-uae' },
    { keyword: 'ai app development companies', head_keyword: 'agentic ai development in uae', rung: 2, status: 'published', target_url: 'https://devaicon.com/services/ai-app-development-companies' },
    { keyword: 'ai app development', head_keyword: 'agentic ai development in uae', rung: 2, status: 'planned', target_url: 'https://devaicon.com/ai-app-development' },
  ],
  targets: [
    { target_id: 'ait_q37', prompt_id: 'q37', question: Q37, keyword: 'agentic ai development companies uae', kind: 'answer', status: 'written', reason: 'no page answers it yet', updated_at: '2026-11-13T01:23:09Z', request_id: 'cad_20261106_devaicon-com_2' },
    { target_id: 'ait_q42', prompt_id: 'q42', question: 'Fixed-price vs dedicated team vs time-and-material: which engagement model suits an AI software project?', keyword: 'ai project engagement models', kind: 'refresh', page_url: 'https://devaicon.com/services/engagement-models', status: 'skipped',
      reason: 'not a search this website should target: 0% of its own words match (25% is the bar): project, engagement, models. (off topic); but your own page https://devaicon.com/services/engagement-models answers it, so it is kept. the page is fresh (published 2026-11-11) and AI-ready (74/100)', updated_at: '2026-11-13T01:23:09Z' },
  ],
  prompts: [
    { prompt_id: 'qb', prompt: 'What is Devaicon (devaicon.com) and what services does it offer?', keyword: 'devaicon', topic: 'open edx provider', kind: 'brand' },
    { prompt_id: 'q37', prompt: Q37, keyword: 'agentic ai development companies uae', topic: 'agentic ai development in uae', kind: 'recommend' },
    { prompt_id: 'q42', prompt: 'Fixed-price vs dedicated team vs time-and-material: which engagement model suits an AI software project?', keyword: 'ai project engagement models', topic: 'engagement models', kind: 'compare' },
  ],
  // CR17 review R1 (L5): a move is the one the engine's Page Watch confirmed (moved_to), as on production once read twice
  moves: [{ url: 'https://devaicon.com/ai-automation-services-pakistan', status: 301, location: '/services/ai-automation-services-pakistan', moved_to: 'https://devaicon.com/services/ai-automation-services-pakistan' }],
};

// ---- techand.ai (17 Nov): "crm service provider dubai", its CRM guide live since 12 Nov 13:25, the CRM ladder's main page written only ----
const QDXB = 'Who are the best CRM service providers in Dubai for improving customer service and support ticket handling?';
const QUAE = 'Who are the best CRM service providers in the UAE for a growing real estate company?';
const techand = {
  logs: [
    { id: 64, keyword: 'crm service provider in uae', page_type: 'Guide', source: 'app', status: 'published', published_url: 'https://www.techand.ai/insights/dynamics-365-crm-uae', published_at: '2026-11-12T13:25:57Z', started_at: '2026-11-11T10:00:00Z', rung: 0, request_id: '13215' },
    { id: 68, keyword: 'crm service provider', page_type: 'Service Page', source: 'ladder', status: 'written', published_url: '', started_at: '2026-11-15T10:00:00Z', rung: 4, request_id: '14918' },
  ],
  ladders: [{ keyword: 'crm service provider', head_keyword: 'crm service provider', rung: 4, status: 'written', target_url: 'https://www.techand.ai/dynamics-365-crm-uae' }],
  targets: [
    { target_id: 'ait_dxb', prompt_id: 'qdxb', question: QDXB, keyword: 'crm service provider dubai', kind: 'answer', status: 'queued', reason: 'no page answers it yet', updated_at: '2026-11-12T01:23:09Z' },
    { target_id: 'ait_uae', prompt_id: 'quae', question: QUAE, keyword: 'best crm service provider uae', kind: 'refresh', page_url: 'https://www.techand.ai/dynamics-365-crm-uae', status: 'queued', reason: 'refresh https://www.techand.ai/dynamics-365-crm-uae (keyword ladder page; no visible update date on the page)', updated_at: '2026-11-12T01:23:09Z' },
  ],
  prompts: [
    { prompt_id: 'qdxb', prompt: QDXB, keyword: 'crm service provider dubai', topic: 'crm service provider', kind: 'recommend' },
    { prompt_id: 'quae', prompt: QUAE, keyword: 'best crm service provider uae', topic: 'crm service provider in uae', kind: 'recommend' },
    { prompt_id: 'qtb', prompt: 'What is Tech& (techand.ai) in Dubai and what services does it offer?', keyword: 'tech& techand.ai', topic: 'brand', kind: 'brand' },
  ],
  runs: new Map([['13215', { targetId: 'ait_uae', question: QUAE }]]),
};

describe('CR17 Q3: one decision per AI question, the same page on the AI page and the write form', () => {
  it('devaicon question 37: answered by the live ladder main page, published after the engine last settled it (never "Write the page")', () => {
    const d = decide(devaicon);
    const t = d.targets.find((x) => x.targetId === 'ait_q37')!;
    expect(t.badge).toBe('Answered');
    expect(t.reason).toBe('Answered by /services/agentic-ai-development-in-uae, live since 13 Nov 2026. The next AI check is on 18 Nov 2026; AI answers usually take a few weeks to change.');
    const a = d.page('q37');
    expect(a.step).toBe('open');
    expect(a.label).toBe('See the page');
    expect(a.run).toBeNull();
    expect(a.pageUrl).toBe('https://devaicon.com/services/agentic-ai-development-in-uae');
    expect(a.since).toBe('2026-11-13T09:30:35Z');
  });

  it('devaicon question 42: "Covered" by its page, never "Improve the page" beside it (the fresh-page reason outranks its off-topic marker)', () => {
    const d = decide(devaicon);
    const t = d.targets.find((x) => x.targetId === 'ait_q42')!;
    expect(t.state).toBe('covered');
    const a = d.page('q42');
    expect(a.step).toBe('open');
    expect(a.pageUrl).toBe('https://devaicon.com/services/engagement-models');
  });

  it('the brand question never gets "Write the page" (both websites)', () => {
    expect(decide(devaicon).page('qb').step).toBe('none');
    expect(decide(devaicon).page('qb').note).toContain('Your home page and About page answer it');
    expect(decide(techand).page('qtb').run).toBeNull();
  });

  it('techand "crm service provider dubai": answered by the CRM guide live since 12 Nov, on the AI page and in its badge', () => {
    const d = decide(techand);
    const a = d.page('qdxb');
    expect(a.step).toBe('open');
    expect(a.pageUrl).toBe('https://www.techand.ai/insights/dynamics-365-crm-uae');
    expect(d.targets.find((x) => x.targetId === 'ait_dxb')!.statePageUrl).toBe('https://www.techand.ai/insights/dynamics-365-crm-uae');
  });

  it('techand "best crm service provider uae": the page written FOR the question is its page; badge and button name the same one', () => {
    const d = decide(techand);
    const t = d.targets.find((x) => x.targetId === 'ait_uae')!;
    const a = d.page('quae');
    expect(t.statePageUrl).toBe(a.pageUrl);
    expect(a.pageUrl).toBe('https://www.techand.ai/insights/dynamics-365-crm-uae');
    expect(a.basis).toBe('answered');
  });

  it('parity: for every question of both websites, the write form names the page the AI page names, and stays silent when the AI page says write', () => {
    for (const site of [devaicon, techand]) {
      const d = decide(site);
      for (const p of d.prompts) {
        const a = d.page(p.promptId);
        const n = d.form(p.promptId);
        const page = a.step === 'open' ? a.pageUrl : a.step === 'improve' ? a.existingPageUrl : '';
        if (a.step === 'write') expect(n).toEqual([]);
        if (page) {
          expect(n).toHaveLength(1);
          expect(n[0].usePlan?.existingPageUrl).toBe(page);
          if (a.basis === 'answered') expect(n[0].body.startsWith(a.note.split('.')[0])).toBe(true);
        }
      }
    }
  });

  it('the stored decision stands for a page the engine already weighed (published before its settle)', () => {
    const d = decide({ ...devaicon, targets: [{ ...devaicon.targets[0], status: 'queued', request_id: '', updated_at: '2026-11-14T01:23:09Z' }] });
    expect(d.page('q37').step).toBe('write');
  });
});

describe('CR17 Q3: the one page list', () => {
  it('ladder pages join the content log, a moved address is followed, a page is listed once', () => {
    const w = aiQuestionPages({ logs: devaicon.logs, ladders: devaicon.ladders, moves: aiPermanentMoves(devaicon.moves), now: NOW });
    expect(w.find((x) => x.keyword === 'ai automation services pakistan')?.publishedUrl).toBe('https://devaicon.com/services/ai-automation-services-pakistan');
    expect(w.filter((x) => x.keyword === 'agentic ai development in uae')).toHaveLength(1);
    expect(w.find((x) => x.keyword === 'agentic ai development in uae')?.ladderHead).toBe(true);
    expect(w.some((x) => x.keyword === 'ai app development')).toBe(false);   // planned only: no page
  });
  it('only same-site permanent redirects are moves', () => {
    expect(aiPermanentMoves([{ url: 'https://a.test/x', status: 302, location: '/y' }, { url: 'https://a.test/x', status: 301, location: 'https://b.test/y' }, { url: 'https://a.test/x', status: 308, location: '/' }])).toEqual([]);
  });
  it('review R1 L5: only the moves the engine confirmed (two reads, a working target, never the home page) are followed', () => {
    // a 301 seen once (no moved_to yet) is not a move, nor a confirmed address on another site or the home page
    expect(aiPermanentMoves([{ url: 'https://a.test/x', status: 301, location: '/y' }])).toEqual([]);
    expect(aiPermanentMoves([{ url: 'https://a.test/x', status: 301, location: '/y', moved_to: 'https://b.test/y' }, { url: 'https://a.test/x', status: 301, location: '/', moved_to: 'https://a.test/' }])).toEqual([]);
    expect(aiPermanentMoves([{ url: 'https://a.test/x', status: 301, location: '/y', moved_to: 'https://a.test/y' }])).toEqual([{ from: 'https://a.test/x', to: 'https://a.test/y' }]);
    // a stored 404 / 5xx target never becomes a move: the engine writes moved_to only for a target that answers as a page of its own
    expect(aiPermanentMoves([{ url: 'https://a.test/x', status: 301, location: '/gone' }])).toEqual([]);
  });
  it('the next AI check: the day after the last daily check, else a week after the weekly one, never in the past', () => {
    expect(aiNextCheck({ lastWeekly: '2026-11-13T01:00:00Z', lastDaily: '2026-11-17T06:30:00Z', daily: true, now: NOW })).toBe('2026-11-18T06:30:00.000Z');
    expect(aiNextCheck({ lastWeekly: '2026-11-13T01:00:00Z', daily: false, now: NOW })).toBe('2026-11-20T01:00:00.000Z');
    expect(aiNextCheck({ now: NOW })).toBe('');
  });
});
