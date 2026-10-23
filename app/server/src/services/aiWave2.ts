// AI visibility wave 2 (W2-A, 2026-10-23, n8n/seo-agent/docs/ai-visibility-2026-10-23/WAVE2_CONTRACTS.md): the server halves of the
// answer drill-down (one page of answers, filtered, with the filter's figures), a question's history across runs, the CSV downloads
// (streamed, company-scoped through the caller's site access, within the same read limits as the page), the owner's AI report uploads
// (seo_ai_imports) and deleting questions from the panel. Everything reads the n8n Data Tables of ONE verified domain.

import { Readable } from 'node:stream';
import {
  AI_IMPORT_COLUMNS,
  AI_IMPORT_MAX_ROWS,
  aiAskedSet,
  aiPromptDeleted,
  AI_PROMPT_DELETED,
  aiLegacySourcesList,
  aiCsvHeader,
  aiCsvLine,
  aiSovOf,
  aiInRange,
  aiLatestExtras,
  aiMatchesFilter,
  aiSegmentsFromJson,
  aiWilson,
  n8nSiteId,
  parseAiImport,
  type AiAnswerRow,
  type AiAnswersPage,
  type AiData,
  type AiExportKind,
  type AiFilter,
  type AiDateOrder,
  type AiImportSource,
  type AiImportSummary,
  type AiPromptRow,
  type AiQuestionHistory,
  type AiVisibilityRow,
} from '@seo/shared';
import type { OrgRow, SiteRow } from '../db/schema';
import { badRequest, HttpError, notFound } from '../lib/errors';
import { deleteRows, ensureTable, insertRows, invalidateSite, siteRows, updateRows } from '../n8n/client';
import { AI_READ_LIMITS, aiData, aiScopeSummary, aiRunsCompared, latestRunAnswers, promptFacets, toAiAnswer } from './data';

const s = (v: unknown): string => (v == null ? '' : String(v));
const jsonArray = (v: unknown): Record<string, unknown>[] => {
  try {
    const j = JSON.parse(s(v) || '[]') as unknown;
    return Array.isArray(j) ? (j as Record<string, unknown>[]) : [];
  } catch {
    return [];
  }
};

/** The stored runs of a domain, oldest first (the same capped, newest-first read the page makes). */
async function aiRuns(domain: string): Promise<AiVisibilityRow[]> {
  const desc = await siteRows<AiVisibilityRow>('aiVisibility', domain, { sortBy: 'checked_at:desc', max: AI_READ_LIMITS.runs });
  return [...desc].sort((a, b) => s(a.checked_at).localeCompare(s(b.checked_at)));
}

/** The run asked for: its id when given, else the newest run checked on or before the filter's end date, else the latest. */
function pickRun(runs: AiVisibilityRow[], runId: string, f: AiFilter): AiVisibilityRow | null {
  if (runId) return runs.find((r) => s(r.run_id) === runId) ?? null;
  const inRange = runs.filter((r) => aiInRange(s(r.checked_at), { from: '', to: f.to }));
  return inRange[inRange.length - 1] ?? null;
}

export const AI_ANSWER_RESULTS = ['all', 'named', 'cited', 'absent', 'error'] as const;
type AnswerResult = (typeof AI_ANSWER_RESULTS)[number];
const matchResult = (a: AiData['answers'][number], r: AnswerResult) => (r === 'named' ? a.mentioned : r === 'cited' ? a.cited : r === 'absent' ? a.answered && !a.mentioned : r === 'error' ? !!a.error || !a.answered : true);

/**
 * W2-A (finishes F3's A10): one page of a run's answers. The page loads the run's summary through /data/ai and reads its answers here,
 * a page at a time, so a 500-question panel never ships megabytes to every viewer. The filter's figures (rates with their range, "too
 * few" under 12) come with every page.
 */
