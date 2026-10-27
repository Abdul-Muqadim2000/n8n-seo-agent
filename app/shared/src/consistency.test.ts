import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { COUNTRIES } from './constants';
import { CONSISTENCY_CHECKS, consistencyWarnings, needsAcknowledge, overriddenCodes, type ConsistencyCtx } from './consistency';
import { countryOfCode, marketMismatch, marketsNamed, placesIn, scriptOf, withoutPlaces } from './markets';
import { fitGate, fitMarket } from './fit-gate';

// MKT (2026-10-27, n8n/seo-agent/docs/mismatch-audit-2026-10-27/AUDIT.md): the one mismatch mechanism, with the production facts that drove
// it as fixtures. devaicon.com: website country Pakistan, the engine measuring the UAE (location 2784), the ladder keyword
// "ai automation solutions gcc", a description that says "clients across the UAE, GCC, and beyond", and AI questions about Dubai.

const here = dirname(fileURLToPath(import.meta.url));
const DEVAICON = {
  domain: 'devaicon.com',
  country: 'Pakistan',
  business: 'AI automation and software development for businesses, with clients across the UAE, GCC, and beyond.',
  customers: 'Mid-size companies that want to automate their operations',
  businessFacts: '',
  services: ['AI automation', 'Custom software development'],
  cta: 'Book a call',
  timezone: 'Asia/Karachi',
};
const API = '/api/orgs/org-1/sites/site-1';
const ctx = (over: Partial<ConsistencyCtx> = {}): ConsistencyCtx => ({ site: DEVAICON, siteApi: API, tracked: true, ...over });
const codes = (w: { code: string }[]) => w.map((x) => x.code);

describe('the gazetteer (the engine kit, one table)', () => {
  it('reads places, regions and their countries', () => {
    expect(placesIn('ai automation solutions gcc').map((p) => [p.word, p.iso.includes('AE'), p.iso.includes('PK')])).toEqual([['gcc', true, false]]);
    expect(placesIn('best erp software in abu dhabi').map((p) => p.word)).toEqual(['abu dhabi']);
    expect(placesIn('seo company in lahore pakistan').map((p) => p.iso[0])).toEqual(['PK', 'PK']);
    expect(placesIn('u.a.e vat registration').map((p) => p.word)).toEqual(['uae']);
    expect(placesIn('erp software for us companies')).toEqual([]);   // never the bare word "us"
    expect(placesIn('spanish translation services online')).toEqual([]);   // a language is not a place
    expect(placesIn('استشارات الذكاء الاصطناعي في دبي').map((p) => p.word)).toEqual(['dubai']);   // Arabic, through the kit's glossary
  });

  it('decides the market of a keyword (the audit fixtures)', () => {
    expect(marketMismatch('ai automation solutions gcc', 'PK')).toBe(true);
    expect(marketMismatch('ai automation services in pakistan', 'PK')).toBe(false);
    expect(marketMismatch('ai consulting dubai', 'AE')).toBe(false);
    expect(marketMismatch('erp software gcc', 'AE')).toBe(false);   // a region that contains the market
    expect(marketMismatch('ai automation services', 'PK')).toBe(false);   // no place
    expect(marketMismatch('hyderabad software house', 'PK')).toBe(false);   // a city of two countries
    expect(fitMarket('ai automation solutions gcc', 'PK').without).toBe('ai automation solutions');
    expect(withoutPlaces('erp software in dubai', ['dubai'])).toBe('erp software');
  });

  it('weighs the countries a text names, a region for each member', () => {
    const m = marketsNamed([{ text: DEVAICON.business }]);
    expect(m[0]!.iso).toBe('AE');   // "UAE" + "GCC"
    expect(m.map((x) => x.iso)).toContain('SA');
  });

  it('knows scripts', () => {
    expect(scriptOf('برنامج محاسبة').script).toBe('arabic');
    expect(scriptOf('erp software').script).toBe('');
  });
});

