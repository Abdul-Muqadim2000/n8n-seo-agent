import { describe, expect, it } from 'vitest';
import {
  AI_RANK_LEVER_LABELS,
  AI_RANK_OPEN_TO_CLIENTS,
  aiRankActionOf,
  aiRankAddressCheck,
  aiRankAddressNeed,
  aiRankClientMode,
  aiRankMayChange,
  aiRankPageNames,
  aiRankSaveKept,
} from './ai-rank';
import { deriveSiteTasks, siteTaskPayload, type SiteTaskInputs, type StoredSiteTask } from './site-tasks';
import { guideById } from './guides';

// Review C (2026-11-06, docs/ai-ranking-2026-11-05/REVIEW_C_ONMODE_APP.md) on the app's half of AI ranking: RC-3 (the steps checked on an
// address the client pastes), RC-4 (who may switch it on during the trial), RC-9 (a save the engine did not keep), RC-14 (the client's lever
// words win). Synthetic data only (novaand-demo.com).

const D = 'novaand-demo.com';
const base: SiteTaskInputs = { domain: D, indexnow: null, access: null, reclaim: null };
const at = '2026-11-16T09:30:00Z';
const step = (lever: string, extra: Record<string, unknown> = {}) => ({ key: `ai_rank:${lever}:p:q1`, lever, label: '', what: `Step ${lever}`, why: 'B2B answers cite LinkedIn articles by named people', check: 'you give us the address and our reading finds your name on it', url: '', actionId: `act_${lever}`, status: 'queued', ...extra });
const stored = (key: string, payload: Record<string, unknown>, o: Partial<StoredSiteTask> = {}): StoredSiteTask => ({ key, kind: 'ai_rank', payload, lastCheck: null, doneAt: null, skippedAt: null, skippedBy: null, createdAt: '2026-11-10T00:00:00Z', ...o });

describe('RC-3: steps checked on an address the client pastes', () => {
  it('which levers need an address', () => {
    for (const l of ['L11', 'L12', 'L13', 'L14', 'L15', 'L17']) expect(aiRankAddressNeed(l)).toBe('required');
    for (const l of ['L09', 'L10']) expect(aiRankAddressNeed(l)).toBe('optional');
    for (const l of ['L01', 'L05', 'L08', 'L16', '']) expect(aiRankAddressNeed(l)).toBeNull();
  });
  it('the address field is on the step, empty until given; the step says how it is checked (never "add it in Link building")', () => {
    const [t] = deriveSiteTasks({ ...base, aiRank: { checkedAt: at, steps: [step('L12')], statusOf: {} } }, []);
    expect(t.address).toEqual({ required: true, label: 'The address of your LinkedIn article', value: '' });
    expect(t.detail).toMatch(/paste its address below/);
    expect(t.detail).not.toMatch(/you give us the address/);
    const [o] = deriveSiteTasks({ ...base, aiRank: { checkedAt: at, steps: [step('L09')], statusOf: {} } }, []);
    expect(o.address?.required).toBe(false);
    const [n] = deriveSiteTasks({ ...base, aiRank: { checkedAt: at, steps: [step('L01')], statusOf: {} } }, []);
    expect(n.address).toBeUndefined();
  });
  it('the address given survives the next plan, and our own check confirms the step (done, with our words)', () => {
    const key = 'ai_rank:L12:p:q1';
    const s = stored(key, { lever: 'L12', actionId: 'act_L12', clientUrl: 'https://www.linkedin.com/pulse/x', names: ['Nova&'] }, { lastCheck: { at: '2026-11-15T10:00:00Z', ok: true, by: 'you', message: 'names your business' }, doneAt: '2026-11-15T10:00:00Z' });
    const inputs = { ...base, aiRank: { checkedAt: at, steps: [step('L12')], statusOf: { act_L12: 'queued' } } };
    const [t] = deriveSiteTasks(inputs, [s]);
    expect(t.state).toBe('done');
    expect(t.address?.value).toBe('https://www.linkedin.com/pulse/x');
    expect(t.detail).toMatch(/We opened https:\/\/www\.linkedin\.com\/pulse\/x and found your business/);
    expect(siteTaskPayload(inputs, [s], key)?.payload).toMatchObject({ clientUrl: 'https://www.linkedin.com/pulse/x', names: ['Nova&'] });
    // the plan moved on (the action expired before the weekly check saw it): the step our check confirmed stays listed
    const later = deriveSiteTasks({ ...base, aiRank: { checkedAt: at, steps: [], statusOf: { act_L12: 'expired' } } }, [s]);
    expect(later.map((x) => [x.key, x.state])).toEqual([[key, 'done']]);
  });
  it('the address rules (the safe fetcher\'s): https, no user name, no IP literal, a public host; L17 must be a Wikidata item', () => {
    expect(aiRankAddressCheck('www.linkedin.com/pulse/x')).toEqual({ url: 'https://www.linkedin.com/pulse/x' });
    expect(aiRankAddressCheck('http://news.example.org/a#top')).toEqual({ url: 'https://news.example.org/a' });
    for (const bad of ['', 'ftp://x.org/a', 'https://user:pw@x.org/', 'https://10.0.0.5/a', 'https://[::1]/', 'https://localhost/a', 'https://intranet/a', 'not a url at all']) expect('error' in aiRankAddressCheck(bad), bad).toBe(true);
    expect('error' in aiRankAddressCheck('https://www.linkedin.com/x', 'L17')).toBe(true);
    expect(aiRankAddressCheck('https://www.wikidata.org/wiki/Q42', 'L17')).toEqual({ url: 'https://www.wikidata.org/wiki/Q42' });
  });
  it('a page names the business by its website or a name on file (whole words)', () => {
    expect(aiRankPageNames('<p>We worked with <a href="https://www.novaand-demo.com/">them</a></p>', D, [])).toBe(true);
    expect(aiRankPageNames('<p>Thanks to Nova Partners for the project</p>', D, ['Nova Partners'])).toBe(true);
    expect(aiRankPageNames('<p>Supernova partnership news</p>', D, ['Nova Partners', 'No'])).toBe(false);
    expect(aiRankPageNames('<script>var x="novaand-demo.com"</script><p>nothing</p>', D, [])).toBe(false);   // text inside a script is not the page naming you
  });
  it('the guides tell the client to paste the address on the step', () => {
    for (const id of ['ai-rank-earned-mention', 'ai-rank-directory-profile', 'ai-rank-wikidata']) {
      const g = JSON.stringify(guideById(id));
      expect(g, id).toMatch(/field on the step/);
      expect(g, id).not.toMatch(/in Link building so we can see it/);
    }
  });
});

