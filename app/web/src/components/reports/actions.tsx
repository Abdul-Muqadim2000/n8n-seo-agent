import type { ReactNode } from 'react';
import { ArrowRight, Eye, Lightbulb, ListOrdered, Sparkles, Star } from 'lucide-react';
import { useOrgCtx } from '@/lib/context';
import { paths } from '@/lib/paths';
import { Badge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { ExternalLink } from '@/components/ui/misc';
import { IconTile, InsightItem } from '@/components/insight';
import { Block, num, obj, shortUrl, str, type P } from './kit';
import { modeTitle, prefillFromApiBody } from './meta';

const TYPE_LABEL: Record<string, string> = {
  publish: 'Publish',
  index: 'Get indexed',
  striking: 'Striking distance',
  ctr: 'Click-through',
  content: 'Content',
  decay: 'Refresh',
  links: 'Links',
  technical: 'Technical',
  trend: 'Trend',
};

/** Recommended actions, most important first (priority 1 = most urgent). */
export const sortActions = (actions: P[]) => [...actions].sort((a, b) => (num(a.priority) ?? 9) - (num(b.priority) ?? 9));

/** The button of one recommended action: an `api_body` opens the matching tool pre-filled; publish / index actions open "I published it". */
export function ActionRunButton({ action: a, siteId, variant }: { action: P; siteId: string | null; variant?: 'primary' | 'secondary' }) {
  const { org, can } = useOrgCtx();
  const body = obj(a.api_body);
  const run = Object.keys(body).length ? prefillFromApiBody(body) : null;
  const type = str(a.type);
  const kw = str(a.keyword);
  if (run && can('member'))
    return (
      <ButtonLink to={paths.tool(org.id, run.mode, { siteId, prefill: run.prefill })} size="sm" variant={variant ?? 'primary'} icon={<ArrowRight className="size-3.5" />}>
        {run.mode === 'keyword' ? (run.prefill.existingPageUrl ? 'Improve this page' : 'Write this page') : modeTitle(run.mode)}
      </ButtonLink>
    );
  if (!run && (type === 'publish' || type === 'index') && kw && can('member'))
    return (
      <ButtonLink to={paths.tool(org.id, 'published', { siteId, prefill: { keyword: kw, publishedUrl: str(a.url) } })} size="sm" variant={variant ?? 'secondary'} icon={<ArrowRight className="size-3.5" />}>
        I published it
      </ButtonLink>
    );
  return null;
}

const priorityTone = (p: number | null) => (p === 1 ? 'serious' : p === 2 ? 'warning' : 'neutral');

/** Actions the engine recommends; the ones with an `api_body` open the matching tool pre-filled. */
export function ActionList({ actions, siteId, title = 'What to do next', description }: { actions: P[]; siteId: string | null; title?: string; description?: string }) {
  if (!actions.length) return null;
  const sorted = sortActions(actions);
  return (
    <Block title={title} description={description ?? `${sorted.length} recommended actions, most important first`} icon={<Lightbulb />} flush>
      <ol className="divide-y divide-line">
        {sorted.map((a, i) => {
          const type = str(a.type);
          return (
            <InsightItem
              key={i}
              icon={<span className="font-display text-xs font-semibold tabular">{i + 1}</span>}
              meta={
                num(a.priority) != null || type ? (
                  <>
                    {num(a.priority) != null && <Badge tone={priorityTone(num(a.priority))}>P{num(a.priority)}</Badge>}
                    {type && <Badge>{TYPE_LABEL[type] ?? type}</Badge>}
                  </>
                ) : undefined
              }
              title={<span className="font-normal leading-relaxed">{str(a.action)}</span>}
              description={
                str(a.why) || str(a.url) ? (
                  <>
                    {str(a.why) && <span className="block text-[13px] leading-relaxed">{str(a.why)}</span>}
                    {str(a.url) && (
                      <span className="mt-0.5 block text-[13px]">
                        <ExternalLink href={str(a.url)}>{shortUrl(str(a.url))}</ExternalLink>
                      </span>
                    )}
                  </>
                ) : undefined
              }
              action={<ActionRunButton action={a} siteId={siteId} />}
              actionPosition="side"
            />
          );
        })}
      </ol>
    </Block>
  );
}

function BriefList({ icon, title, items }: { icon: ReactNode; title: string; items: string[] }) {
  return (
    <div className="rounded-lg bg-surface-2/60 p-3.5">
      <h4 className="mb-2 flex items-center gap-2 text-xs font-medium tracking-wide text-ink-3 uppercase">
        <IconTile size="xs">{icon}</IconTile>
        {title}
      </h4>
      <ul className="space-y-1.5 text-[13px] leading-relaxed text-ink-2">
        {items.map((h, i) => (
          <li key={i} className="flex gap-2">
            <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
            <span className="min-w-0">{h}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The AI-written weekly brief (site tracker, AI visibility): headline, summary, highlights, what to watch. */
export function BriefCard({ brief }: { brief: P }) {
  const highlights = Array.isArray(brief.highlights) ? brief.highlights.map(str).filter(Boolean) : [];
  const watch = Array.isArray(brief.watch) ? brief.watch.map(str).filter(Boolean) : [];
  const recs = (Array.isArray(brief.actions) ? brief.actions : []).map(obj).filter((a) => str(a.action));
  if (!str(brief.headline) && !str(brief.summary)) return null;
  return (
    <div className="rounded-xl border border-line bg-surface p-5 shadow-card">
      <p className="mb-2 flex items-center gap-2 text-xs font-medium tracking-wide text-ink-3 uppercase">
        <IconTile size="xs">
          <Sparkles />
        </IconTile>
        This week in brief
      </p>
      {str(brief.headline) && <h2 className="font-display text-lg leading-snug font-semibold tracking-[-0.01em] text-ink">{str(brief.headline)}</h2>}
      {str(brief.summary) && <p className="mt-2 text-sm leading-relaxed text-ink-2">{str(brief.summary)}</p>}
      {recs.length > 0 && (
        <div className="mt-4">
          <h4 className="mb-2 flex items-center gap-2 text-xs font-medium tracking-wide text-ink-3 uppercase">
            <IconTile size="xs">
              <ListOrdered />
            </IconTile>
            The analyst recommends
          </h4>
          <ol className="space-y-2 text-[13px] leading-relaxed text-ink-2">
            {recs.map((a, i) => (
              <li key={i} className="flex gap-2.5">
                <span className="mt-px flex size-5 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-accent-ink tabular">{i + 1}</span>
                <span className="min-w-0">
                  <span className="text-ink">{str(a.action)}</span>
                  {str(a.why) && <span className="text-ink-3"> {str(a.why)}</span>}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
      {(highlights.length > 0 || watch.length > 0) && (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {highlights.length > 0 && <BriefList icon={<Star />} title="Highlights" items={highlights} />}
          {watch.length > 0 && <BriefList icon={<Eye />} title="Watch" items={watch} />}
        </div>
      )}
    </div>
  );
}
