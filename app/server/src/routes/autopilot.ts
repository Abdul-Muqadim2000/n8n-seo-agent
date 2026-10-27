import type { FastifyInstance } from 'fastify';
import {
  WEEKDAY_NAMES,
  comingUpDecisionSchema,
  contentFeedbackSchema,
  cycleWeekdaySchema,
  proposalSwapSchema,
  type ComingUpDecisionResult,
  type ComingUpView,
  type ContentFeedbackResult,
  type CycleWeekdayResult,
  type KeywordProposalList,
  type KeywordProposalView,
  type ResearchStartResult,
  type SiteCycleView,
} from '@seo/shared';
import { isUuid, orgAccess, requireVerified, siteAccess } from '../auth/access';
import { notFound, parse } from '../lib/errors';
import { audit } from '../services/audit';
import { approveProposal, listProposals, skipProposal, swapProposal } from '../services/autoStart';
import { takeAcknowledge } from '../services/consistency';
import { decideComingUp, loadComingUp } from '../services/comingUp';
import { loadSiteCycle, setCycleWeekday } from '../services/cycles';
import { rejectPage } from '../services/autopilot';
import { startResearch } from '../services/research';

type P = { orgId: string; siteId: string; id?: string; reportId?: string };
const limit = (max: number) => ({ config: { rateLimit: { max, timeWindow: '1 minute' } } });

/**
 * Keyword-first autopilot and the website's own cycle (SCHEDULING_KEYWORDS_PLAN.md §14.6, app/API.md "Cycle, Coming up, keyword
 * proposals, research, feedback"). Reading: everyone in the company. Deciding (Coming up, proposals, research, feedback): owners, admins
 * and members. The weekday: owners and admins (a website setting). Verified websites only; every change is in the audit log.
 */
export async function autopilotRoutes(app: FastifyInstance) {
  app.get('/api/orgs/:orgId/sites/:siteId/cycle', async (req): Promise<SiteCycleView> => {
    const p = req.params as P;
    const a = await siteAccess(req, p.orgId, p.siteId);
    return loadSiteCycle(a.site, a.role);
  });

  app.patch('/api/orgs/:orgId/sites/:siteId/cycle', limit(20), async (req): Promise<CycleWeekdayResult> => {
    const p = req.params as P;
    const a = await siteAccess(req, p.orgId, p.siteId, 'admin');
    requireVerified(a.site);
    const { weekday } = parse(cycleWeekdaySchema, req.body);
    const { result, before } = await setCycleWeekday(a.site, weekday);
    await audit(req, a.org.id, { action: 'site.cycle_weekday_changed', target: { type: 'site', id: a.site.id, label: a.site.domain }, details: { before: before == null ? null : WEEKDAY_NAMES[before], after: WEEKDAY_NAMES[weekday], nextDueAt: result.nextDueAt } });
    return result;
  });

  app.get('/api/orgs/:orgId/sites/:siteId/coming-up', async (req): Promise<ComingUpView> => {
    const p = req.params as P;
    const a = await siteAccess(req, p.orgId, p.siteId);
    return loadComingUp(a.site, a.role);
  });

  app.post('/api/orgs/:orgId/sites/:siteId/coming-up/decisions', limit(60), async (req): Promise<ComingUpDecisionResult> => {
    const p = req.params as P;
    const a = await siteAccess(req, p.orgId, p.siteId, 'member');
    requireVerified(a.site);
    const body = parse(comingUpDecisionSchema, req.body);
    const r = await decideComingUp(a.site, a.user, a.role, body);
    await audit(req, a.org.id, { action: 'site.coming_up_decided', target: { type: 'site', id: a.site.id, label: a.site.domain }, details: { item: r.item.keyword, decision: body.decision, scope: body.scope, key: r.key } });
    return r;
  });

  app.get('/api/orgs/:orgId/sites/:siteId/keyword-proposals', async (req): Promise<KeywordProposalList> => {
    const p = req.params as P;
    const a = await siteAccess(req, p.orgId, p.siteId);
    return listProposals(a.site);
  });

  const proposalId = (req: { params: unknown }) => {
    const id = String((req.params as P).id ?? '');
    if (!isUuid(id)) throw notFound('Proposal not found');
    return id;
  };

  app.post('/api/orgs/:orgId/sites/:siteId/keyword-proposals/:id/approve', limit(20), async (req): Promise<{ proposal: KeywordProposalView; runId: string }> => {
    const p = req.params as P;
    const a = await siteAccess(req, p.orgId, p.siteId, 'member');
    requireVerified(a.site);
    const r = await approveProposal(a, proposalId(req), undefined, { acknowledge: takeAcknowledge(req.body).acknowledge, req });
    await audit(req, a.org.id, { action: 'site.keyword_proposal_decided', target: { type: 'site', id: a.site.id, label: a.site.domain }, details: { keyword: r.proposal.keyword, decision: 'approve', runId: r.run.id } });
    return { proposal: r.proposal, runId: r.run.id };
  });

  app.post('/api/orgs/:orgId/sites/:siteId/keyword-proposals/:id/skip', limit(20), async (req): Promise<{ proposal: KeywordProposalView; next: KeywordProposalView | null }> => {
    const p = req.params as P;
    const a = await siteAccess(req, p.orgId, p.siteId, 'member');
    requireVerified(a.site);
    const r = await skipProposal(a, proposalId(req), undefined, req.log);
    await audit(req, a.org.id, { action: 'site.keyword_proposal_decided', target: { type: 'site', id: a.site.id, label: a.site.domain }, details: { keyword: r.proposal.keyword, decision: 'skip', next: r.next?.keyword ?? null } });
    return r;
  });

  app.post('/api/orgs/:orgId/sites/:siteId/keyword-proposals/:id/swap', limit(20), async (req): Promise<{ proposal: KeywordProposalView; runId: string }> => {
    const p = req.params as P;
    const a = await siteAccess(req, p.orgId, p.siteId, 'member');
    requireVerified(a.site);
    const { keyword } = parse(proposalSwapSchema, req.body);
    const r = await swapProposal(a, proposalId(req), keyword, undefined, { acknowledge: takeAcknowledge(req.body).acknowledge, req });
    await audit(req, a.org.id, { action: 'site.keyword_proposal_decided', target: { type: 'site', id: a.site.id, label: a.site.domain }, details: { keyword: r.proposal.keyword, decision: 'swap', swappedFor: keyword, runId: r.run.id } });
    return { proposal: r.proposal, runId: r.run.id };
  });

  app.post('/api/orgs/:orgId/sites/:siteId/research/start', limit(10), async (req): Promise<ResearchStartResult> => {
    const p = req.params as P;
    const a = await siteAccess(req, p.orgId, p.siteId, 'member');
    const r = await startResearch(a);
    if (r.started) await audit(req, a.org.id, { action: 'site.research_started', target: { type: 'site', id: a.site.id, label: a.site.domain }, details: { runId: r.runId, free: r.free } });
    return r;
  });

  app.post('/api/orgs/:orgId/reports/:reportId/feedback', limit(30), async (req): Promise<ContentFeedbackResult> => {
    const p = req.params as P;
    const a = await orgAccess(req, p.orgId, 'member');
    if (!isUuid(p.reportId)) throw notFound('Report not found');
    const body = parse(contentFeedbackSchema, req.body);
    return rejectPage(req, a.org, a.user, String(p.reportId), body.reason);
  });
}
