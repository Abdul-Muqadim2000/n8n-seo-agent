import { ArrowRight, Lightbulb } from 'lucide-react';
import { useOrgCtx } from '@/lib/context';
import { paths } from '@/lib/paths';
import { Badge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { ExternalLink } from '@/components/ui/misc';
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

/** Actions the engine recommends; the ones with an `api_body` open the matching tool pre-filled. */
export function ActionList({ actions, siteId, title = 'What to do next', description }: { actions: P[]; siteId: string | null; title?: string; description?: string }) {
  const { org, can } = useOrgCtx();
  if (!actions.length) return null;
  const sorted = [...actions].sort((a, b) => (num(a.priority) ?? 9) - (num(b.priority) ?? 9));
  return (
    <Block title={title} description={description ?? `${sorted.length} recommended actions, most important first`} icon={<Lightbulb className="size-4" />}>
      <ol className="space-y-3">
        {sorted.map((a, i) => {
          const body = obj(a.api_body);
          const run = Object.keys(body).length ? prefillFromApiBody(body) : null;
          const type = str(a.type);
          const kw = str(a.keyword);
          return (
            <li key={i} className="flex gap-3 rounded-lg border border-line p-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold tabular text-accent-text">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  {num(a.priority) != null && <Badge tone={num(a.priority) === 1 ? 'serious' : num(a.priority) === 2 ? 'warning' : 'neutral'}>P{num(a.priority)}</Badge>}
                  {type && <Badge>{TYPE_LABEL[type] ?? type}</Badge>}
                </div>
                <p className="mt-1.5 text-sm leading-relaxed text-ink">{str(a.action)}</p>
                {str(a.why) && <p className="mt-1 text-[13px] leading-relaxed text-ink-3">{str(a.why)}</p>}
                {str(a.url) && (
                  <p className="mt-1 text-[13px]">
                    <ExternalLink href={str(a.url)}>{shortUrl(str(a.url))}</ExternalLink>
                  </p>
                )}
                <div className="mt-2 flex flex-wrap gap-2">
                  {run && can('member') && (
                    <ButtonLink to={paths.tool(org.id, run.mode, { siteId, prefill: run.prefill })} size="sm" icon={<ArrowRight className="size-3.5" />}>
                      {run.mode === 'keyword' ? (run.prefill.existingPageUrl ? 'Improve this page' : 'Write this page') : modeTitle(run.mode)}
                    </ButtonLink>
                  )}
                  {!run && (type === 'publish' || type === 'index') && kw && can('member') && (
                    <ButtonLink to={paths.tool(org.id, 'published', { siteId, prefill: { keyword: kw, publishedUrl: str(a.url) } })} size="sm" variant="secondary" icon={<ArrowRight className="size-3.5" />}>
                      I published it
                    </ButtonLink>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </Block>
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
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-ink-3">This week in brief</p>
      {str(brief.headline) && <h2 className="text-lg font-semibold leading-snug tracking-tight text-ink">{str(brief.headline)}</h2>}
      {str(brief.summary) && <p className="mt-2 text-sm leading-relaxed text-ink-2">{str(brief.summary)}</p>}
      {recs.length > 0 && (
        <div className="mt-4">
          <h4 className="mb-1.5 text-xs font-medium uppercase tracking-wide text-ink-3">The analyst recommends</h4>
          <ol className="list-decimal space-y-1.5 pl-5 text-[13px] leading-relaxed text-ink-2">
            {recs.map((a, i) => (
              <li key={i}>
                <span className="text-ink">{str(a.action)}</span>
                {str(a.why) && <span className="text-ink-3"> {str(a.why)}</span>}
              </li>
            ))}
          </ol>
        </div>
      )}
      {(highlights.length > 0 || watch.length > 0) && (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {highlights.length > 0 && (
            <div>
              <h4 className="mb-1.5 text-xs font-medium uppercase tracking-wide text-ink-3">Highlights</h4>
              <ul className="list-disc space-y-1 pl-5 text-[13px] leading-relaxed text-ink-2">
                {highlights.map((h, i) => (
                  <li key={i}>{h}</li>
                ))}
              </ul>
            </div>
          )}
          {watch.length > 0 && (
            <div>
              <h4 className="mb-1.5 text-xs font-medium uppercase tracking-wide text-ink-3">Watch</h4>
              <ul className="list-disc space-y-1 pl-5 text-[13px] leading-relaxed text-ink-2">
                {watch.map((h, i) => (
                  <li key={i}>{h}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
