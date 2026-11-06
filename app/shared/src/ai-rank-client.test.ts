import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { AI_RANK_CLIENT_LEVER_LABELS, AI_RANK_ENGINE_LEVER_LABELS, aiRankClientOf, aiRankClientView, aiRankCustomerSafe, aiRankPlain, withAiRankCredits } from './ai-rank-client';
import { AI_RANK_LEVER_LABELS, aiRankPlanOf, aiRankReportOf, aiRankSettingsOf } from './ai-rank';
import { clientSafePayload, customerSafePayload } from './agency';

// FX-C RC-1 (review C, 2026-11-06): a client never reads the owner's memo of the AI ranking plan. The engine kit (v5/code/_ai_rank_client.js)
// and this mirror turn the REAL memo writer's output (ARL.memo, run here from the repository) into plain sections; the served payload keeps no
// dollar figure, id, stage code or statistics word.

const here = dirname(fileURLToPath(import.meta.url));
const CODE = resolve(here, '../../../n8n/seo-agent/v5/code');
const HAVE = existsSync(resolve(CODE, '_ai_rank_learn.js')) && existsSync(resolve(CODE, '_ai_rank_client.js'));
const LEAK = /\baip_|\bair_[a-z]|\bAIR\b|Fisher|bootstrap|prior mean|\$\d|_usd\b|\bS[0-5]\b|own model|difference in differences/;

type Memo = { parts: { key: string; lines: { text: string }[] }[] };
const realMemo = (): Memo => {
  const ARL = new Function(readFileSync(resolve(CODE, '_ai_rank_flags.js'), 'utf8') + readFileSync(resolve(CODE, '_ai_rank_learn.js'), 'utf8') + '\nreturn ARL;')() as { memo: (o: unknown) => Memo };
  const d = (st: string) => [
    { prompt_id: 'aip_1', engines: { chatgpt: { stage: st }, perplexity: { stage: 'S1' } } },
    { prompt_id: 'aip_2', engines: { chatgpt: { stage: 'S1' }, perplexity: { stage: 'S1' } } },
  ];
  return ARL.memo({
    site: { site_id: 's' },
    mode: 'on',
    diagNow: d('S2'),
    diagPrev: d('S1'),
    chosen: [{ action_id: 'air_s_L09_1', lever: 'L09', executor: 'human', expected: { p: 0.1, gain: 0.2 }, page_url: 'https://clutch.co/x' }],
    open: [{ action_id: 'air_s_L05_1', lever: 'L05', status: 'verified', questions: ['aip_1'], engines: ['chatgpt'], executor: 'approve' }],
    outcomes: [{ action: { lever: 'L05', prereg_json: { projected: { p: 0.2 }, registered_at: '2026-10-01' } }, outcome: { due: true, verdict: 'cant_tell', stage_moves: { k: 1, n: 2, b: 0.1, cells: [], by: [] }, did: { effect: 0.2, lo: 0.05, hi: 0.3 } } }],
    mde: { prepost: 0.12, did: 0.2, first_appearance_k: 7, basis: 't' },
    blockers: [{ what: 'connect a mailbox', owner: 'client' }],
    cost: { usd: 3.1 },
    old: null,
  });
};
const ctx = { question: (id: string) => (id === 'aip_1' ? 'Who is the best CRM partner in Dubai?' : ''), actions: [{ lever: 'L09', executor: 'human', status: 'queued', url: 'https://clutch.co/x' }] };

describe.runIf(HAVE)('the client view of the real memo (engine kit and app mirror)', () => {
  const memo = realMemo();
  it('the raw memo itself leaks (ids, the internal name, statistics, money): the reason for the view', () => expect(LEAK.test(JSON.stringify(memo))).toBe(true));
  const view = aiRankClientView(memo, ctx);
  it('carries none of it, and says what changed, why, whether it worked and what we need', () => {
    expect(LEAK.test(JSON.stringify(view.sections))).toBe(false);
    expect(view.sections.map((s) => s.key)).toEqual(['changed', 'why', 'worked', 'did', 'you']);
    expect(view.sections[0].lines).toContain('"Who is the best CRM partner in Dubai?" on ChatGPT: moved up, from not in the answer to your website comes up but is not linked.');
    expect(view.sections[1].lines[0]).toMatch(/likely helped by our step "A new page that answers the question"/);
    expect(view.sections[2].lines).toEqual(["A new page that answers the question: can't tell yet."]);
    expect(view.sections[4].lines).toContain('Connect a mailbox.');
    expect(view.wins).toBe(0);
    expect(view.spend_usd).toBe(3.1);
  });
  it('is the engine kit\'s output exactly (AIRC.view)', () => {
    const AIRC = new Function(readFileSync(resolve(CODE, '_ai_rank_client.js'), 'utf8') + '\nreturn AIRC;')() as { view: (m: unknown, c: unknown) => unknown; LABELS: Record<string, string>; ENGINE_LABELS: Record<string, string> };
    expect(view).toEqual(AIRC.view(memo, ctx));
    expect(AIRC.LABELS).toEqual(AI_RANK_CLIENT_LEVER_LABELS);
    expect(AIRC.ENGINE_LABELS).toEqual(AI_RANK_ENGINE_LEVER_LABELS);
  });
});

