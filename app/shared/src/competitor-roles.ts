// CR17-F (2026-11-17, client report C5): ONE answer to "is this site a competitor?", for every screen and the engine.
//
// The classifier is the engine's kit (n8n/seo-agent/v5/code/_competitors.js, CMP), written unchanged to competitor-roles.generated.js by
// build_v4.py (competitor_roles_app.py); competitor-roles.parity.test.ts fails while it is stale. This module re-exports it with types and adds
// what the app does with it:
//   * competitorRole()          the role of one site for a website (its services name the platform it builds on; the client's own choices win)
//   * competitorList()          THE competitor list of a website: Site settings + the Competitors page choices - not a competitor
//   * splitAiNamed()            AI visibility: the businesses AI recommends instead of you vs the software makers and platforms it names
//   * leftOutWords()            the Link Builder's left-out reason for a stored reason code, in plain words
//   * isRetiredProspect()       a link prospect whose AI question was retired (kept, never offered)

import { CMP } from './competitor-roles.generated.js';
import type { CompetitorLeftOut, CompetitorRole, CompetitorRoleContext, CompetitorRoleResult } from './competitor-roles.generated.js';

export { CMP };
export type { CompetitorLeftOut, CompetitorRole, CompetitorRoleContext, CompetitorRoleResult, CompetitorOneList } from './competitor-roles.generated.js';

/** What a website tells the classifier: its domain, its services, and the client's own choices. */
export interface CompetitorSiteContext {
  domain: string;
  services?: readonly string[];
  chosen?: readonly string[];
  declared?: readonly string[];
  notCompetitors?: readonly string[];
}

const ctxOf = (site: CompetitorSiteContext): CompetitorRoleContext => ({
  own_domain: site.domain,
  services: site.services ?? [],
  chosen: site.chosen ?? [],
  declared: site.declared ?? [],
  not_competitors: site.notCompetitors ?? [],
});

/** The one role of `host` for this website. */
export function competitorRole(host: string, site: CompetitorSiteContext): CompetitorRoleResult {
  return CMP.role(host, ctxOf(site));
}

/** The roles a client can read, in words (no internal ids). */
export const COMPETITOR_ROLE_LABELS: Record<CompetitorRole, string> = {
  competitor: 'Competitor',
  listing: 'Directory or list',
  also_ranks: 'Platform or publisher',
  authority: 'Government or public body',
  software: 'Software maker',
  your_platform: 'Platform you work with',
  not_competitor: 'Not a competitor',
  you: 'Your website',
  unknown: 'Unknown',
};

/** THE competitor list of a website (the monitors read the same rule, CMP.oneList in _monitor_sites.js). */
export function competitorList(o: {
  domain: string;
  declared: readonly string[];
  /** FX-LINKS (review R2 M3): `market` and `updatedAt` let the client's latest decision on a domain win, whichever row holds it */
  kiRows: readonly { compDomain: string; status: string; statusBy?: string; market?: string; updatedAt?: string }[];
  notCompetitors: readonly string[];
  max?: number;
}): { list: string[]; removed: string[]; chosen: string[] } {
  const r = CMP.oneList({
    own_domain: o.domain,
    declared: [...o.declared],
    ki_rows: o.kiRows.map((k) => ({ comp_domain: k.compDomain, status: k.status, status_by: k.statusBy ?? '', market: k.market ?? '', updated_at: k.updatedAt ?? '' })),
    not_competitors: [...o.notCompetitors],
    max: o.max ?? 5,
  });
  return { list: r.list, removed: r.removed, chosen: r.chosen };
}

/** AI visibility: who AI names, split into competitors and the software makers / platforms / other sites (never in the share of voice). */
export function splitAiNamed<T extends { domain: string }>(rows: readonly T[], site: CompetitorSiteContext): { competitors: T[]; software: (T & { role: CompetitorRole })[]; other: (T & { role: CompetitorRole })[] } {
  const competitors: T[] = [];
  const software: (T & { role: CompetitorRole })[] = [];
  const other: (T & { role: CompetitorRole })[] = [];
  for (const r of rows) {
    // a name with no website (an AI answer named a brand only) stays where the engine put it
    if (!/\./.test(r.domain)) {
      competitors.push(r);
      continue;
    }
    const role = competitorRole(r.domain, site).role;
    if (role === 'competitor') competitors.push(r);
    else if (role === 'software' || role === 'your_platform') software.push({ ...r, role });
    else other.push({ ...r, role });
  }
  return { competitors, software, other };
}

/** The Link Builder's left-out reason for a stored reason code ('' when the code is not a competitor-type left-out). */
export function leftOutWords(code: string | null | undefined): string {
  const c = String(code ?? '') as CompetitorLeftOut;
  return (CMP.LEFT_OUT as Record<string, string>)[c] ?? '';
}

/** A link prospect retired with the AI question it came from (seo_link_prospects.retired_at): kept for the record, never offered. */
export function isRetiredProspect(row: { retired_at?: string | null } | null | undefined): boolean {
  return !!String(row?.retired_at ?? '').trim();
}
