// Link building, what the person does on their own: listings to add (nothing is submitted for you), redirects for old URLs that 404,
// and what won links did for their pages (against a control; never "caused").
import { toast } from 'sonner';
import { ArrowRight, BarChart3, ClipboardList, CornerDownRight, ExternalLink as ExternalIcon, Undo2 } from 'lucide-react';
import type { LinkBuildingData } from '@seo/shared';
import { toastError } from '@/lib/api';
import { useListingStatus } from '@/lib/queries';
import { fmtDate } from '@/lib/utils';
import { Collapsible, InsightItem, type IconTileTone } from '@/components/insight';
import { Badge, StatusBadge, type Tone } from '@/components/ui/badge';
import { Button, buttonClass } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/feedback';
import { CopyButton, ExternalLink } from '@/components/ui/misc';
import { Chips, Panel, useSitePage } from '../kit';
import { urlPath } from '../format';
import { verdictOf } from './common';

type Listing = LinkBuildingData['listings'][number];

const LISTING: Record<string, { label: string; tone: Tone; tile: IconTileTone }> = {
  linked: { label: 'Linked', tone: 'good', tile: 'good' },
  listed: { label: 'Listed, no link seen', tone: 'accent', tile: 'blue' },
  missing: { label: 'Not listed', tone: 'warning', tile: 'warning' },
  submitted: { label: 'Submitted', tone: 'accent', tile: 'blue' },
  unknown: { label: 'Can\'t check automatically', tone: 'neutral', tile: 'neutral' },
  ignored: { label: 'Not relevant', tone: 'neutral', tile: 'neutral' },
};
const listingOf = (s: string) => LISTING[s] ?? LISTING.unknown!;
/** what a status means, under the listing */
const LISTING_NOTE: Record<string, string> = {
  unknown: 'Can\'t check automatically: the site blocks bots, so check it yourself.',
  listed: 'You are listed, but we did not see a link to your website: add it to your profile.',
  submitted: 'We look for your listing every week and mark it linked once it is live.',
  linked: 'Your profile links to your website.',
};
const ORDER: Record<string, number> = { missing: 0, unknown: 1, listed: 2, submitted: 3, linked: 4, ignored: 5 };

export function Listings({ d }: { d: LinkBuildingData }) {
  const todo = d.listings.filter((l) => l.status !== 'linked' && l.status !== 'ignored').sort((a, b) => (ORDER[a.status] ?? 9) - (ORDER[b.status] ?? 9) || a.priority - b.priority);
  const done = d.listings.filter((l) => l.status === 'linked');
  const ignored = d.listings.filter((l) => l.status === 'ignored');
  return (
    <section id="listings" className="scroll-mt-20">
      <Panel
        title="Links you can add yourself"
        icon={<ClipboardList />}
        description={d.listings.length ? `${todo.filter((l) => l.status === 'missing').length} not listed yet · ${done.length} linked` : 'Directories, platforms and lists worth being on'}
        info="Platforms forbid bots and Google names automated link creation as spam, so nothing is submitted for you: you submit, we check every week whether your listing is live and links to you."
        flush
      >
        {d.listings.length ? (
          <>
            {todo.length > 0 ? (
              <ul className="divide-y divide-line border-t border-line">
                {todo.map((l, i) => (
                  <ListingRow key={`${l.id || l.name}|${i}`} l={l} />
                ))}
              </ul>
            ) : (
              <p className="border-t border-line px-5 py-4 text-[13px] text-ink-2">Nothing left to add: you are on every listing we track.</p>
            )}
            {(done.length > 0 || ignored.length > 0) && (
              <div className="border-t border-line px-5 py-3">
                <Collapsible label={`${done.length} linked${ignored.length ? ` · ${ignored.length} not relevant` : ''}`} openLabel="Hide" contentClassName="pt-2">
                  <ul className="-mx-5 divide-y divide-line">
                    {[...done, ...ignored].map((l, i) => (
                      <ListingRow key={`${l.id || l.name}|${i}`} l={l} />
                    ))}
                  </ul>
                </Collapsible>
              </div>
            )}
          </>
        ) : (
          <EmptyState className="border-t border-line py-8" icon={<ClipboardList className="size-5" />} title="No listings checked yet" description="The weekly run checks the directories and platforms that matter for your business (and whether your competitors are on them), then lists here where you can add yourself." />
        )}
      </Panel>
    </section>
  );
}

