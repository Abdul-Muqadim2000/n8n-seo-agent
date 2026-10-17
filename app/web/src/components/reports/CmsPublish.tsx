import { useState } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, ExternalLink as ExternalIcon, FileUp, Globe, RefreshCw, Send } from 'lucide-react';
import { CMS_KIND_INFO, CMS_REMOTE_STATUS_LABEL, cmsKindLabel, type CmsPublishResult, type CmsPublishView, type ReportDetail } from '@seo/shared';
import { GuideButton } from '@/components/guide';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Button, ButtonLink } from '@/components/ui/button';
import { Callout, Skeleton } from '@/components/ui/feedback';
import { Checkbox, Field, Select } from '@/components/ui/field';
import { Dialog } from '@/components/ui/overlay';
import { errorMessage } from '@/lib/api';
import { useOrgCtx } from '@/lib/context';
import { paths } from '@/lib/paths';
import { useCmsPublish, useCmsRefresh, useCmsReportState } from '@/lib/queries';
import { fmtDateTime } from '@/lib/utils';
import { Block } from './kit';

/**
 * G2 — "Publish to your CMS" on a written page (app/docs/CMS_PUBLISHING.md §7). It shows every reason the page may not go out (the
 * server decides; this only mirrors it), sends a draft, and — for owners and admins, after an explicit confirmation — publishes live.
 * There is no override: a blocked page is fixed and run again, not forced.
 */
