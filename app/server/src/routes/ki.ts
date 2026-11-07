import { Readable } from 'node:stream';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import {
  KI_APPROVE_MAX,
  KI_COMP_USER_STATUSES,
  KI_COMPETITOR_CSV_COLUMNS,
  KI_COMPETITOR_CSV_HEADERS,
  KI_GAP_CSV_COLUMNS,
  KI_GAP_CSV_HEADERS,
  KI_GAP_STATUSES,
  KI_GAP_TYPES,
  KI_KEYWORD_CSV_COLUMNS,
  KI_KEYWORD_CSV_HEADERS,
  KI_MODES,
  KI_PAGE_SIZE,
  kiCompetitorCsvRow,
  kiCsvFileName,
  kiCsvHeader,
  kiGapCsvRow,
  kiKeywordCsvRow,
  kiKeywordQueryOf,
  kiMarketOf,
  type KiOverview,
  type Role,
} from '@seo/shared';
import { isPlatformAdmin, isUuid, requireUser, requireVerified, siteAccess } from '../auth/access';
import { and, eq } from 'drizzle-orm';
import { db, schema } from '../db';
import { HttpError, notFound, parse } from '../lib/errors';
import { audit } from '../services/audit';
import {
  approveQuestions,
  kiCompetitorsOf,
  kiCsvChunks,
  kiData,
  kiGapList,
  kiGapsOf,
  kiKeywordList,
  kiKeywordsOf,
  kiOverview,
  kiState,
  requireKiVisible,
  setCompetitorStatus,
  setGapStatus,
  setKiMode,
} from '../services/kiData';

// KI A1 (2026-11-08, docs/keyword-intel-2026-11-08/CONTRACTS.md §7, fixes/A1_ROUTES.md): Competitors and Keyword research.
// Every route: a member of the company (viewer or above; the client portal's roles are refused), a website of that company, verified. Every
// data route answers 404 unless the website is On, or in Trial for a platform admin (services/kiData.ts requireKiVisible).

type P = { orgId: string; siteId: string };
const R = '/api/orgs/:orgId/sites/:siteId/ki';

const lists = { config: { rateLimit: { max: 240, timeWindow: '1 minute' } } };
const csv = { config: { rateLimit: { max: 30, timeWindow: '10 minutes' } } };
const writes = { config: { rateLimit: { max: 60, timeWindow: '10 minutes' } } };

const DOMAIN_RE = /^(?=.{3,253}$)[a-z0-9-]+(\.[a-z0-9-]+)+$/;
const GAP_ID_RE = /^[A-Za-z0-9_:.\-]{1,120}$/;
const competitorPatch = z.object({ status: z.enum(KI_COMP_USER_STATUSES, { message: 'Choose chosen, watch or dismissed' }) }).strict();
const gapPatch = z.object({ status: z.enum(KI_GAP_STATUSES, { message: 'Choose open, started, dismissed or done' }) }).strict();
const approveBody = z.object({ keys: z.array(z.string().trim().min(1).max(200)).min(1, 'Choose at least one question').max(KI_APPROVE_MAX, `At most ${KI_APPROVE_MAX} questions at once`) }).strict();
const modeBody = z.object({ mode: z.enum(KI_MODES, { message: 'Choose Off, Trial or On' }) }).strict();

const S = (v: unknown) => (Array.isArray(v) ? String(v[0] ?? '') : v == null ? '' : String(v)).trim();

