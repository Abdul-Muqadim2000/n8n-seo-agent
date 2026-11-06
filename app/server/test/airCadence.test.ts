import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { cycleNorm } from '@seo/shared';
import { cadenceInputFromTables, planCadence, triggerOf, type CadenceTables } from '../src/services/cadence';

// AIR (2026-11-06, docs/ai-ranking-2026-11-05, package P6): the Content Cadence's AI-ranking rules (the reserved AI page slot, honouring a topic
// verdict for an AI question the client tracks, protecting pages AI answers cite). The engine's harness runs every case of ONE file through the real
// Cadence Plan node (harness/scenarios_air_exec.js AE1 / AE2); this suite runs the same cases through the app's mirror, so the Pipeline never
// promises (or hides) a page the engine would not write (or would). A website that is off, in shadow or stopped by the kill switch must plan
// exactly as it did before AIR existed.

const here = dirname(fileURLToPath(import.meta.url));
const FIXTURE = resolve(here, '../../../n8n/seo-agent/harness/air_cadence_cases.json');
const KF_FIXTURE = resolve(here, '../../../n8n/seo-agent/harness/fixtures/cadence_levels.json');

interface Case {
  name: string;
  level: number;
  now: string;
  trigger: Record<string, unknown>;
  tables: CadenceTables & Record<string, unknown>;
  expect: {
    picks: { keyword: string; source: string }[];
    suggestions: { keyword: string; source: string }[];
    waiting_for_keyword: boolean;
    refused: { keyword: string; reason: string }[];
    air: { reserved: string | null; honoured: string[]; protected: string[]; held?: { keyword: string; reason: string }[] } | null;
    same_as_stripped?: boolean;
    protect_reason?: string[];
    held_reason?: string[];
  };
}

const FX = JSON.parse(readFileSync(FIXTURE, 'utf8')) as { _doc: string; contract: string; cases: Case[] };
const KF = JSON.parse(readFileSync(KF_FIXTURE, 'utf8')) as { cases: Case[] };
const ks = (a: { keyword: string; source: string }[]) => a.map((x) => ({ keyword: x.keyword, source: x.source }));
const sortJ = (a: unknown[]) => a.map((x) => JSON.stringify(x)).sort();
const planOf = (c: Pick<Case, 'tables' | 'now' | 'trigger'>) => planCadence(cadenceInputFromTables(c.tables, { estPageUsd: 0.84 }), Date.parse(c.now), triggerOf(c.trigger));
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
const S = (v: unknown) => (v == null ? '' : String(v));
const AIR_COLS = ['ai_rank_mode', 'ai_rank_reserve', 'ai_rank_fanout_n', 'ai_rank_mentions', 'ai_rank_brave'];
const stripAir = <T extends Pick<Case, 'tables'>>(c: T): T => {
  const x = clone(c);
  for (const m of (x.tables.monitors ?? []) as Record<string, unknown>[]) for (const k of AIR_COLS) delete m[k];
  for (const r of [...(x.tables.ai_targets ?? []), ...(x.tables.ai_targets_writing ?? [])] as unknown as Record<string, unknown>[]) for (const k of ['origin', 'action_id', 'live_at']) delete r[k];
  x.tables.air_cache = [];
  return x;
};