export async function aiAnswersPage(site: SiteRow, q: { filter: AiFilter; run?: string; result?: string; text?: string; promptId?: string; page?: number; pageSize?: number }): Promise<AiAnswersPage> {
  const runs = await aiRuns(site.domain);
  const run = pickRun(runs, s(q.run).slice(0, 120), q.filter);
  const empty = { answers: 0, answered: 0, named: 0, cited: 0, namedRate: null, citedRate: null, namedCi: null, citedCi: null, enough: false, questions: 0, topRivals: [], topSources: [] };
  const runList = [...runs].reverse().slice(0, 60).map((r) => ({ runId: s(r.run_id), checkedAt: s(r.checked_at) }));
  if (!run) return { runId: null, checkedAt: null, runs: runList, total: 0, page: 1, pageSize: 25, items: [], summary: empty, engines: [] };
  const [rows, prompts] = await Promise.all([latestRunAnswers(site.domain, run), siteRows<AiPromptRow>('aiPrompts', site.domain, { max: AI_READ_LIMITS.prompts })]);
  const facets = promptFacets(prompts);
  const all = rows.map((r) => {
    const a = toAiAnswer(r, site.domain);
    const f = facets.get(a.promptId);
    return f ? { ...a, cluster: f.cluster, persona: f.persona, market: f.market, stage: f.stage } : a;
  });
  const result = (AI_ANSWER_RESULTS as readonly string[]).includes(s(q.result)) ? (s(q.result) as AnswerResult) : 'all';
  const text = s(q.text).trim().toLowerCase().slice(0, 120);
  const promptId = s(q.promptId).slice(0, 120);
  const scoped = all.filter((a) => aiMatchesFilter(a, facets.get(a.promptId), q.filter) && (!promptId || a.promptId === promptId));
  const shown = scoped
    .filter((a) => matchResult(a, result) && (!text || a.prompt.toLowerCase().includes(text) || (a.detail?.answerText ?? a.excerpt).toLowerCase().includes(text)))
    .sort((a, b) => a.prompt.localeCompare(b.prompt) || a.engine.localeCompare(b.engine));
  const pageSize = Math.min(100, Math.max(5, Math.round(Number(q.pageSize) || 25)));
  const pages = Math.max(1, Math.ceil(shown.length / pageSize));
  const page = Math.min(pages, Math.max(1, Math.round(Number(q.page) || 1)));
  return {
    runId: s(run.run_id),
    checkedAt: s(run.checked_at),
    runs: runList,
    total: shown.length,
    page,
    pageSize,
    items: shown.slice((page - 1) * pageSize, page * pageSize),
    summary: aiScopeSummary(scoped),
    engines: [...new Set(all.map((a) => a.engine))],
  };
}

/** W2-A: one question across the stored runs (the engine keeps answers about 120 days), every engine's answer per run, and its named rate. */
export async function aiQuestionHistory(site: SiteRow, promptId: string): Promise<AiQuestionHistory> {
  const id = s(promptId).slice(0, 120);
  if (!id) throw notFound('Question not found');
  const [rows, prompts] = await Promise.all([
    siteRows<AiAnswerRow>('aiAnswers', site.domain, { extra: [{ columnName: 'prompt_id', condition: 'eq', value: id }], sortBy: 'checked_at:desc', max: 1500 }),
    siteRows<AiPromptRow>('aiPrompts', site.domain, { extra: [{ columnName: 'prompt_id', condition: 'eq', value: id }], max: 5 }),
  ]);
  const p = prompts[0];
  if (!p && !rows.length) throw notFound('Question not found');
  const byRun = new Map<string, AiData['answers']>();
  for (const r of rows) {
    const k = s(r.run_id) || s(r.checked_at).slice(0, 10);
    byRun.set(k, [...(byRun.get(k) ?? []), toAiAnswer(r, site.domain)]);
  }
  const runs = [...byRun.entries()]
    .map(([runId, answers]) => ({ runId, checkedAt: answers.map((a) => a.checkedAt).sort()[0] ?? '', answers: answers.sort((a, b) => a.engine.localeCompare(b.engine) || b.checkedAt.localeCompare(a.checkedAt)) }))
    .sort((a, b) => b.checkedAt.localeCompare(a.checkedAt));
  const series = [...runs].reverse().map((r) => {
    const answered = r.answers.filter((a) => a.answered);
    const named = answered.filter((a) => a.mentioned).length;
    return { runId: r.runId, checkedAt: r.checkedAt, n: answered.length, named, cited: answered.filter((a) => a.cited).length, namedRate: answered.length ? Math.round((1000 * named) / answered.length) / 10 : null, ci: aiWilson(named, answered.length) };
  });
  return {
    promptId: id,
    prompt: s(p?.prompt) || s(rows[0]?.prompt),
    facets: { cluster: s(p?.cluster) || s(p?.topic), persona: s(p?.persona), market: s(p?.market), stage: s(p?.stage), keyword: s(p?.keyword) },
    runs,
    series,
    note: 'One question is a handful of answers a run: read its rate with the range, and across runs, not one answer at a time. Answers are kept about 120 days.',
  };
}