function ListingRow({ l }: { l: Listing }) {
  const { org, site, can } = useSitePage();
  const set = useListingStatus(org.id, site.id);
  const member = can('member');
  const st = listingOf(l.status);
  const mark = (status: 'submitted' | 'listed' | 'ignored' | 'missing', done: string) =>
    set.mutate({ listingId: l.id, status }, { onSuccess: () => toast.success(`${l.name}: ${done}`), onError: (e) => toastError(e) });
  const busy = (s: string) => set.isPending && set.variables?.status === s;
  const open = l.status === 'missing' || l.status === 'unknown';
  return (
    <InsightItem
      tone={st.tile}
      icon={l.status === 'linked' ? undefined : <ClipboardList />}
      actionPosition="side"
      meta={
        <>
          {st.tone === 'neutral' ? <Badge>{st.label}</Badge> : <StatusBadge tone={st.tone}>{st.label}</StatusBadge>}
          {l.category && <Badge className="h-5 px-1.5 font-normal">{l.category}</Badge>}
          {l.rel && l.rel !== 'follow' && l.status === 'linked' && <Badge className="h-5 px-1.5 font-normal">{l.rel}</Badge>}
        </>
      }
      title={l.profileUrl ? <ExternalLink href={l.profileUrl}>{l.name}</ExternalLink> : l.name}
      description={
        <span className="block space-y-0.5">
          {l.why && <span className="block [overflow-wrap:anywhere]">{l.why}</span>}
          {LISTING_NOTE[l.status] && <span className="block">{LISTING_NOTE[l.status]}</span>}
          {l.competitors.length > 0 && (
            <span className="flex flex-wrap items-center gap-1.5">
              Competitors there: <Chips items={l.competitors} max={3} />
            </span>
          )}
          {l.submittedAt && l.status === 'submitted' && <span className="block">Submitted {fmtDate(l.submittedAt)}</span>}
          {l.note && <span className="block">Note: {l.note}</span>}
        </span>
      }
      action={
        <>
          {l.submitUrl && l.status !== 'linked' && l.status !== 'ignored' && (
            <a href={l.submitUrl} target="_blank" rel="noopener noreferrer" className={buttonClass(open ? 'secondary' : 'ghost', 'sm')}>
              <ExternalIcon className="size-3.5" aria-hidden />
              Open submission page
            </a>
          )}
          {member && open && (
            <Button size="sm" variant="secondary" loading={busy('submitted')} onClick={() => mark('submitted', 'marked submitted')}>
              I've submitted
            </Button>
          )}
          {member && (open || l.status === 'submitted') && (
            <Button size="sm" variant="ghost" loading={busy('listed')} onClick={() => mark('listed', 'marked listed')}>
              I'm listed
            </Button>
          )}
          {member && l.status !== 'linked' && l.status !== 'ignored' && (
            <Button size="sm" variant="ghost" loading={busy('ignored')} onClick={() => mark('ignored', 'marked not relevant')}>
              Not relevant
            </Button>
          )}
          {member && l.status === 'ignored' && (
            <Button size="sm" variant="ghost" icon={<Undo2 className="size-3.5" />} loading={busy('missing')} onClick={() => mark('missing', 'back on the list')}>
              Show again
            </Button>
          )}
        </>
      }
    />
  );
}