describe('RC-4: who may switch AI ranking on while it is rolling out', () => {
  it('the owner has not opened it to clients', () => expect(AI_RANK_OPEN_TO_CLIENTS).toBe(false));
  it('a company owner or admin may not set the mode or the reserve; a platform admin may; paid readings stay platform only', () => {
    expect(aiRankMayChange({ mode: 'on' }, false)).toBe(false);
    expect(aiRankMayChange({ mode: 'shadow' }, false)).toBe(false);
    expect(aiRankMayChange({ reserve: true }, false)).toBe(false);
    expect(aiRankMayChange({ fanoutN: 10 }, false)).toBe(false);
    expect(aiRankMayChange({}, false)).toBe(true);
    expect(aiRankMayChange({ mode: 'on', reserve: true, fanoutN: 10 }, true)).toBe(true);
  });
  it('the trial reads as Off to a client', () => {
    expect(aiRankClientMode('shadow')).toBe('off');
    expect(aiRankClientMode('on')).toBe('on');
  });
});

describe('RC-9: a save the engine did not keep is not "saved"', () => {
  it('compares what was sent with what is stored', () => {
    const stored = { mode: 'on' as const, reserve: false, fanoutN: 0, mentions: false, brave: false };
    expect(aiRankSaveKept({ mode: 'on' }, stored)).toBe(true);
    expect(aiRankSaveKept({ mode: 'on', reserve: true }, stored)).toBe(false);
    expect(aiRankSaveKept({ mode: 'on' }, undefined)).toBe(false);
    expect(aiRankSaveKept({ mode: 'shadow' }, { ...stored, mode: 'off' })).toBe(false);
  });
});

describe('RC-14: the client words for a lever win over the engine label', () => {
  it('aiRankActionOf', () => {
    expect(aiRankActionOf({ action_id: 'a', lever: 'L02', label: 'Content in raw HTML (server render)' }).label).toBe(AI_RANK_LEVER_LABELS.L02);
    expect(aiRankActionOf({ action_id: 'b', lever: 'L99', label: 'Something new' }).label).toBe('Something new');
  });
});
