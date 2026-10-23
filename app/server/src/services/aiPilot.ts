// W2-FIX (2026-10-23, n8n/seo-agent/docs/ai-visibility-2026-10-23/fixes/W2-FIX.md item 2): the AI repeat pilot from the app. The engine's door
// (SEOagentAIPilAPI, POST /webhook/seo-ai-pilot) starts SEOagentAIPilot1; without `confirm: true` the pilot only prices itself and posts the quote
// (callback stage ai_pilot_quote, stored as a report like every callback); with it, it asks 10 questions 10 times on each engine that answers anew
// (at most $4, once) and posts the result (stage ai_pilot). Nothing here runs on its own: a person asks for the price, reads it, and confirms.
// The confirmation is accepted only against a fresh quote that says the pilot can run, and only when the company's credits cover the price; the
// engine's own run guard refuses a second pilot of the same website while one is in flight (mode ai_pilot), and its ledger row is what the
// credits are charged from (costSync, by the website's domain).
import { and, desc, eq } from 'drizzle-orm';
import type { AiPilotQuote, AiPilotResult, AiPilotState } from '@seo/shared';
import { db, schema } from '../db';
import type { OrgRow, ReportRow, SiteRow, UserRow } from '../db/schema';
import { suspendedError } from '../auth/session';
import { conflict, forbidden, HttpError } from '../lib/errors';
import { aiPilotRun } from '../n8n/client';
import { callbackUrl } from './runs';

/** A quote can be confirmed this long after it arrived (the panel, its engines or the prices may change after it). */
export const AI_PILOT_QUOTE_HOURS = 24;

const o = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const n = (v: unknown): number => (Number.isFinite(Number(v)) ? Number(v) : 0);
const s = (v: unknown): string => (v == null ? '' : String(v));

/** The quote callback as the app shows it. */
export function pilotQuoteOf(r: Pick<ReportRow, 'requestId' | 'receivedAt' | 'payload'>): AiPilotQuote {
  const p = o(r.payload), q = o(p.quote);
  return {
    requestId: r.requestId ?? null,
    receivedAt: r.receivedAt.toISOString(),
    canConfirm: p.can_confirm === true,
    reason: s(p.reason).slice(0, 500),
    questions: n(q.questions),
    repeats: n(q.repeats),
    engines: Array.isArray(q.engines) ? q.engines.map(s).slice(0, 12) : [],
    requests: n(q.requests),
    priceUsd: Math.round(n(q.price_usd) * 10000) / 10000,
    maxUsd: n(q.max_usd),
    note: s(q.note).slice(0, 800),
  };
}

/** The pilot's result callback: per engine, the asks per question a week it needs (null = ask more questions instead). */
export function pilotResultOf(r: Pick<ReportRow, 'id' | 'requestId' | 'receivedAt' | 'payload'>): AiPilotResult {
  const pr = o(o(r.payload).pilot), be = o(pr.by_engine);
  return {
    requestId: r.requestId ?? null,
    receivedAt: r.receivedAt.toISOString(),
    reportId: r.id,
    note: s(pr.note).slice(0, 800),
    byEngine: Object.entries(be).slice(0, 12).map(([engine, v]) => {
      const x = o(v);
      return { engine, rate: x.rate == null ? null : n(x.rate), repeats: x.repeats == null ? null : n(x.repeats), answers: n(x.answers), why: s(x.why).slice(0, 300) };
    }),
  };
}

export async function aiPilotState(org: Pick<OrgRow, 'id'>, site: Pick<SiteRow, 'id'>): Promise<AiPilotState> {
  const latest = (stage: string) =>
    db.query.reports.findFirst({ where: and(eq(schema.reports.orgId, org.id), eq(schema.reports.siteId, site.id), eq(schema.reports.stage, stage)), orderBy: desc(schema.reports.receivedAt) });
  const [q, r] = await Promise.all([latest('ai_pilot_quote'), latest('ai_pilot')]);
  return { quote: q ? pilotQuoteOf(q) : null, result: r ? pilotResultOf(r) : null, quoteValidHours: AI_PILOT_QUOTE_HOURS };
}

/** Why a confirmation is refused, or null when the quote may be confirmed now. */
export function confirmRefusal(quote: AiPilotQuote | null, now = Date.now()): string | null {
  if (!quote) return 'Ask for the price first: the pilot is confirmed against the price the engine quoted.';
  if (!quote.canConfirm) return quote.reason || 'The last price says the pilot cannot run for this website.';
  if (now - Date.parse(quote.receivedAt) > AI_PILOT_QUOTE_HOURS * 3_600_000) return `The price is more than ${AI_PILOT_QUOTE_HOURS} hours old: ask for it again.`;
  if (!(quote.priceUsd > 0)) return 'The price could not be read: ask for it again.';
  return null;
}

export async function startAiPilot(org: OrgRow, user: Pick<UserRow, 'suspendedAt'>, site: SiteRow, confirm: boolean): Promise<{ requestId: string; confirm: boolean; priceUsd: number | null }> {
  // the same as a run: a disabled company or a suspended person starts nothing
  if (org.disabled) throw forbidden('This company is disabled. Contact the platform administrator.');
  if (user.suspendedAt) throw suspendedError();
  const requestId = `app-aipilot-${Date.now().toString(36)}`;
  let price: number | null = null;
  if (confirm) {
    const { quote } = await aiPilotState(org, site);
    const why = confirmRefusal(quote);
    if (why) throw conflict(why, 'pilot_not_quoted');
    price = quote!.priceUsd;
    // the same money checks as a run (services/runs.ts createRunWithMeta), under the company's lock. Loaded here, not at the top: the routes
    // file imports this module, and the money modules build SQL from the schema at import time (route tests mock the schema)
    const [{ assertCredits }, { assertBudget, assertPlatformCapacity, lockCompany }] = await Promise.all([import('./billing'), import('./spend')]);
    await db.transaction(async (tx) => {
      await lockCompany(tx, org.id);
      if (!org.creditsEnforced) await assertBudget(tx, org, price!, 'The AI repeat pilot');
      else await assertPlatformCapacity(tx, price!);
      await assertCredits(tx, org, price!, 'The AI repeat pilot');
    });
  }
  const r = await aiPilotRun({ domain: site.domain, confirm, callback_url: callbackUrl(org), request_id: requestId });
  if (!r.ok) throw new HttpError(502, r.error || 'The AI repeat pilot did not start.');
  return { requestId, confirm, priceUsd: price };
}
