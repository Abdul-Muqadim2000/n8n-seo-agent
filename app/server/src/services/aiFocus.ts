import {
  AI_PROMPTS_STORED_DEFAULT,
  countryOf,
  creditsFor,
  estimateAiPanelCost,
  type AiFocusContext,
  type AiPromptRow,
  type ContentLogRow,
  type LadderRow,
  type LadderSettingsRow,
  type MonitorsRow,
  type SiteRow as EngineSiteRow,
} from '@seo/shared';
import type { SiteRow } from '../db/schema';
import { siteRows } from '../n8n/client';
import { settingsRow } from './admin/settings';

/**
 * AI-FOCUS (2026-10-27, n8n/seo-agent/docs/ai-panel-focus-2026-10-27/RESEARCH_AND_DESIGN.md §4.9): what the two AI panel warnings of the
 * one registry read about a website (ai.panel_off_focus, ai.ladder_not_measured; @seo/shared ai-focus.ts): its ladders with their status,
 * the pages written, the services it declared, the keywords it tracks, the stored questions with their focus fields, and the panel size with
 * the price a month of a bigger one in credits. Each part is read on its own; a part that cannot be read is simply empty (not judged).
 */
const list = (v: unknown): string[] => String(v ?? '').split(/[\n,;]+/).map((x) => x.trim()).filter(Boolean);

export async function aiFocusCtx(site: SiteRow, prompts: readonly AiPromptRow[], engine: EngineSiteRow | null): Promise<AiFocusContext | null> {
  const iso = countryOf(site.country)?.iso ?? '';
  if (!iso || !prompts.length) return null;
  const [ladders, settings, log, mons, cs] = await Promise.all([
    siteRows<LadderRow>('ladders', site.domain, { max: 2000 }).catch(() => [] as LadderRow[]),
    siteRows<LadderSettingsRow>('ladderSettings', site.domain, { max: 500 }).catch(() => [] as LadderSettingsRow[]),
    siteRows<ContentLogRow>('contentLog', site.domain, { max: 1000 }).catch(() => [] as ContentLogRow[]),
    siteRows<MonitorsRow>('monitors', site.domain, { max: 5 }).catch(() => [] as MonitorsRow[]),
    settingsRow().catch(() => null),
  ]);
  const setOf = new Map(settings.map((r) => [r.ladder_id, r]));
  const by = new Map<string, { id: string; head: string; status?: string; chosenBy?: string; createdAt?: string; rungs: string[] }>();
  for (const r of ladders) {
    if (!r.ladder_id || !r.head_keyword) continue;
    const s = setOf.get(r.ladder_id);
    const l = by.get(r.ladder_id) ?? { id: r.ladder_id, head: r.head_keyword, status: s?.status || 'active', chosenBy: s?.chosen_by || '', createdAt: s?.created_at || r.start_date || '', rungs: [] };
    if (Number(r.rung) !== 4 && r.keyword) l.rungs.push(r.keyword);
    by.set(r.ladder_id, l);
  }
  const m = mons[0];
  const panelSize = m && Number(m.ai_prompts_max) > 0 ? Math.min(500, Math.max(3, Math.round(Number(m.ai_prompts_max)))) : m ? AI_PROMPTS_STORED_DEFAULT : 50;
  const engines = list(m?.ai_engines);
  const now = estimateAiPanelCost({ panel: panelSize, engines: engines.length ? engines : undefined }).month.total;
  return {
    panelSize,
    iso,
    ownMarket: `${iso}-${(engine?.language_code || 'en').toLowerCase()}`,
    markets: list(m?.ai_markets),
    ladders: [...by.values()],
    pages: log.filter((r) => ['written', 'published'].includes(String(r.status))).map((r) => ({ keyword: r.keyword, status: r.status, at: r.published_at || r.started_at })),
    services: site.services ?? [],
    keywords: list(engine?.keywords),
    questions: prompts.map((p) => ({ ...p, pinned: p.pinned === true || String(p.pinned) === 'true' })),
    focusMode: String((m as unknown as Record<string, unknown> | undefined)?.ai_focus_mode ?? '') === 'off' ? 'off' : 'auto',
    raisePrice: (to: number) => {
      if (!cs) return '';
      const more = estimateAiPanelCost({ panel: to, engines: engines.length ? engines : undefined }).month.total - now;
      return more > 0 ? `about ${Math.max(1, Math.round(creditsFor(more, cs)))} more credits a month` : '';
    },
  };
}