// ---------------- CSV downloads ----------------

/**
 * W2-A: the AI page's CSV downloads, built from the same reads as the page (same caps), one line at a time into a stream. A download
 * names only rows of the caller's own verified website (the caller's site access decided the domain).
 */
export async function aiCsvStream(org: OrgRow, site: SiteRow, kind: AiExportKind, filter: AiFilter): Promise<Readable> {
  const lines = await aiCsvLines(org, site, kind, filter);
  return Readable.from(lines(), { objectMode: false });
}

async function aiCsvLines(org: OrgRow, site: SiteRow, kind: AiExportKind, filter: AiFilter): Promise<() => AsyncGenerator<string>> {
  const d = site.domain;
  if (kind === 'answers') {
    const runs = await aiRuns(d);
    const run = pickRun(runs, '', filter);
    const [rows, prompts] = run ? await Promise.all([latestRunAnswers(d, run), siteRows<AiPromptRow>('aiPrompts', d, { max: AI_READ_LIMITS.prompts })]) : [[], []];
    const facets = promptFacets(prompts);
    return async function* () {
      yield aiCsvHeader('answers');
      for (const r of rows) {
        const a = toAiAnswer(r, d), f = facets.get(a.promptId), x = a.detail;
        if (!aiMatchesFilter(a, f, filter)) continue;
        yield aiCsvLine([s(r.run_id), a.checkedAt, a.runKind, a.promptId, a.prompt, f?.cluster ?? a.topic, f?.persona ?? '', f?.market ?? '', f?.stage ?? '', a.engine, x?.model ?? '', a.answered, a.mentioned, a.position ?? '', a.cited,
          a.ourUrls.join(' '), (a.entities?.map((e) => e.name || e.id) ?? a.brands).join(' | '), (x?.citations?.map((c) => c.url) ?? a.citedUrls.map((c) => c.url)).join(' '),
          (x?.retrieved?.map((c) => c.url) ?? []).join(' '), (x?.fanoutQueries ?? a.fanout).join(' | '), a.sentiment, a.issues.join(' | '), x?.answerText ?? a.excerpt, x?.answerCut ?? false, a.error]);
      }
    };
  }
  if (kind === 'questions') {
    const prompts = (await siteRows<AiPromptRow>('aiPrompts', d, { max: AI_READ_LIMITS.prompts })).filter((p) => !aiPromptDeleted(p));   // R-A7: tombstones are not listed
    const data = await aiData(org, site, { answers: false });
    const cut = aiAskedSet(data.prompts, data.promptsMax ?? 50);
    return async function* () {
      yield aiCsvHeader('questions');
      for (const p of prompts) {
        const f = { cluster: s(p.cluster) || s(p.topic), persona: s(p.persona), market: s(p.market), stage: s(p.stage) };
        // the engine filter does not apply to a question (every engine asks it)
        if (!aiMatchesFilter({ engine: '', promptId: s(p.prompt_id) }, f, { ...filter, engine: '' })) continue;
        yield aiCsvLine([s(p.prompt_id), s(p.prompt), s(p.keyword), f.cluster, f.persona, f.market, f.stage, s(p.status), p.pinned === true || s(p.pinned) === 'true', cut.asked.has(s(p.prompt_id)), s(p.source), p.volume ?? '', s(p.last_asked_at), p.asked_n_28d ?? '', s(p.fit_note), s(p.created_at)]);
      }
    };
  }
  const runs = (await aiRuns(d)).filter((r) => aiInRange(s(r.checked_at), filter));
  const last = runs[runs.length - 1];
  if (kind === 'competitors') {
    const compared = aiRunsCompared(runs);
    return async function* () {
      yield aiCsvHeader('competitors');
      for (let i = 0; i < runs.length; i++) {
        const r = runs[i];
        const sov = aiSovOf(r.sov_json, r.competitors_json);
        const comparable = i === 0 ? '' : compared[i]?.comparable ? 'yes' : 'no: ' + (compared[i]?.reason ?? '');
        yield aiCsvLine([s(r.run_id), s(r.checked_at), sov.basis === 'set' ? 'fixed set' : 'every brand named', d, r.share_of_voice, '', comparable]);
        for (const b of sov.brands) yield aiCsvLine([s(r.run_id), s(r.checked_at), sov.basis === 'set' ? 'fixed set' : 'every brand named', b.name, b.share ?? '', b.n, comparable]);
      }
    };
  }
  if (kind === 'sources') {
    const x = last ? aiLatestExtras(last as unknown as Record<string, unknown>) : null;
    const old = last ? aiLegacySourcesList(last.sources_json) : [];
    return async function* () {
      yield aiCsvHeader('sources');
      if (!last) return;
      if (x?.sources) {
        for (const dm of x.sources.domains) yield aiCsvLine([dm.host, dm.type, dm.citedN, dm.share ?? '', '', '', dm.firstSeen, dm.lastSeen, dm.halfLifeDays ?? '', s(last.checked_at)]);
        return;
      }
      for (const o of old) yield aiCsvLine([s(o.domain), s(o.kind), s(o.citations), '', Array.isArray(o.engines) ? o.engines.join(' ') : '', Array.isArray(o.topics) ? o.topics.join(' | ') : '', '', '', '', s(last.checked_at)]);
    };
  }
  // pages
  const x = last ? aiLatestExtras(last as unknown as Record<string, unknown>) : null;
  const old = last ? jsonArray(last.pages_json) : [];
  return async function* () {
    yield aiCsvHeader('pages');
    if (!last) return;
    if (x?.urls) {
      for (const u of x.urls.own) yield aiCsvLine([u.url, u.citedN, u.retrievedN, u.citedRate ?? '', u.answersN, u.engines.join(' '), u.questions.length, u.rivalCitedInstead.map((c) => c.url).join(' '), s(last.checked_at)]);
      for (const u of x.urls.retrievedNotCited) if (!x.urls.own.some((o) => o.url === u.url)) yield aiCsvLine([u.url, 0, u.retrievedN, 0, '', '', '', u.topCompeting.map((c) => c.url).join(' '), s(last.checked_at)]);
      return;
    }
    for (const o of old) yield aiCsvLine([s(o.url), s(o.citations), '', '', '', Array.isArray(o.engines) ? o.engines.join(' ') : '', '', '', s(last.checked_at)]);
  };
}

