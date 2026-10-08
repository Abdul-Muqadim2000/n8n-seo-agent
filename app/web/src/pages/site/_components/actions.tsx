// Actions the SEO engine recommends in its weekly reports, each with a ready-made run when it has one.
import type { ReactNode } from 'react';
import { ArrowRight, BadgeCheck, Code2, ExternalLink as ExternalIcon, Link2, Mail, Megaphone, MousePointerClick, PenSquare, Search, Sparkles, Upload, Wrench } from 'lucide-react';
import {
  COUNTRY_NAMES,
  GOAL_VALUES,
  MODE_IDS,
  PAGE_TYPE_VALUES,
  RUN_SCHEMAS,
  TONES,
  splitList,
  titleCase,
  type EngineAction,
  type ModeId,
} from '@seo/shared';
import { ButtonLink } from '@/components/ui/button';
import { InsightItem } from '@/components/insight';
import { fmtAgo } from '@/lib/utils';
import { Kind, PriorityBadge, priorityFromNumber, useSitePage } from './kit';
import { urlPath } from './format';

const camel = (k: string) => k.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());
const SKIP = new Set(['mode', 'siteId', 'domain', 'email', 'callbackUrl', 'requestId', 'ladderId', 'ladderRung', 'ladderHead', 'source', 'week']);
const ENUMS: Record<string, readonly string[]> = { pageType: PAGE_TYPE_VALUES, country: COUNTRY_NAMES, goal: GOAL_VALUES, tone: TONES };

/** Turns an engine action's n8n API body (snake_case) into the app's tool form prefill (camelCase fields of the mode's schema). */
export function runFromApiBody(body: Record<string, unknown> | null | undefined): { mode: ModeId; prefill: Record<string, unknown> } | null {
  if (!body) return null;
  const mode = String(body.mode ?? '') as ModeId;
  if (!(MODE_IDS as readonly string[]).includes(mode)) return null;
  const shape = (RUN_SCHEMAS[mode] as unknown as { shape?: Record<string, unknown> }).shape;
  const allowed = shape ? new Set(Object.keys(shape)) : null;
  const out: Record<string, unknown> = {};
  for (const [rawKey, v] of Object.entries(body)) {
    if (v == null || v === '') continue;
    const k = camel(rawKey);
    if (SKIP.has(k)) continue;
    if (k === 'receive' && Array.isArray(v)) {
      const items = v.map(String);
      out.receiveReport = items.some((x) => /report/i.test(x));
      out.receiveContent = items.some((x) => /content|page/i.test(x));
      continue;
    }
    let val: unknown = v;
    if (k === 'reportType') val = /full/i.test(String(v)) ? 'full' : 'site_audit';
    if (k === 'competitors' && typeof v === 'string') val = splitList(v);
    if (ENUMS[k] && !ENUMS[k].includes(String(v))) continue;
    if (allowed && !allowed.has(k)) continue;
    out[k] = val;
  }
  return { mode, prefill: out };
}

const TYPE_LABEL: Record<string, string> = { pr: 'Digital PR', seo: 'SEO', ctr: 'Click-through', content: 'Content', publish: 'Publish', technical: 'Technical', links: 'Links', backlinks: 'Links', outreach: 'Outreach', schema: 'Schema', entity: 'Brand entity', brand: 'Brand' };
const typeLabel = (t: string) => TYPE_LABEL[t.toLowerCase()] ?? (t.length <= 3 ? t.toUpperCase() : titleCase(t));
/** the icon tile of an action, by its type (blue: a category, not a status) */
const TYPE_ICON: Record<string, ReactNode> = {
  pr: <Megaphone />,
  seo: <Search />,
  ctr: <MousePointerClick />,
  content: <PenSquare />,
  publish: <Upload />,
  technical: <Wrench />,
  links: <Link2 />,
  backlinks: <Link2 />,
  outreach: <Mail />,
  schema: <Code2 />,
  entity: <BadgeCheck />,
  brand: <BadgeCheck />,
};

const RUN_LABEL: Partial<Record<ModeId, string>> = {
  keyword: 'Write the page',
  verdict: 'Check the keyword',
  audit: 'Run the audit',
  ladder: 'Plan the ladder',
  published: 'Report it published',
  ai_visibility: 'Run the check',
  backlinks: 'Run a backlink check',
  case_study: 'Write the case study',
  checkin: 'Record the check-in',
};

/** The engine's own to-do list, ordered by its priority. */
export function EngineActionList({ actions, limit, showSource }: { actions: readonly EngineAction[]; limit?: number; showSource?: boolean }) {
  const { can, tool } = useSitePage();
  const rows = [...actions].sort((a, b) => a.priority - b.priority).slice(0, limit ?? actions.length);
  if (!rows.length) return null;
  return (
    <ol className="divide-y divide-line">
      {rows.map((a, i) => {
        const run = runFromApiBody(a.apiBody) ?? (a.type === 'publish' && a.keyword ? { mode: 'published' as ModeId, prefill: { keyword: a.keyword, ...(a.url ? { publishedUrl: a.url } : {}) } } : null);
        return (
          <InsightItem
            key={`${a.type}-${i}`}
            icon={TYPE_ICON[String(a.type ?? '').toLowerCase()] ?? <Sparkles />}
            meta={
              <>
                <PriorityBadge priority={priorityFromNumber(a.priority)} short />
                {a.type && <Kind>{typeLabel(a.type)}</Kind>}
                {showSource && (
                  <span className="text-xs text-ink-3">
                    {titleCase(a.source)} · {fmtAgo(a.receivedAt)}
                  </span>
                )}
              </>
            }
            title={a.action}
            description={
              a.why || a.keyword || a.url ? (
                <>
                  {a.why && <span className="block text-[13px] leading-relaxed text-ink-2">{a.why}</span>}
                  {(a.keyword || a.url) && (
                    <span className={a.why ? 'mt-1.5 flex flex-wrap gap-x-3 gap-y-1' : 'flex flex-wrap gap-x-3 gap-y-1'}>
                      {a.keyword && (
                        <span>
                          Keyword: <span className="text-ink-2">{a.keyword}</span>
                        </span>
                      )}
                      {a.url && (
                        <a href={a.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-accent-text hover:underline transition-colors duration-150 ease-brand">
                          {urlPath(a.url)}
                          <ExternalIcon className="size-3" aria-hidden />
                        </a>
                      )}
                    </span>
                  )}
                </>
              ) : undefined
            }
            action={
              run && can('member') ? (
                <ButtonLink to={tool(run.mode, run.prefill)} size="sm" variant={i === 0 ? 'primary' : 'secondary'} className="group/act">
                  {RUN_LABEL[run.mode] ?? 'Start'}
                  <ArrowRight className="size-3.5 transition-transform duration-200 ease-brand group-hover/act:translate-x-0.5" aria-hidden />
                </ButtonLink>
              ) : undefined
            }
            actionPosition="side"
          />
        );
      })}
    </ol>
  );
}