export async function kiRoutes(app: FastifyInstance) {
  /** the website, verified, at least `min`; then its KI state for this person */
  const access = async (req: FastifyRequest, min: Role = 'viewer') => {
    const p = req.params as P;
    const a = await siteAccess(req, p.orgId, p.siteId, min);
    requireVerified(a.site);
    const st = await kiState(a.site, a.user);
    return { ...a, st };
  };
  /** the data routes: not visible = 404 */
  const visible = async (req: FastifyRequest, min: Role = 'viewer') => {
    const a = await access(req, min);
    requireKiVisible(a.st);
    return a;
  };
  const sendCsv = (reply: FastifyReply, name: string, chunks: Iterable<string>) =>
    reply
      .header('content-type', 'text/csv; charset=utf-8')
      .header('content-disposition', `attachment; filename="${name}"`)
      .header('cache-control', 'no-store')
      .send(Readable.from(chunks));

  app.get(R, lists, async (req): Promise<KiOverview> => {
    const a = await access(req);
    return kiOverview(a.site, a.user, a.role, a.st, kiMarketOf(S((req.query as Record<string, unknown>).market)));
  });

  // ---------- competitors ----------
  const compQuery = (req: FastifyRequest) => {
    const q = req.query as Record<string, unknown>;
    return { market: kiMarketOf(S(q.market)), status: S(q.status) || undefined, class: S(q.class) || undefined };
  };
  app.get(`${R}/competitors`, lists, async (req) => {
    const a = await visible(req);
    return kiCompetitorsOf(await kiData(a.site), a.st, compQuery(req));
  });
  app.get(`${R}/competitors.csv`, csv, async (req, reply) => {
    const a = await visible(req);
    const r = kiCompetitorsOf(await kiData(a.site), a.st, compQuery(req));
    return sendCsv(reply, kiCsvFileName('competitors', a.site.domain), kiCsvChunks(kiCsvHeader(KI_COMPETITOR_CSV_COLUMNS, KI_COMPETITOR_CSV_HEADERS), r.items, kiCompetitorCsvRow));
  });
  app.patch(`${R}/competitors/:compDomain`, writes, async (req) => {
    const a = await visible(req, 'member');
    const dom = S((req.params as { compDomain?: string }).compDomain).toLowerCase().replace(/^www\./, '');
    if (!DOMAIN_RE.test(dom)) throw notFound(`${dom || 'This domain'} is not in your competitor list.`);
    const { status } = parse(competitorPatch, req.body ?? {});
    const r = await setCompetitorStatus(a.site, a.st, dom, status);
    await audit(req, a.site.orgId, { action: 'site.ki_competitor', target: { type: 'site', id: a.site.id, label: a.site.domain }, details: { competitor: dom, status } });
    return r;
  });

  // ---------- keywords ----------
  app.get(`${R}/keywords`, lists, async (req) => {
    const a = await visible(req);
    return kiKeywordsOf(await kiData(a.site), kiKeywordQueryOf(req.query as Record<string, unknown>));
  });
  app.get(`${R}/keywords.csv`, csv, async (req, reply) => {
    const a = await visible(req);
    const { list } = kiKeywordList(await kiData(a.site), kiKeywordQueryOf(req.query as Record<string, unknown>));
    return sendCsv(reply, kiCsvFileName('keywords', a.site.domain), kiCsvChunks(kiCsvHeader(KI_KEYWORD_CSV_COLUMNS, KI_KEYWORD_CSV_HEADERS), list, kiKeywordCsvRow));
  });

  // ---------- gaps ----------
  const gapQuery = (req: FastifyRequest) => {
    const q = req.query as Record<string, unknown>;
    const type = S(q.type);
    const status = S(q.status);
    return {
      market: kiMarketOf(S(q.market)),
      type: (KI_GAP_TYPES as readonly string[]).includes(type) ? type : undefined,
      status: (KI_GAP_STATUSES as readonly string[]).includes(status) ? status : undefined,
      page: Number(S(q.page)) || 1,
      pageSize: Math.min(KI_PAGE_SIZE.max, Number(S(q.page_size)) || KI_PAGE_SIZE.default),
    };
  };
  app.get(`${R}/gaps`, lists, async (req) => {
    const a = await visible(req);
    return kiGapsOf(await kiData(a.site), gapQuery(req));
  });
  app.get(`${R}/gaps.csv`, csv, async (req, reply) => {
    const a = await visible(req);
    const { list } = kiGapList(await kiData(a.site), gapQuery(req));
    return sendCsv(reply, kiCsvFileName('gaps', a.site.domain), kiCsvChunks(kiCsvHeader(KI_GAP_CSV_COLUMNS, KI_GAP_CSV_HEADERS), list, kiGapCsvRow));
  });
  app.patch(`${R}/gaps/:gapId`, writes, async (req) => {
    const a = await visible(req, 'member');
    const gapId = S((req.params as { gapId?: string }).gapId);
    if (!GAP_ID_RE.test(gapId)) throw notFound('This gap is not in your list.');
    const { status } = parse(gapPatch, req.body ?? {});
    const r = await setGapStatus(a.site, gapId, status);
    await audit(req, a.site.orgId, { action: 'site.ki_gap', target: { type: 'site', id: a.site.id, label: a.site.domain }, details: { gapId, status } });
    return r;
  });

  // ---------- buyer questions into the AI question panel (no paid run) ----------
  app.post(`${R}/questions/approve`, { config: { rateLimit: { max: 30, timeWindow: '10 minutes' } } }, async (req) => {
    // the AI panel manager is an admin's (routes/sites.ts Site Admin), so this is too
    const a = await visible(req, 'admin');
    const { keys } = parse(approveBody, req.body ?? {});
    const r = await approveQuestions(a.site, a.st, keys);
    await audit(req, a.site.orgId, { action: 'site.ki_questions_approved', target: { type: 'site', id: a.site.id, label: a.site.domain }, details: { requested: keys.length, added: r.added.length, skipped: r.skipped.length } });
    return r;
  });

  // ---------- a plan action into the pipeline (W2) ----------
  app.post(`${R}/plan/:actionId/start`, writes, async (req, reply) => {
    await visible(req, 'member');
    return reply.status(501).send({ error: 'Starting a plan step from here is not available yet. You can start the same work from the Pipeline.', code: 'not_available_yet' });
  });

  // ---------- the switch: platform admins only (as AI ranking's mode) ----------
  app.patch(`${R}/mode`, { config: { rateLimit: { max: 20, timeWindow: '10 minutes' } } }, async (req) => {
    if (!isPlatformAdmin(requireUser(req))) throw new HttpError(403, 'Only our team can switch keyword intelligence on or off for a website.', 'forbidden');
    // as the AI ranking trial (RC-12): a platform admin switches it for any client company, a member of it or not
    const p = req.params as P;
    if (!isUuid(p.orgId) || !isUuid(p.siteId)) throw notFound('Website not found');
    const site = await db.query.sites.findFirst({ where: and(eq(schema.sites.id, p.siteId), eq(schema.sites.orgId, p.orgId)) });
    if (!site) throw notFound('Website not found');
    requireVerified(site);
    const { mode } = parse(modeBody, req.body ?? {});
    const r = await setKiMode(site, mode);
    await audit(req, site.orgId, { action: 'site.ki_mode', target: { type: 'site', id: site.id, label: site.domain }, details: { mode } });
    return r;
  });
}