// ---------------- the owner's AI report uploads (seo_ai_imports) ----------------

/** The contract's upsert key of one import row (WAVE2_CONTRACTS.md §5: site, source, day, url, query); the parser merges queries case-blind. */
export const aiImportKey = (r: { day?: unknown; url?: unknown; query?: unknown }): string => [s(r.day), s(r.url), s(r.query).toLowerCase()].join('\u0001');

/**
 * W2-A (§5): stores a parsed Bing AI Performance / Search Console AI export.
 *
 * R-A4 (review 2026-10-23): an upsert by the contract's key (site, source, day, url, query), in two phases so a failure never empties a
 * period. 1) The new rows go in under a new `import_id`; when an insert fails, the rows already written under that id are taken out again
 * and nothing else was touched. 2) Then the rows of EARLIER uploads with the same key are removed: per (earlier import, day) in one call when
 * every row of that group is superseded, else row by row by its whole key. So a Bing pages file and a Bing queries file of the same days
 * both stay (their keys differ), and a re-export of the same report replaces its own rows. Until phase 2 ends a key can be counted twice
 * by a reader; the engine reads the table once a week.
 */
export async function importAiReport(site: SiteRow, input: { csv: string; fileName?: string; source?: AiImportSource | ''; periodEnd?: string; dateOrder?: AiDateOrder }): Promise<AiImportSummary> {
  let parsed;
  try {
    parsed = parseAiImport(input.csv, site.domain, { source: input.source, periodEnd: input.periodEnd, dateOrder: input.dateOrder });
  } catch (err) {
    throw badRequest((err as Error).message);
  }
  const now = new Date().toISOString();
  const importId = `aiimp_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const siteId = n8nSiteId(site.domain);
  await ensureTable('aiImports', AI_IMPORT_COLUMNS);
  const fileName = s(input.fileName).replace(/[^\w .()-]+/g, '').slice(0, 120);
  const mine = [{ columnName: 'site_id', condition: 'eq' as const, value: siteId }, { columnName: 'source', condition: 'eq' as const, value: parsed.source }];
  // phase 1: insert under the new import id; a failed chunk takes this import's rows out again
  try {
    for (let i = 0; i < parsed.rows.length; i += 500)
      await insertRows('aiImports', parsed.rows.slice(i, i + 500).map((r) => ({ site_id: siteId, domain: site.domain, source: parsed.source, ...r, file_name: fileName, imported_at: now, import_id: importId })));
  } catch (err) {
    await deleteRows('aiImports', [...mine, { columnName: 'import_id', condition: 'eq', value: importId }]).catch(() => undefined);
    invalidateSite(site.domain);
    throw new HttpError(502, `The upload could not be stored (${(err as Error).message}). Nothing was changed: your earlier uploads are as they were. Try again in a minute.`);
  }
  // phase 2: earlier rows with the same key are superseded
  const keys = new Set(parsed.rows.map(aiImportKey));
  const days = new Set(parsed.rows.map((r) => r.day));
  const stored = (await siteRows<Record<string, unknown>>('aiImports', site.domain, { extra: mine, max: AI_IMPORT_MAX_ROWS * 4, fresh: true })).filter((r) => s(r.import_id) !== importId && days.has(s(r.day)));
  const groups = new Map<string, { importId: string; day: string; all: number; stale: Record<string, unknown>[] }>();
  for (const r of stored) {
    const g = `${s(r.import_id)}\u0001${s(r.day)}`;
    const e = groups.get(g) ?? { importId: s(r.import_id), day: s(r.day), all: 0, stale: [] };
    e.all++;
    if (keys.has(aiImportKey(r))) e.stale.push(r);
    groups.set(g, e);
  }
  let replaced = 0;
  for (const g of groups.values()) {
    if (!g.stale.length) continue;
    const base = [...mine, { columnName: 'day', condition: 'eq' as const, value: g.day }, { columnName: 'import_id', condition: 'eq' as const, value: g.importId }];
    if (g.stale.length === g.all) await deleteRows('aiImports', base);
    // one file has one shape: when a row has no page (or no query), no row of that import has one, so the filter can leave it out
    else for (const r of g.stale) await deleteRows('aiImports', [...base, ...(s(r.url) ? [{ columnName: 'url', condition: 'eq' as const, value: s(r.url) }] : []), ...(s(r.query) ? [{ columnName: 'query', condition: 'eq' as const, value: s(r.query) }] : [])]);
    replaced += g.stale.length;
  }
  invalidateSite(site.domain);
  return { source: parsed.source, label: parsed.label, rows: parsed.rows.length, total: parsed.total, skipped: parsed.skipped, days: parsed.days, totals: parsed.totals, importedAt: now, importId, replaced, dateOrder: parsed.dateOrder, topQueries: parsed.topQueries };
}

/** What has been uploaded so far, per source (for the upload card): rows, days covered, totals, the last upload. */
export async function aiImportsOverview(site: SiteRow): Promise<{ source: string; rows: number; from: string; to: string; citations: number; impressions: number; clicks: number; importedAt: string; fileName: string }[]> {
  const rows = await siteRows<Record<string, unknown>>('aiImports', site.domain, { max: 20000 });
  const by = new Map<string, Record<string, unknown>[]>();
  for (const r of rows) by.set(s(r.source), [...(by.get(s(r.source)) ?? []), r]);
  return [...by.entries()].map(([source, rs]) => {
    const days = rs.map((r) => s(r.day)).filter(Boolean).sort();
    const latest = rs.reduce((m, r) => (s(r.imported_at) > s(m.imported_at) ? r : m), rs[0]);
    const sum = (k: string) => rs.reduce((t, r) => t + (Number(r[k]) || 0), 0);
    return { source, rows: rs.length, from: days[0] ?? '', to: days[days.length - 1] ?? '', citations: sum('citations'), impressions: sum('impressions'), clicks: sum('clicks'), importedAt: s(latest.imported_at), fileName: s(latest.file_name) };
  });
}

// ---------------- deleting questions ----------------

/**
 * W2-A: deletes questions from the panel. Only the domain's own rows change: every write is filtered by domain AND prompt id. The answers
 * already stored keep their history; the question is no longer listed or asked.
 *
 * R-A7 (review 2026-10-23): the row is KEPT as a tombstone, never removed. The engine's panel writer (Prompt_Rows.js, F2) treats every
 * stored question of the site, whatever its status, as already there, and asks none whose status is `off` (AI Plan, Pulse Plan, Pilot
 * Plan). A removed row let the next weekly run write the same question again as `active` and ask (and bill) it. So a delete sets
 * `status: 'off'` with `origin: 'deleted'` (AI_PROMPT_DELETED), and the app hides those rows everywhere. Adding the same question again as
 * the owner's own brings it back (Site Admin's add writes the same id as active).
 * R-A16: the writes run a few at a time; the caller audits what was done even when some failed (`failed`).
 */
export async function deleteAiPrompts(site: SiteRow, ids: string[]): Promise<{ deleted: number; failed: string[]; ids: string[] }> {
  const stored = new Set((await siteRows<AiPromptRow>('aiPrompts', site.domain, { max: AI_READ_LIMITS.prompts, fresh: true })).filter((p) => !aiPromptDeleted(p)).map((p) => s(p.prompt_id)));
  const mine = [...new Set(ids)].filter((id) => stored.has(id));
  const now = new Date().toISOString();
  const done: string[] = [], failed: string[] = [];
  for (let i = 0; i < mine.length; i += 8)
    await Promise.all(
      mine.slice(i, i + 8).map((id) =>
        updateRows('aiPrompts', [{ columnName: 'domain', condition: 'eq', value: site.domain }, { columnName: 'prompt_id', condition: 'eq', value: id }], {
          status: 'off',
          origin: AI_PROMPT_DELETED,
          pinned: false,
          fit_note: `Deleted by the owner on ${now.slice(0, 10)}; kept so it is not written or asked again.`,
          updated_at: now,
        }).then(
          () => void done.push(id),
          () => void failed.push(id),
        ),
      ),
    );
  invalidateSite(site.domain);
  return { deleted: done.length, failed, ids: done };
}

/** For tests: the per-run segment rows a filter reads (exported so a test can check one row). */
export const segmentRowsOf = (r: Pick<AiVisibilityRow, 'segments_json'>) => aiSegmentsFromJson(s(r.segments_json))?.rows ?? [];