export function CmsPublishPanel({ report }: { report: ReportDetail }) {
  const { org, can } = useOrgCtx();
  const q = useCmsReportState(org.id, report.id);
  const siteId = report.siteId ?? '';
  const publish = useCmsPublish(org.id, report.id, siteId);
  const refresh = useCmsRefresh(org.id, report.id, siteId);
  const [chosen, setChosen] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [ticked, setTicked] = useState(false);

  if (!report.siteId) return null;
  if (q.isLoading) return <Skeleton className="h-40" />;
  if (q.error || !q.data) return null;
  const s = q.data;
  const conn = s.connections.find((c) => c.id === chosen) ?? s.connections[0];
  const item = conn ? s.items.find((i) => i.connectionId === conn.id) : undefined;
  const url = conn ? s.publicUrls[conn.id] : '';
  const r = s.readiness;
  const live = item?.remoteStatus === 'published';

  const after = (res: CmsPublishResult, what: string) => {
    if (res.ok) toast.success(what, { description: [...res.record.notes].slice(-2).join(' ') || undefined });
    else toast.error(res.record.error || 'Nothing was sent.');
  };
  const send = async (mode: 'draft' | 'live') => {
    if (!conn) return;
    try {
      const res = await publish.mutateAsync({ connectionId: conn.id, mode, confirmLive: mode === 'live' && ticked });
      after(res, mode === 'live' ? `Published live in ${conn.label}` : `Draft saved in ${conn.label}`);
      setConfirming(false);
      setTicked(false);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };
  const check = async () => {
    if (!conn) return;
    try {
      after(await refresh.mutateAsync(conn.id), live ? 'Live' : 'Checked');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <Block
      title="Publish to your CMS"
      icon={<Send />}
      description={conn ? `Drafts by default. ${s.canLive || can('admin') ? 'You can also publish live.' : 'Owners and admins publish live.'}` : 'Send this page to WordPress, Webflow, Contentful or your own stack instead of copying it by hand.'}
      actions={conn ? <GuideButton id={CMS_KIND_INFO[conn.kind].guide} vars={{ domain: report.siteDomain ?? '' }} /> : <GuideButton id="publish-page" vars={{ domain: report.siteDomain ?? '' }} />}
    >
      <div className="space-y-4">
        {r.blockers.length > 0 && (
          <Callout tone="critical" title="This page cannot go to your CMS yet">
            <ul className="list-disc space-y-1 pl-5">
              {r.blockers.map((b) => (
                <li key={b.code + b.message}>
                  {b.message}
                  {b.items && b.items.length > 0 && (
                    <span className="mt-1 flex flex-wrap gap-1.5">
                      {b.items.map((it) => (
                        <Badge key={it.token} tone={it.kind === 'review_note' ? 'warning' : 'critical'}>
                          <span className="max-w-[18rem] truncate font-mono">{it.token}</span>
                          {it.count > 1 ? ` ×${it.count}` : ''}
                        </Badge>
                      ))}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </Callout>
        )}
        {r.blockers.length === 0 && r.warnings.length > 0 && (
          <Callout tone="warning">
            <ul className="list-disc space-y-0.5 pl-5">
              {r.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </Callout>
        )}

        {!conn ? (
          <div className="flex flex-wrap items-center justify-between gap-3 text-[13px] text-ink-2">
            <span>No CMS is connected for {report.siteDomain}.</span>
            {can('admin') && (
              <ButtonLink size="sm" variant="secondary" to={paths.site(org.id, report.siteId, 'settings/publishing')}>
                Connect a CMS
              </ButtonLink>
            )}
          </div>
        ) : (
          <>
            {s.connections.length > 1 && (
              <Field label="Send to">
                {(p) => (
                  <Select {...p} value={conn.id} onChange={(e) => setChosen(e.target.value)}>
                    {s.connections.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            )}
            <div className="flex flex-wrap items-center gap-2 text-[13px] text-ink-2">
              {item ? (
                <>
                  <StatusBadge tone={live ? 'good' : 'accent'}>{`${CMS_REMOTE_STATUS_LABEL[item.remoteStatus]} in ${cmsKindLabel(item.kind)}`}</StatusBadge>
                  {item.remoteUrl && (
                    <a href={item.remoteUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-accent-text hover:underline">
                      Open it <ExternalIcon className="size-3.5" aria-hidden />
                    </a>
                  )}
                  {item.engineToldAt && <span className="inline-flex items-center gap-1"><CheckCircle2 className="size-3.5 text-good-text" aria-hidden /> tracked since {fmtDateTime(item.engineToldAt)}</span>}
                </>
              ) : (
                <span>Not in {conn.label} yet.</span>
              )}
              {conn.status !== 'ok' && <StatusBadge tone="warning">{conn.status === 'error' ? 'The connection’s last test failed' : 'Connection not tested yet'}</StatusBadge>}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {s.canDraft && !live && (
                <Button size="sm" variant={s.canLive ? 'secondary' : 'primary'} icon={<FileUp className="size-4" />} loading={publish.isPending && !confirming} onClick={() => void send('draft')}>
                  {item ? 'Update the draft' : 'Send to CMS as draft'}
                </Button>
              )}
              {s.canLive && (
                <Button size="sm" icon={<Globe className="size-4" />} onClick={() => setConfirming(true)}>
                  {live ? 'Update the live page' : 'Publish live'}
                </Button>
              )}
              {item && item.remoteStatus !== 'unknown' && !item.engineToldAt && can('member') && (
                <Button size="sm" variant="ghost" icon={<RefreshCw className="size-4" />} loading={refresh.isPending} onClick={() => void check()}>
                  Check if it is live
                </Button>
              )}
              {!s.canDraft && !s.canLive && r.blockers.length === 0 && <span className="text-[13px] text-ink-3">Members send drafts; owners and admins publish live.</span>}
              {!s.canLive && s.canDraft && r.liveAllowed && <span className="text-[13px] text-ink-3">An owner or admin publishes it live.</span>}
              {!r.liveAllowed && r.draftAllowed && r.liveRefusal && <span className="text-[13px] text-ink-3">{r.liveRefusal}</span>}
            </div>
          </>
        )}

        {s.history.length > 0 && (
          <div>
            <h4 className="mb-1.5 text-[13px] font-medium text-ink">History</h4>
            <ul className="divide-y divide-line rounded-lg border border-line">
              {s.history.slice(0, 6).map((h) => (
                <HistoryRow key={h.id} h={h} />
              ))}
            </ul>
          </div>
        )}
      </div>

      {confirming && conn && (
        <Dialog
          open
          onOpenChange={(o) => !o && (setConfirming(false), setTicked(false))}
          title={live ? 'Update the live page?' : 'Publish this page live?'}
          description={`It goes live in ${conn.label}${url ? ` at ${url}` : ''}, under your company’s name.`}
          footer={
            <>
              <Button variant="ghost" onClick={() => setConfirming(false)}>
                Cancel
              </Button>
              <Button icon={<Globe className="size-4" />} disabled={!ticked} loading={publish.isPending} onClick={() => void send('live')}>
                Publish live
              </Button>
            </>
          }
        >
          <div className="space-y-3 text-sm text-ink-2">
            <p>Ascentra then checks the live page, marks it published and starts tracking its position; the weekly posts continue.</p>
            <Checkbox label="I have read the page and want it public on our website now" checked={ticked} onChange={(e) => setTicked(e.target.checked)} />
          </div>
        </Dialog>
      )}
    </Block>
  );
}

function HistoryRow({ h }: { h: CmsPublishView }) {
  const tone = h.status === 'sent' ? 'good' : h.status === 'blocked' ? 'warning' : 'critical';
  const what = h.mode === 'live' ? 'Publish live' : h.mode === 'draft' ? 'Draft' : 'Status check';
  return (
    <li className="flex flex-col gap-1 px-3 py-2 text-[13px] sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <span className="font-medium text-ink">{what}</span>
        <span className="text-ink-3"> · {h.connectionLabel || cmsKindLabel(h.kind)} · {h.userName ?? 'someone'} · {fmtDateTime(h.createdAt)}</span>
        {(h.error || h.notes.length > 0) && <p className="mt-0.5 break-words text-ink-2">{h.error || h.notes.join(' ')}</p>}
      </div>
      <StatusBadge tone={tone}>{h.status === 'sent' ? 'Sent' : h.status === 'blocked' ? 'Refused' : 'Failed'}</StatusBadge>
    </li>
  );
}
