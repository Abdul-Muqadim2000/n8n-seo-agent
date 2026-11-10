// LADDER PACKAGE (2026-11-09, n8n/seo-agent/docs/keyword-intel-2026-11-08/fixes/LADDER.md): the ladder rules the engine applies, for the app.
//
// The rules themselves are the engine's kit (n8n/seo-agent/v5/code/_ladder_rules.js), written unchanged to ladder-rules.generated.js by
// build_v4.py (ladder_rules_app.py); ladder-rules.parity.test.ts fails while it is stale. This module re-exports it with types and adds what
// the app does with it:
//   * ladderMarket()   the market a new keyword ladder is measured in (the website's market, or the market the keyword names), with the
//                      warning the "New keyword ladder" flow shows before a change and what the server sends to the engine;
//   * rungReason()     per rung of a ladder: its address and why (new page / improve your page / stopped / failed / merged / waiting);
//   * stuckRung()      the stuck-rung rule of the app's watcher (services/ladderWatch.ts).

import { COUNTRIES } from './constants';
import { LRU } from './ladder-rules.generated.js';
import type { LadderMarket, LadderRungState, LadderStuck } from './ladder-rules.generated.js';

export { LRU };
export type { LadderMarket, LadderRungState, LadderStuck, LadderStage, LadderVerdictStop, LadderOwner } from './ladder-rules.generated.js';

const isoOf = (country: string | null | undefined): string => {
  const s = String(country ?? '').trim();
  return COUNTRIES.find((c) => c.name.toLowerCase() === s.toLowerCase() || c.iso === s.toUpperCase())?.iso ?? '';
};

export interface LadderMarketCheck extends LadderMarket {
  /** the country name the run is sent with (the lock), or the requested one when the client confirmed another market */
  sendCountry: string;
  /** true when the client must confirm before the ladder is measured elsewhere than the lock (a keyword naming no place) */
  needsConfirm: boolean;
  /** the plain sentence the flow shows before the change ('' when nothing changes) */
  warning: string;
}

/**
 * The market of a new keyword ladder (rule 3): the website's market, or the market the keyword names ("gcc", "uae", "dubai" -> UAE),
 * never another country. `requested` is the country the form holds. A keyword that names places is always sent in its own market (the
 * engine refuses anything else before it spends); a keyword that names none is sent in the website's market unless the client confirms
 * (`marketAck`) that it wants another one.
 */
export function ladderMarket(o: { keyword: string; siteCountry?: string | null; requested?: string | null; marketAck?: boolean }): LadderMarketCheck {
  const m = LRU.market({ keyword: o.keyword, site_iso: isoOf(o.siteCountry), request_iso: isoOf(o.requested) });
  const named = m.named.length > 0;
  const reqName = LRU.countryName(isoOf(o.requested)) || String(o.requested ?? '');
  const confirmable = !named && m.source === 'site' && !!m.request_iso && !m.ok;
  const send = m.ok || !m.request_iso ? m.country : confirmable && o.marketAck ? reqName : m.country;
  const warning = m.ok || !m.request_iso
    ? ''
    : named
      ? `"${o.keyword}" names ${m.named.join(', ')}, so this ladder is measured in ${m.country}, not in ${reqName}.`
      : `Your website's market is ${m.country}. Measuring "${o.keyword}" in ${reqName} plans pages for searches people make there.${o.marketAck ? '' : ' Confirm that this is what you want.'}`;
  return { ...m, sendCountry: send, needsConfirm: confirmable && !o.marketAck, warning };
}

/** Per rung of a ladder: its address and why, from the stored row (the engine's own reason when it gave one). */
export function rungReason(row: Record<string, unknown>, next?: string): LadderRungState {
  return LRU.rungState(row, next ? { next } : {});
}

/** The stuck-rung rule (rule 5): writing or started for longer than three times its expected time (at least 60 minutes) with nothing alive. */
export function stuckRung(o: { status: string; since: string; etaMinutes?: number | null; live: boolean | null; now: number }): LadderStuck {
  return LRU.stuck({ status: o.status, since: o.since, eta_minutes: o.etaMinutes ?? null, live: o.live, now: o.now });
}