export function Redirects({ d }: { d: LinkBuildingData }) {
  const list = d.redirects.map((r) => `${r.from} ${r.to}`).join('\n');
  return (
    <section id="redirects" className="scroll-mt-20">
      <Panel
        title="Redirects to add"
        icon={<CornerDownRight />}
        description={d.redirects.length ? `${d.redirects.length} old ${d.redirects.length === 1 ? 'URL of yours answers' : 'URLs of yours answer'} 404` : 'Old URLs of yours that now answer 404'}
        info="Old addresses of your site (from the Wayback Machine and links other sites still point at) that now answer 404. A 301 redirect to the closest live page keeps the value of the links that point at them."
        actions={d.redirects.length > 1 ? <CopyButton text={list} label="Copy the list" /> : undefined}
        flush
      >
        {d.redirects.length ? (
          <ul className="divide-y divide-line border-t border-line">
            {d.redirects.map((r, i) => (
              <li key={`${r.from}|${r.to}|${i}`} className="px-5 py-3 text-[13px]">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
                  <code className="min-w-0 font-mono text-xs text-ink-2 [overflow-wrap:anywhere]">{r.from}</code>
                  <ArrowRight className="hidden size-3.5 shrink-0 text-ink-3 sm:block" aria-hidden />
                  <span className="text-xs text-ink-3 sm:hidden">redirect to</span>
                  {r.to ? <ExternalLink href={r.to}>{urlPath(r.to)}</ExternalLink> : <span className="text-ink-3">no close page found</span>}
                </div>
                {r.reason && <p className="mt-1 text-xs text-ink-3 [overflow-wrap:anywhere]">{r.reason}</p>}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState className="border-t border-line py-8" icon={<CornerDownRight className="size-5" />} title="No redirects needed" description="None of your old URLs that we know of answers 404. The weekly run checks again." />
        )}
      </Panel>
    </section>
  );
}

const pos = (v: number | null) => (v == null ? '-' : v.toFixed(1).replace(/\.0$/, ''));
/** "+2.4 places" (positions: a fall in the number is a gain) */
const places = (v: number | null) => (v == null ? null : `${v < 0 ? '+' : v > 0 ? '−' : '±'}${Math.abs(v).toFixed(1).replace(/\.0$/, '')} ${Math.abs(v) === 1 ? 'place' : 'places'}`);

export function Impact({ d }: { d: LinkBuildingData }) {
  return (
    <section id="impact" className="scroll-mt-20">
      <Panel
        title="What your links did"
        icon={<BarChart3 />}
        description={d.impact.length ? `${d.impact.length} won ${d.impact.length === 1 ? 'link' : 'links'} followed in Search Console` : 'The position of the page each won link points to'}
        info="From the day our check first found the link live, we compare the page's Search Console position with your other pages that got no new link (the control), at 6, 10 and 16 weeks. Site-wide swings and Google updates cancel out. We say &quot;likely helped&quot;, never &quot;caused&quot;: rankings have many causes."
        flush
      >
        {d.impact.length ? (
          <ul className="divide-y divide-line border-t border-line">
            {d.impact.map((r, i) => {
              const v = verdictOf(r.verdict);
              const tile: IconTileTone = v.tone === 'good' ? 'good' : v.tone === 'accent' ? 'blue' : 'neutral';
              return (
                <InsightItem
                  key={`${r.refDomain}|${r.targetUrl}|${r.t0}|${i}`}
                  tone={tile}
                  icon={<BarChart3 />}
                  actionPosition="side"
                  meta={
                    <>
                      {v.tone === 'neutral' ? <Badge>{v.label}</Badge> : <StatusBadge tone={v.tone}>{v.label}</StatusBadge>}
                      <span className="text-xs text-ink-3">
                        {r.weeks} {r.weeks === 1 ? 'week' : 'weeks'} since {fmtDate(r.t0)}
                      </span>
                    </>
                  }
                  title={
                    <>
                      {r.refDomain} <span className="font-normal text-ink-3">to</span> {r.targetUrl ? <ExternalLink href={r.targetUrl}>{urlPath(r.targetUrl)}</ExternalLink> : 'your page'}
                    </>
                  }
                  description={
                    <span className="block space-y-0.5">
                      <span className="block">
                        Position {pos(r.basePosition)} to {pos(r.position)}
                        {r.keyword ? ` for "${r.keyword}"` : ''}
                        {places(r.effect) ? ` · ${places(r.effect)} beyond your other pages` : ''}
                      </span>
                      {r.note && <span className="block [overflow-wrap:anywhere]">{r.note}</span>}
                    </span>
                  }
                  detail={
                    r.pageChange != null || r.controlChange != null ? (
                      <>
                        This page moved {pos(r.pageChange)} positions; your other pages without a new link moved {pos(r.controlChange)} in the same weeks (the control). The difference, {pos(r.effect)}, is what the link
                        may have done. A negative number is a gain (a smaller position is higher).
                        {r.fromUrl && (
                          <>
                            {' '}
                            The link: <ExternalLink href={r.fromUrl}>{urlPath(r.fromUrl)}</ExternalLink>
                          </>
                        )}
                      </>
                    ) : undefined
                  }
                />
              );
            })}
          </ul>
        ) : (
          <EmptyState className="border-t border-line py-8" icon={<BarChart3 className="size-5" />} title="No won links to measure yet" description="Once a link is live, we follow the position of the page it points to for 16 weeks against your other pages. The first read comes six weeks after the link went live." />
        )}
      </Panel>
    </section>
  );
}
