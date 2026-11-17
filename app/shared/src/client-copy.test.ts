import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import fixtures from './__fixtures__/client-copy-prod-2026-11-17.json';
import { AI_RANK_PROSPECT_NOTE, CLIENT_COPY_FORBIDDEN, PROVIDER_ERROR_TEXT, clientText, clientTextIssues, providerErrorText, splitTitle } from './client-copy';
import { AI_RANK_CLIENT_WHY, AI_RANK_ENGINE_LEVER_LABELS, aiRankCustomerSafe, aiRankLeverOfLine, aiRankWhyPlain } from './ai-rank-client';
import { deriveSiteTasks, type SiteTaskInputs } from './site-tasks';

// CR17-H (client report 2026-11-17, F1): "6 cell(s), expected gain 0.0082 over (client time at an hour)" reached devaicon.com's Pipeline,
// Steps on your website, the AI growth report and its e-mail. Fixed once on one screen (2026-11-16), it came back on the next. The guard below
// runs every client-copy builder over the real strings production held on 2026-11-17 (fixture: site_tasks payloads and every report since
// 11-01: engine actions, AI ranking steps, research failures, prospect notes) and fails on any internal shape left.

const F = fixtures as Record<'site_task_why' | 'engine_actions' | 'ai_rank_steps' | 'research_failures' | 'other', string[]>;
const ALL = Object.values(F).flat();

describe('clientText: every production string comes out clean', () => {
  it('the fixture holds the shapes the client reported (so the test proves something)', () => {
    expect(ALL.some((s) => /cell\(s\), expected gain/.test(s))).toBe(true);
    expect(ALL.some((s) => /AI ranking placement \(L08\)/.test(s))).toBe(true);
    expect(ALL.some((s) => /status_code/.test(s))).toBe(true);
    expect(ALL.some((s) => /→/.test(s))).toBe(true);
  });
  it.each(ALL.map((s) => [s.slice(0, 70), s]))('%s', (_label, s) => {
    expect(clientTextIssues(clientText(s)), clientText(s)).toEqual([]);
  });
});

describe('the shapes, one by one', () => {
  it('the scoring line becomes the lever\'s own sentence (from the lever, or from the engine label the line starts with)', () => {
    const line = 'Get the page indexed in Google: 6 cell(s), expected gain 0.0082 over (client time at an hour), typical 21 days';
    expect(aiRankLeverOfLine(line)).toBe('L04');
    expect(clientText(line)).toBe(AI_RANK_CLIENT_WHY.L04);
    expect(aiRankWhyPlain(line, 'L12')).toBe(AI_RANK_CLIENT_WHY.L12);
    expect(aiRankWhyPlain('AI ranking (L06): Refresh the ranking page for the searches the engines run: 5 cell(s), expected gain 0.0119 over $9.63 (client time at $25 an hour)')).toBe(AI_RANK_CLIENT_WHY.L06);
    // a line about no known lever says nothing rather than the arithmetic
    expect(aiRankWhyPlain('Something: 5 cells, expected gain 0.01')).toBe('');
  });
  it('every lever has a sentence, and the sentences keep the copy rules', () => {
    expect(Object.keys(AI_RANK_CLIENT_WHY).sort()).toEqual(Object.keys(AI_RANK_ENGINE_LEVER_LABELS).sort());
    for (const s of Object.values(AI_RANK_CLIENT_WHY)) expect(clientTextIssues(s), s).toEqual([]);
  });
  it('the old prospect note names no lever code', () => {
    expect(clientText('AI ranking placement (L08)')).toBe(AI_RANK_PROSPECT_NOTE);
    expect(clientText('AI ranking placement (L08): a contact form only, a manual step')).toMatch(/^Found by AI ranking: AI answers cite this page\. A contact form only/);
  });
  it('a provider dump becomes a sentence; a short message that is already one is kept', () => {
    const raw = F.research_failures[0];
    expect(providerErrorText(raw)).toBe(`keyword ideas for 20 seeds: ${PROVIDER_ERROR_TEXT}`);
    expect(providerErrorText('Live Google check for "erp": Internal Server Error')).toBe('Live Google check for "erp": Internal Server Error');
    expect(clientText(`${raw}; related searches: no response`)).toBe(`keyword ideas for 20 seeds: ${PROVIDER_ERROR_TEXT}; related searches: no response`);
  });
  it('copy rules: arrows, dashes, curly quotes and ellipses are rewritten', () => {
    expect(clientText('Search Console (URL inspection → Request indexing)')).toBe('Search Console (URL inspection, then Request indexing)');
    expect(clientText('Fast — and “cheap”…')).toBe('Fast: and "cheap"');
    expect(clientTextIssues('seo_ladders row cad_20261113_x_2 [object Object]')).toEqual(['run_id', 'table_name', 'object']);
  });
  it('every rule has an id and a description', () => {
    expect(new Set(CLIENT_COPY_FORBIDDEN.map((r) => r.id)).size).toBe(CLIENT_COPY_FORBIDDEN.length);
  });
});