describe('the shared AIR cadence cases (n8n/seo-agent/harness/air_cadence_cases.json)', () => {
  it('is the file the engine runs, names this mirror, and holds the 24 cases', () => {
    expect(FX._doc).toMatch(/cadence\.ts/);
    expect(FX.contract).toBe('app/server/src/services/cadence.ts');
    expect(FX.cases.length).toBe(24);
  });

  for (const c of FX.cases) {
    describe(c.name, () => {
      const p = planOf(c);
      it('picks, in order', () => expect(ks(p.picks)).toEqual(c.expect.picks));
      it('suggestions, in order', () => expect(ks(p.suggestions)).toEqual(c.expect.suggestions));
      it('waiting for the first keyword', () => expect(p.waitingForKeyword).toBe(c.expect.waiting_for_keyword));
      it('refused, with their reasons', () => expect(sortJ(p.refused.map((x) => ({ keyword: x.keyword, reason: x.reason })))).toEqual(sortJ(c.expect.refused)));
      it(`the effective level is ${c.level}`, () => expect(p.level).toBe(c.level));
      if (c.expect.air === null) it('no air facts (a website that is not on, or stopped by the kill switch)', () => expect(p.air).toBeUndefined());
      else
        it('the air facts: reserved, honoured, protected', () => {
          expect(p.air?.mode).toBe('on');
          expect(p.air?.reserved?.keyword ?? null).toBe(c.expect.air!.reserved);
          expect(p.air?.honoured.map((x) => x.keyword)).toEqual(c.expect.air!.honoured);
          expect(p.air?.protected.map((x) => x.keyword)).toEqual(c.expect.air!.protected);
          // FX-C RC-2: the AIR targets held because a page of this run already covers them
          if (c.expect.air!.held) {
            expect(p.air?.held.map((x) => ({ keyword: x.keyword, reason: x.reason }))).toEqual(c.expect.air!.held);
            for (const h of p.air?.held ?? []) expect(h.targetId).toBeTruthy();
          }
        });
      if (c.expect.air)
        it('no page address is written twice in one run (FX-C RC-2)', () => {
          const us = p.picks.map((x) => S(x.existingPageUrl).toLowerCase().replace(/^https?:\/\/(www\.)?/, '').replace(/\/+$/, '')).filter(Boolean);
          expect(new Set(us).size).toBe(us.length);
        });
      if (c.expect.held_reason)
        it('the suggestions held because this week already covers their page or search say why', () => {
          for (const k of c.expect.held_reason!) expect(p.suggestions.find((x) => x.keyword === k)?.why ?? '').toMatch(/already (rewrites|targets)/);
        });
      it('no internal id in any reason (FX-C RC-1)', () => {
        for (const x of [...p.picks, ...p.suggestions]) expect(x.why).not.toMatch(/\bair_[a-z0-9]|\baip_|\bait_/);
      });
      if (c.expect.protect_reason)
        it('the suggestions that rewrite a protected page say why', () => {
          for (const k of c.expect.protect_reason!) expect(p.suggestions.find((x) => x.keyword === k)?.why ?? '').toMatch(/AI answers cite this page/);
        });
      if (c.expect.same_as_stripped) it('identical to the same tables without any AIR column or row', () => expect(JSON.stringify(planOf(stripAir(c)))).toBe(JSON.stringify(p)));
      it('no refused keyword is written or suggested', () => {
        const refused = new Set(p.refused.map((x) => cycleNorm(x.keyword)));
        expect([...p.picks, ...p.suggestions].some((x) => refused.has(cycleNorm(x.keyword)))).toBe(false);
      });
      it('the plan output carries no internal field (target url, AIR markers)', () => {
        for (const x of [...p.picks, ...p.suggestions, ...p.candidates]) expect(Object.keys(x).some((k) => ['targetUrl', 'air', 'airHonoured', 'targetId'].includes(k))).toBe(false);
      });
    });
  }
});

describe('every keyword-first case plans exactly as before with AI ranking off, in shadow, empty, or on behind the kill switch', () => {
  for (const c0 of KF.cases) {
    it(c0.name, () => {
      const base = JSON.stringify(planOf(c0));
      const site = ((c0.tables.sites ?? [])[0] ?? {}) as { site_id?: string };
      const urls = [
        ...new Set(
          [
            ...((c0.tables.pages ?? []) as { url?: string }[]).map((x) => x.url),
            ...((c0.tables.query_history ?? []) as { page?: string }[]).map((x) => x.page),
            ...((c0.tables.ai_targets ?? []) as { page_url?: string }[]).map((x) => x.page_url),
            ...((c0.tables.ladders ?? []) as { target_url?: string }[]).map((x) => x.target_url),
          ].filter(Boolean),
        ),
      ];
      const protect = { key: `air:protect:${site.site_id}`, kind: 'air', site_id: '', value: JSON.stringify({ urls: urls.map((u) => ({ url: u, until: '2099-01-01T00:00:00.000Z', why: 'test' })) }) };
      for (const [mode, kill] of [['off', false], ['shadow', false], ['on', true], ['', false]] as const) {
        const c = clone(c0);
        c.tables.air_cache = [protect, ...(kill ? [{ key: 'air:kill', kind: 'air', site_id: '', value: '1' }] : [])];
        for (const m of (c.tables.monitors ?? []) as Record<string, unknown>[]) Object.assign(m, { ai_rank_mode: mode, ai_rank_reserve: true });
        for (const t of (c.tables.ai_targets ?? []) as unknown as Record<string, unknown>[]) Object.assign(t, { origin: 'ai_rank', action_id: 'air_x_L05_00000000' });
        expect(JSON.stringify(planOf(c)), `${c0.name} (${mode || 'empty'}${kill ? ', killed' : ''})`).toBe(base);
      }
    });
  }
});