describe('client words', () => {
  it('the client lever labels are the app\'s own', () => expect(AI_RANK_CLIENT_LEVER_LABELS).toEqual(AI_RANK_LEVER_LABELS));
  it('plain() strips ids, stage codes, money and the model\'s figures', () => {
    expect(aiRankPlain('AIR chose it (prior mean x engine multiplier) for aip_12 at S1, $3.10 spent')).toBe('AI ranking chose it for at, spent');
    expect(LEAK.test(aiRankPlain('air_site_x_L05_00aa (AIR\'s own model, not independent) US$ 4.20'))).toBe(false);
  });
  it('an unrecognised memo line is never printed', () => expect(aiRankClientView({ parts: [{ key: 'what_changed', lines: [{ text: 'Question aip_9 something odd', figures: [] }] }] }).sections.find((s) => s.key === 'changed')).toBeUndefined());
});

describe('credits, never dollars', () => {
  const payload = {
    stage: 'ai_growth',
    ai_rank: {
      v: 2,
      client: { v: 1, sections: [{ key: 'you', title: 'What we need from you', lines: ['Pay $3.10 to air_site_x_L05_1'] }], wins: 2, spend_usd: 3 },
      memo: { parts: [{ key: 'cost_per_win', title: 'Cost per won question', lines: [{ text: 'About $1.50 per question', figures: [{ name: 'spend_usd', value: 3 }] }] }] },
      cost: { usd: 3, basis: 'measured' },
      compare: { overlap: 0.2, note: "AIR's own model" },
      actions: [{ action_id: 'air_site_x_L05_1', label: 'A new page', why: 'chosen (prior mean x engine multiplier) for $2', target_stage: 'S2' }],
      steps: [{ key: 'ai_rank:L12:s:site', action_id: 'air_site_x_L12_1', what: 'A LinkedIn article', why: 'S1 to S4 at $0' }],
    },
  };
  it('the callback ingest adds credits at the app\'s rate (60 a dollar): 180 used, 90 per question won', () => {
    const c = (withAiRankCredits(payload, 60).ai_rank as { client: Record<string, unknown> }).client;
    expect(c.credits_used).toBe(180);
    expect(c.credits_per_win).toBe(90);
  });
  it('a served payload (company people, API callers, client people) has no dollar, no memo, no comparison, no cost, no id', () => {
    const stored = withAiRankCredits(payload, 60);
    for (const served of [customerSafePayload(stored), clientSafePayload(stored)]) {
      const t = JSON.stringify(served.ai_rank);
      expect(t).not.toMatch(/\$\d|_usd|"memo"|"compare"|"cost"|air_site|prior mean|\bS[0-5]\b/);
      expect(t).toMatch(/credits_per_win":90/);
    }
    const r = aiRankReportOf(customerSafePayload(stored));
    expect(r?.client?.creditsPerWin).toBe(90);
    expect(r?.memo).toBeNull();
    expect(r?.cost).toBeNull();
  });
  it('aiRankCustomerSafe leaves anything that is not an object alone', () => expect(aiRankCustomerSafe('x')).toBe('x'));
  it('an older served client view without credits reads as null credits', () => expect(aiRankClientOf({ sections: [{ key: 'did', title: 'What we did', lines: ['x'] }] })?.creditsUsed).toBeNull());
});

describe.runIf(HAVE)('the AI visibility page plan', () => {
  const memo = realMemo();
  const runs = [{ run_id: 'r1', checked_at: '2026-11-02T09:30:00Z', mode: 'on', chosen_json: JSON.stringify([{ action_id: 'air_s_L09_1', lever: 'L09', executor: 'human', questions: ['aip_1'], why: 'a list the answers cite (prior mean x engine multiplier)' }]), memo_json: JSON.stringify(memo), cost_json: JSON.stringify({ usd: 3.1, basis: 'measured' }) }];
  const settings = aiRankSettingsOf({ ai_rank_mode: 'on' });
  it('a customer gets the client view with credits, question texts, plain whys; no memo, no cost', () => {
    const p = aiRankPlanOf(runs, [], settings, { question: ctx.question, creditRate: 60 })!;
    expect(p.memo).toBeNull();
    expect(p.cost).toBeNull();
    expect(p.client?.creditsUsed).toBe(186);
    expect(p.actions[0].questions).toEqual(['Who is the best CRM partner in Dubai?']);
    expect(LEAK.test(JSON.stringify({ c: p.client, a: p.actions }))).toBe(false);
  });
  it('a platform admin also gets the raw memo and the cost', () => {
    const p = aiRankPlanOf(runs, [], settings, { question: ctx.question, creditRate: 60, admin: true })!;
    expect(p.memo?.parts.length).toBe(7);
    expect(p.cost?.usd).toBe(3.1);
  });
});