describe('splitTitle: a title never ends mid-sentence', () => {
  // the three High items of devaicon.com's list on 2026-11-17 (site report action, cut at 140 by the old cutTitle)
  const long = 'Request indexing for https://devaicon.com/services/ai-development-companies in Search Console (URL inspection → Request indexing) and link to it from 2-3 existing pages.';
  it('ends at a clause, moves the rest to the detail, loses nothing', () => {
    const { title, rest } = splitTitle(long);
    expect(title.length).toBeLessThanOrEqual(140);
    expect(title).not.toMatch(/\b(from|to|and|the|in)$/);
    expect(title).not.toMatch(/→/);
    expect(`${title} ${rest}`.replace(/\s+/g, ' ')).toMatch(/link to it from 2-3 existing pages/i);
  });
  it('a short title is unchanged', () => {
    expect(splitTitle('Publish the page for "erp dubai"')).toEqual({ title: 'Publish the page for "erp dubai"', rest: '' });
  });
});

describe('every client-copy builder over the production rows', () => {
  // the AI ranking steps production stored for both clients (site_tasks.payload), as the engine's steps
  const whys = F.site_task_why.filter((w) => /cell\(s\)/.test(w));
  const steps = whys.map((why, i) => {
    const lever = aiRankLeverOfLine(why);
    return { key: `ai_rank:${lever}:x${i}`, lever, label: '', what: lever === 'L04' ? 'Get the page into Google: https://devaicon.com/engagement-models' : '', why, check: 'our weekly check reads it again', url: lever === 'L04' ? 'https://devaicon.com/engagement-models' : '', actionId: `act_${i}`, status: 'queued' };
  });
  it('Steps on your website and Needs you (presentAiRank): no scoring line, the lever\'s sentence instead', () => {
    const inputs: SiteTaskInputs = { domain: 'devaicon.com', indexnow: null, access: null, reclaim: null, aiRank: { checkedAt: '2026-11-17T10:00:00Z', steps, statusOf: {} } };
    const tasks = deriveSiteTasks(inputs, []);
    expect(tasks.length).toBeGreaterThan(0);
    for (const t of tasks) {
      expect(clientTextIssues(t.title), t.title).toEqual([]);
      expect(clientTextIssues(t.detail), t.detail).toEqual([]);
    }
    // each step says its own lever's sentence (the week's cap decides which steps are shown; every shown one is checked)
    for (const t of tasks) expect(t.detail).toContain(AI_RANK_CLIENT_WHY[t.key.split(':')[1]]);
  });
  it('the AI growth report renderer (aiRankCustomerSafe): steps and actions', () => {
    const safe = aiRankCustomerSafe({ steps, actions: steps.map((s) => ({ ...s, action_id: s.actionId })) }) as { steps: { why: string }[]; actions: { why: string }[] };
    for (const x of [...safe.steps, ...safe.actions]) expect(clientTextIssues(x.why), x.why).toEqual([]);
  });
});

// The engine's kit says the same sentences (AIRC.WHY, ARL.LEVERS[].client): the build inlines them, harness CR17H holds them equal too
const CODE = resolve(__dirname, '../../../n8n/seo-agent/v5/code');
describe.runIf(existsSync(resolve(CODE, '_ai_rank_client.js')))('engine parity', () => {
  it('AIRC.WHY and AIRC.whyPlain equal the app\'s', () => {
    const AIRC = new Function(readFileSync(resolve(CODE, '_ai_rank_client.js'), 'utf8') + '\nreturn AIRC;')() as { WHY: Record<string, string>; whyPlain: (v: unknown, l?: string) => string };
    expect(AIRC.WHY).toEqual(AI_RANK_CLIENT_WHY);
    for (const s of [...F.site_task_why, ...F.ai_rank_steps]) expect(AIRC.whyPlain(s), s).toBe(aiRankWhyPlain(s));
  });
  it('ARL.LEVERS[].client equals the app\'s sentences', () => {
    const ARL = new Function(readFileSync(resolve(CODE, '_ai_rank_flags.js'), 'utf8') + readFileSync(resolve(CODE, '_ai_rank_learn.js'), 'utf8') + '\nreturn ARL;')() as { LEVERS: { id: string; client: string }[] };
    expect(Object.fromEntries(ARL.LEVERS.map((l) => [l.id, l.client]))).toEqual(AI_RANK_CLIENT_WHY);
  });
});
