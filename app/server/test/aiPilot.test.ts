import { beforeEach, describe, expect, it, vi } from 'vitest';

// W2-FIX (2026-10-23): the AI repeat pilot from the app. A price request starts the engine's pilot with confirm false and spends nothing; a
// confirmation needs a fresh quote that says the pilot can run, passes the company's money checks, and only then sends confirm true. The quote
// and the result are read back from the callbacks the engine posted (stored reports).

const st = vi.hoisted(() => ({
  reports: {} as Record<string, Record<string, unknown> | undefined>,
  sent: [] as Record<string, unknown>[],
  money: [] as string[],
  creditsOk: true,
  calls: 0,
}));

vi.mock('../src/n8n/client', () => ({ aiPilotRun: vi.fn(async (b: Record<string, unknown>) => { st.sent.push(b); return { ok: true, requestId: String(b.request_id), error: null }; }) }));
vi.mock('../src/db', async (orig) => ({
  ...(await orig<typeof import('../src/db')>()),
  db: {
    // aiPilotState reads the latest quote, then the latest result (in that order)
    query: { reports: { findFirst: vi.fn(async () => st.reports[st.calls++ % 2 === 0 ? 'ai_pilot_quote' : 'ai_pilot']) } },
    transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn({}),
  },
}));
vi.mock('../src/services/spend', () => ({
  lockCompany: vi.fn(async () => { st.money.push('lock'); }),
  assertBudget: vi.fn(async () => { st.money.push('budget'); }),
  assertPlatformCapacity: vi.fn(async () => { st.money.push('platform'); }),
}));
vi.mock('../src/services/billing', () => ({
  assertCredits: vi.fn(async (_tx: unknown, _org: unknown, usd: number) => { st.money.push('credits:' + usd); if (!st.creditsOk) throw Object.assign(new Error('Not enough credits'), { statusCode: 402 }); return 5; }),
}));
vi.mock('../src/services/runs', () => ({ callbackUrl: () => 'https://api.example.com/api/hooks/n8n/tok' }));

const { confirmRefusal, pilotQuoteOf, pilotResultOf, startAiPilot, AI_PILOT_QUOTE_HOURS } = await import('../src/services/aiPilot');

const org = { id: 'org1', disabled: false, creditsEnforced: true } as never;
const user = { suspendedAt: null };
const site = { id: 'site1', domain: 'northwind-erp.com' } as never;
const quoteRow = (o: Record<string, unknown> = {}, at = new Date()) => ({
  id: 'r1', requestId: 'app-aipilot-1', receivedAt: at,
  payload: { stage: 'ai_pilot_quote', can_confirm: true, reason: 'priced, not run: start it again with confirm: true to spend about $1.20', quote: { questions: 10, repeats: 10, engines: ['chatgpt', 'gemini', 'ai_mode'], requests: 300, price_usd: 1.2, max_usd: 4, note: 'The pilot asks 10 of your questions' }, ...o },
});

beforeEach(() => { st.reports = {}; st.sent = []; st.money = []; st.creditsOk = true; st.calls = 0; });

describe('reading the callbacks', () => {
  it('a quote: price, engines, requests, whether it can be confirmed', () => {
    expect(pilotQuoteOf(quoteRow() as never)).toMatchObject({ requestId: 'app-aipilot-1', canConfirm: true, questions: 10, repeats: 10, engines: ['chatgpt', 'gemini', 'ai_mode'], requests: 300, priceUsd: 1.2, maxUsd: 4 });
  });
  it('a result: the asks per question a week per engine (null = more questions instead)', () => {
    const r = pilotResultOf({ id: 'r2', requestId: 'x', receivedAt: new Date(), payload: { pilot: { note: 'n', by_engine: { chatgpt: { rate: 40, repeats: 3, answers: 100, why: 'w' }, gemini: { rate: 10, repeats: null, answers: 100, why: '' } } } } } as never);
    expect(r.byEngine).toEqual([{ engine: 'chatgpt', rate: 40, repeats: 3, answers: 100, why: 'w' }, { engine: 'gemini', rate: 10, repeats: null, answers: 100, why: '' }]);
  });
  it('a confirmation is refused without a quote, on a quote that cannot run, on a stale one', () => {
    expect(confirmRefusal(null)).toMatch(/price first/);
    expect(confirmRefusal(pilotQuoteOf(quoteRow({ can_confirm: false, reason: 'the panel holds 2 question(s): the pilot needs at least 3' }) as never))).toMatch(/at least 3/);
    expect(confirmRefusal(pilotQuoteOf(quoteRow({}, new Date(Date.now() - (AI_PILOT_QUOTE_HOURS + 1) * 3_600_000)) as never))).toMatch(/hours old/);
    expect(confirmRefusal(pilotQuoteOf(quoteRow() as never))).toBeNull();
  });
});

describe('starting it', () => {
  it('a price request sends confirm false and checks no money', async () => {
    const r = await startAiPilot(org, user, site, false);
    expect(st.sent).toEqual([{ domain: 'northwind-erp.com', confirm: false, callback_url: 'https://api.example.com/api/hooks/n8n/tok', request_id: r.requestId }]);
    expect(st.money).toEqual([]);
  });
  it('a confirmation without a quote starts nothing', async () => {
    await expect(startAiPilot(org, user, site, true)).rejects.toMatchObject({ statusCode: 409 });
    expect(st.sent).toEqual([]);
  });
  it('a confirmation of a fresh quote checks the credits for its price, then sends confirm true', async () => {
    st.reports.ai_pilot_quote = quoteRow();
    const r = await startAiPilot(org, user, site, true);
    expect(st.money).toEqual(['lock', 'platform', 'credits:1.2']);
    expect(st.sent).toHaveLength(1);
    expect(st.sent[0]).toMatchObject({ confirm: true, domain: 'northwind-erp.com' });
    expect(r.priceUsd).toBe(1.2);
  });
  it('credits that do not cover the price: nothing is sent', async () => {
    st.reports.ai_pilot_quote = quoteRow();
    st.creditsOk = false;
    await expect(startAiPilot(org, user, site, true)).rejects.toThrow(/credits/);
    expect(st.sent).toEqual([]);
  });
  it('a suspended person or a disabled company starts nothing', async () => {
    await expect(startAiPilot(org, { suspendedAt: new Date() } as never, site, false)).rejects.toMatchObject({ statusCode: 403 });
    await expect(startAiPilot({ ...(org as object), disabled: true } as never, user, site, false)).rejects.toMatchObject({ statusCode: 403 });
    expect(st.sent).toEqual([]);
  });
});