describe('the engine fit gate with the website market (ctx.market)', () => {
  it('refuses a keyword of another market, keeps the market\'s own and the client\'s chosen keyword', () => {
    expect(fitGate('ai automation solutions gcc', { market: 'PK' })).toMatchObject({ ok: false, reason: 'other market' });
    expect(fitGate('ai automation services in pakistan', { market: 'PK' }).ok).toBe(true);
    expect(fitGate('ai consulting dubai', { market: 'AE' }).ok).toBe(true);
    expect(fitGate('ai automation solutions gcc', { market: 'PK', protect: ['ai automation solutions gcc'] }).ok).toBe(true);
    expect(fitGate('ai automation solutions gcc', {}).ok).toBe(true);   // no market given: the gate is unchanged
  });
});

describe('COUNTRIES is the engine\'s table (location codes and languages)', () => {
  it('matches Normalize Input', () => {
    const NI = readFileSync(join(here, '../../../n8n/seo-agent/harness/code_v4/Normalize_Input.js'), 'utf8');
    const engine = [...NI.matchAll(/'([A-Za-z ]+)':\s*\{ code: (\d+), iso: '([A-Z]{2})', lang: '([a-z]{2})'/g)].map((m) => ({ name: m[1], code: Number(m[2]), iso: m[3], lang: m[4] }));
    expect(engine.length).toBe(COUNTRIES.length);
    expect(COUNTRIES.map((c) => ({ name: c.name, code: c.code, iso: c.iso, lang: c.lang }))).toEqual(engine);
    expect(countryOfCode(2784)?.name).toBe('United Arab Emirates');
  });
});

describe('M1 a run sent with another country than the website\'s', () => {
  it('flags it, offers the website\'s country, and is answered by acknowledging its id', () => {
    const w = consistencyWarnings('run', { mode: 'ladder', keyword: 'ai automation services', country: 'United Arab Emirates', siteId: 'site-1' }, ctx());
    const m1 = w.find((x) => x.code === 'market.run_country')!;
    expect(m1).toMatchObject({ id: 'market.run_country:AE:PK', severity: 'market', tone: 'warning', accept: { change: { kind: 'fields', set: { country: 'Pakistan' } } } });
    expect(m1.message).toContain('United Arab Emirates');
    expect(needsAcknowledge(w).map((x) => x.id)).toContain(m1.id);
    expect(needsAcknowledge(w, [m1.id]).map((x) => x.id)).not.toContain(m1.id);
    expect(overriddenCodes(w, [m1.id])).toEqual({ ids: [m1.id], codes: ['market.run_country'] });
  });

  it('a track request in another country says it moves every weekly check', () => {
    const w = consistencyWarnings('run', { mode: 'track', country: 'United Arab Emirates', keywords: [] }, ctx());
    expect(w.find((x) => x.code === 'market.run_country')!.body).toContain('every weekly check');
  });

  it('the same country, a profile run (its country is the address) and no website are clean', () => {
    expect(codes(consistencyWarnings('run', { mode: 'audit', country: 'Pakistan' }, ctx()))).toEqual([]);
    expect(codes(consistencyWarnings('run', { mode: 'profile', country: 'United Arab Emirates' }, ctx()))).toEqual([]);
    expect(codes(consistencyWarnings('run', { mode: 'verdict', keyword: 'erp', country: 'Germany' }, ctx({ site: null })))).toEqual([]);
  });
});

describe('M4 a keyword naming a place outside the market', () => {
  it('devaicon: Pakistan website + "ai automation solutions gcc" is flagged, Accept drops the place', () => {
    const w = consistencyWarnings('run', { mode: 'ladder', keyword: 'ai automation solutions gcc', country: 'Pakistan' }, ctx());
    expect(w.map((x) => x.id)).toEqual(['market.keyword_place:ai automation solutions gcc:PK']);
    expect(w[0]!.title).toBe('"ai automation solutions gcc" is a search about the GCC, not about Pakistan');
    expect(w[0]!.accept).toEqual({ label: 'Use "ai automation solutions"', change: { kind: 'fields', set: { keyword: 'ai automation solutions' } } });
  });

  it('Pakistan website + "ai automation services in pakistan" is clean; UAE website + "dubai" is clean', () => {
    expect(consistencyWarnings('run', { mode: 'ladder', keyword: 'ai automation services in pakistan', country: 'Pakistan' }, ctx())).toEqual([]);
    const uae = ctx({ site: { ...DEVAICON, domain: 'techand.ai', country: 'United Arab Emirates', business: 'ERP partner in the UAE' } });
    expect(consistencyWarnings('run', { mode: 'keyword', keyword: 'erp partner dubai', country: 'United Arab Emirates', receiveContent: true }, uae)).toEqual([]);
    expect(consistencyWarnings('keyword_check', { keyword: 'dubai erp consultants' }, uae)).toEqual([]);
  });

  it('a market the product cannot measure says so; the keyword check and the keywords to watch are checked too', () => {
    const uae = ctx({ site: { ...DEVAICON, country: 'United Arab Emirates' } });
    const q = consistencyWarnings('keyword_check', { keyword: 'erp software qatar' }, uae);
    expect(q[0]).toMatchObject({ code: 'market.keyword_unsupported' });
    expect(q[0]!.body).toContain('cannot measure rankings in Qatar');
    const t = consistencyWarnings('run', { mode: 'track', country: 'Pakistan', keywords: ['open edx provider', 'ai automation gcc'] }, ctx());
    expect(t.map((x) => x.code)).toEqual(['market.keyword_place']);
    expect(t[0]!.accept!.change).toEqual({ kind: 'fields', set: { keywords: ['open edx provider', 'ai automation'] } });
  });
});

describe('M8 a keyword in another script than the market reads', () => {
  it('flags an Arabic keyword on an English market and offers its English reading', () => {
    const uae = ctx({ site: { ...DEVAICON, country: 'United Arab Emirates' } });
    const w = consistencyWarnings('keyword_check', { keyword: 'استشارات الذكاء الاصطناعي في دبي' }, uae);
    expect(w.map((x) => x.code)).toEqual(['lang.script']);
    expect(w[0]!.accept!.change).toEqual({ kind: 'fields', set: { keyword: 'consulting ai dubai' } });
  });
});

describe('M5 the description names other markets than the main country', () => {
  it('devaicon: Pakistan with "clients across the UAE, GCC" is flagged; Accept makes the UAE the main country', () => {
    const w = consistencyWarnings('site_standing', {}, ctx());
    const m5 = w.find((x) => x.code === 'market.business_text')!;
    expect(m5.title).toBe('Your description talks about the UAE and the GCC, but your main country is Pakistan');
    expect(m5.accept).toEqual({ label: 'Make United Arab Emirates my main country', change: { kind: 'call', method: 'PATCH', path: API, body: { country: 'United Arab Emirates' } } });
    // on the save itself the correction is a field of the same request
    const s = consistencyWarnings('site_update', { business: DEVAICON.business }, ctx());
    expect(s.find((x) => x.code === 'market.business_text')!.accept!.change).toEqual({ kind: 'fields', set: { country: 'United Arab Emirates' } });
    // the id embeds the facts: the same text keeps the same id, a new country or new words get a new one
    expect(m5.id).toBe(consistencyWarnings('site_update', {}, ctx()).find((x) => x.code === 'market.business_text')!.id);
    expect(consistencyWarnings('site_update', { business: 'Software for Pakistani companies, also the UAE' }, ctx()).map((x) => x.code)).not.toContain('market.business_text');
  });

  it('the address ending and the time zone are information only', () => {
    const w = consistencyWarnings('site_standing', {}, ctx({ site: { ...DEVAICON, domain: 'devaicon.ae', business: 'Software', timezone: 'Asia/Dubai' } }));
    expect(w.map((x) => [x.code, x.tone])).toEqual([
      ['market.domain_ending', 'info'],
      ['market.timezone', 'info'],
    ]);
    expect(needsAcknowledge(w)).toEqual([]);
  });
});

describe('M2 the engine measures another market', () => {
  it('devaicon: the engine row says UAE (2784), the website Pakistan; Accept calls the market sync', () => {
    const w = consistencyWarnings('site_standing', {}, ctx({ site: { ...DEVAICON, business: 'Software' }, engine: { country: 'United Arab Emirates', locationCode: 2784, languageCode: 'en' } }));
    expect(w.map((x) => x.id)).toEqual(['market.engine_drift:AE:PK']);
    expect(w[0]!.accept!.change).toEqual({ kind: 'call', method: 'POST', path: `${API}/market/sync` });
    expect(w[0]!.body).toContain('stays in your history');
  });

  it('a country change on a tracked website is announced (information), with the ladders that stay', () => {
    const w = consistencyWarnings('site_update', { country: 'United Arab Emirates' }, ctx({ site: { ...DEVAICON, business: 'Software' }, ladders: [{ id: 'lad_1', head: 'ai automation solutions gcc', country: 'Pakistan' }] }));
    const c = w.find((x) => x.code === 'market.country_change')!;
    expect(c.tone).toBe('info');
    expect(c.body).toContain('Your 1 keyword ladder keep Pakistan');
  });
});

describe('M3 / M6 / M7 standing market checks', () => {
  it('a ladder in another country, suggestions researched elsewhere, AI questions about Dubai', () => {
    const w = consistencyWarnings(
      'site_standing',
      {},
      ctx({
        site: { ...DEVAICON, business: 'Software' },
        ladders: [{ id: 'lad_1', head: 'ai automation solutions gcc', country: 'United Arab Emirates' }],
        research: { country: 'United Arab Emirates' },
        aiPrompts: [
          { promptId: 'p1', prompt: 'Which companies offer AI automation in Dubai?', status: 'active' },
          { promptId: 'p2', prompt: 'Best AI automation agency in Abu Dhabi or Sharjah', status: 'active' },
          { promptId: 'p3', prompt: 'How do I automate invoicing with AI?', status: 'active' },
        ],
      }),
    );
    expect(codes(w)).toEqual(['market.ladder_country', 'market.research_country', 'ai.question_place']);
    expect(w[0]!.accept!.change).toEqual({ kind: 'call', method: 'POST', path: `${API}/ladders/lad_1/market` });
    expect(w[1]!.accept!.change).toEqual({ kind: 'link', tool: 'discover' });
    expect(w[2]!.accept!.change).toEqual({ kind: 'call', method: 'POST', path: `${API}/admin`, body: { action: 'ai_prompts', remove: ['p1', 'p2'] } });
  });

  it('a new AI question about another market: Accept leaves it out of what is added', () => {
    const add = ['Which AI automation firms work in Dubai?', 'Which AI automation firms work in Lahore?'];
    const w = consistencyWarnings('ai_questions', { add }, ctx());
    expect(w).toHaveLength(1);
    expect(w[0]!.accept!.change).toEqual({ kind: 'fields', set: { add: [add[1]] } });
  });
});

describe('the registry', () => {
  it('every check has a code, a severity and at least one action; every warning has the fields API callers read', () => {
    for (const c of CONSISTENCY_CHECKS) {
      expect(c.code).toMatch(/^[a-z]+(\.[a-z_]+)?$/);
      expect(c.on.length).toBeGreaterThan(0);
    }
    const all = consistencyWarnings('site_standing', {}, ctx({ engine: { locationCode: 2784 } }));
    for (const w of all) {
      expect(w.id.startsWith(`${w.code}:`)).toBe(true);
      expect(w.message.startsWith(w.title)).toBe(true);
      // customer copy: no em dash, no curly quotes, no ellipsis character
      expect(w.message).not.toMatch(/[—‘’“”…]/);
      if (w.tone === 'warning') expect(w.confirm).toBeTruthy();
    }
  });

  it('the forms\' duplicate warnings are one producer of the same list, with their ids unchanged', () => {
    const pipeline = {
      activeRuns: [{ id: 'run-1', mode: 'ladder', keyword: 'ai automation services', createdAt: '2026-10-27T08:00:00Z' }],
      automations: [],
      running: [],
      written: [],
      ladders: [],
      queue: { next: [], later: [], waiting: [], pagesPerWeek: 0 },
      automation: { maxWaiting: 3 },
    } as unknown as ConsistencyCtx['pipeline'];
    const w = consistencyWarnings('run', { mode: 'ladder', keyword: 'ai automation services', country: 'Pakistan' }, ctx({ pipeline }));
    expect(w.map((x) => [x.id, x.code, x.severity])).toEqual([['active:run-1', 'pipeline.active', 'money']]);
  });
});
