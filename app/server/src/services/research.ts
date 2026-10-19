import { and, desc, eq } from 'drizzle-orm';
import { RECOMMENDATIONS_MAX_AGE_DAYS, discoverInput, type RecommendedKeywords, type ResearchStartResult, type ResearchStatus } from '@seo/shared';
import type { OrgAccess } from '../auth/access';
import { requireVerified } from '../auth/access';
import { db, schema } from '../db';
import type { OrgRow, RunRow, SiteRow } from '../db/schema';
import { HttpError } from '../lib/errors';
import { quoteCredits } from './billing';
import { settingsRow } from './admin/settings';
import { estimateCost, createRun } from './runs';
import { recommendedKeywords } from './keywordChecks';

// Keyword research in the background at setup (SCHEDULING_KEYWORDS_PLAN.md §5.2, owner decision D3): the business step starts one
// discovery run (`mode: discover`, never a page) so the suggestions are ready when the owner reaches "Your first keyword".
// It is FREE ONCE PER WEBSITE, AT SETUP ONLY, and the exemption is exact:
//   * once per website: the grant is keyed by the DOMAIN (free_research_grants.domain is the primary key), so deleting the website and
//     adding it again, or adding it in another company, never earns a second free research; the grant is claimed inside one insert, so
//     two requests at once get one free run;
//   * at setup only: while the website's tracking has not started, or within SETUP_HOURS of its start (the onboarding launch);
//   * a run the engine never started (it refused the request) gives the grant back, because nothing was done; a run that ran, failed or
//     not, keeps it used;
//   * the free run is quoted at 0 credits, which caps every charge of it at 0 (the cost sync never charges a run beyond its quote); the
//     platform's own daily ceiling still applies to it.
// Later research (a stale list, "Find keywords for me") is a normal paid run through POST /runs; this endpoint answers 409 `research_not_free`
// with its price in credits instead of charging anything on its own.

export const SETUP_HOURS = 24;
const ACTIVE = ['submitting', 'accepted', 'running'];

/** Whether the website may have its free research now (pure): not granted before for its domain, and still at setup. */
export function freeResearchAllowed(site: Pick<SiteRow, 'trackingStatus' | 'trackingStartedAt'>, granted: boolean, now = Date.now()): boolean {
  if (granted) return false;
  if (site.trackingStatus === 'not_started' || !site.trackingStartedAt) return true;
  return now - site.trackingStartedAt.getTime() <= SETUP_HOURS * 3_600_000;
}

/** The research state (pure): a discovery run of the last 12 hours still going, else fresh research on file, else none. */
export function researchStatusOf(run: Pick<RunRow, 'status' | 'createdAt'> | null, recommended: Pick<RecommendedKeywords, 'reportId' | 'ageDays'>, now = Date.now()): ResearchStatus {
  if (run && ACTIVE.includes(run.status) && now - run.createdAt.getTime() < 12 * 3_600_000) return 'running';
  if (recommended.reportId && recommended.ageDays != null && recommended.ageDays <= RECOMMENDATIONS_MAX_AGE_DAYS) return 'ready';
  return 'none';
}

const latestDiscover = async (siteId: string) => (await db.query.runs.findFirst({ where: and(eq(schema.runs.siteId, siteId), eq(schema.runs.mode, 'discover')), orderBy: desc(schema.runs.createdAt) })) ?? null;

/** GET .../keywords/recommended, with `status`, `startedAt` and whether the free research is still available. */
export async function recommendedWithStatus(org: OrgRow, site: SiteRow, now = Date.now()): Promise<RecommendedKeywords> {
  const [rec, run, grant] = await Promise.all([recommendedKeywords(org, site, now), latestDiscover(site.id), db.query.freeResearchGrants.findFirst({ where: eq(schema.freeResearchGrants.domain, site.domain) })]);
  const status = researchStatusOf(run, rec, now);
  return { ...rec, status, startedAt: run && status === 'running' ? run.createdAt.toISOString() : null, runId: run && status === 'running' ? run.id : null, freeResearch: freeResearchAllowed(site, !!grant, now) };
}

const inputOf = (site: SiteRow) =>
  discoverInput.parse({ mode: 'discover', siteId: site.id, country: site.country, business: site.business.slice(0, 500), customers: site.customers.slice(0, 300), businessFacts: site.businessFacts.slice(0, 2000), goal: site.goal, emailCopy: false });

/** POST .../research/start: the free research at setup, or the research already going / fresh. 409 `research_not_free` otherwise. */
export async function startResearch(a: OrgAccess & { site: SiteRow }, now = Date.now(), start: typeof createRun = createRun): Promise<ResearchStartResult> {
  const site = a.site;
  requireVerified(site);
  if (!site.business.trim() && !site.services.length)
    throw new HttpError(400, 'Tell us what you sell first (the business step), so the research looks for the right keywords.', 'validation', { business: 'Describe your business' });
  const [rec, run] = await Promise.all([recommendedKeywords(a.org, site, now), latestDiscover(site.id)]);
  const status = researchStatusOf(run, rec, now);
  if (status === 'running') return { status, runId: run!.id, startedAt: run!.createdAt.toISOString(), free: run!.input?.freeResearch === true, started: false };
  if (status === 'ready') return { status, runId: null, startedAt: null, free: false, started: false };
  const input = inputOf(site);
  const granted = await db.query.freeResearchGrants.findFirst({ where: eq(schema.freeResearchGrants.domain, site.domain) });
  if (!freeResearchAllowed(site, !!granted, now)) {
    const credits = quoteCredits(await estimateCost(input), await settingsRow());
    throw new HttpError(409, granted ? 'The free keyword research of this website was used at setup. Start it again from the keyword research form (it uses credits).' : 'Free keyword research is part of setting a website up. Start it from the keyword research form (it uses credits).', 'research_not_free', undefined, { credits });
  }
  // claim the domain's grant: one insert, so two requests at once get one free run
  const [claim] = await db.insert(schema.freeResearchGrants).values({ domain: site.domain, orgId: a.org.id, siteId: site.id }).onConflictDoNothing().returning();
  if (!claim) {
    const again = await latestDiscover(site.id);
    if (again && ACTIVE.includes(again.status)) return { status: 'running', runId: again.id, startedAt: again.createdAt.toISOString(), free: true, started: false };
    throw new HttpError(409, 'The free keyword research of this website was used at setup.', 'research_not_free');
  }
  let r: RunRow;
  try {
    r = await start(a, input, { free: true });
  } catch (err) {
    await db.delete(schema.freeResearchGrants).where(eq(schema.freeResearchGrants.domain, site.domain));
    throw err;
  }
  // the engine refused the request before doing anything (a run that fails at its start never ran): the grant is given back
  if (r.status === 'failed') await db.delete(schema.freeResearchGrants).where(eq(schema.freeResearchGrants.domain, site.domain));
  else await db.update(schema.freeResearchGrants).set({ runId: r.id }).where(eq(schema.freeResearchGrants.domain, site.domain));
  return { status: r.status === 'failed' ? 'none' : 'running', runId: r.id, startedAt: r.createdAt.toISOString(), free: true, started: r.status !== 'failed' };
}
