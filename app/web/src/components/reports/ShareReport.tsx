import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link2, Loader2, Share2, Trash2 } from 'lucide-react';
import { SHARE, shareDays, type ShareLink } from '@seo/shared';
import { api, errorMessage } from '@/lib/api';
import { useOrgCtx } from '@/lib/context';
import { fmtDate, fmtDateTime } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/feedback';
import { CopyButton } from '@/components/ui/misc';
import { Dialog } from '@/components/ui/overlay';

/**
 * G15: "Share this report": an expiring, revocable, read-only link for somebody with no account.
 * The link is shown once (only its hash is stored), the owner picks how long it lasts, every live link is listed with when it was last
 * opened, and any of them can be turned off here. Admins and owners only: a viewer can read a report but not hand it outside.
 */
export function ShareReport({ reportId }: { reportId: string }) {
  const { org, can } = useOrgCtx();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [days, setDays] = useState(String(SHARE.defaultDays));
  const [fresh, setFresh] = useState<(ShareLink & { url?: string }) | null>(null);
  const key = ['org', org.id, 'report', reportId, 'shares'] as const;
  const path = `/api/orgs/${org.id}/reports/${reportId}/shares`;

  const list = useQuery({
    queryKey: key,
    queryFn: () => api<{ items: ShareLink[] }>(path),
    enabled: open,
    retry: false,
  });
  const create = useMutation({
    mutationFn: () => api<ShareLink & { url: string }>(path, { method: 'POST', body: { days: shareDays(days) } }),
    onSuccess: (link) => {
      setFresh(link);
      void qc.invalidateQueries({ queryKey: key });
    },
  });
  const revoke = useMutation({
    mutationFn: (id: string) => api<ShareLink>(`${path}/${id}`, { method: 'DELETE' }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: key }),
  });

  if (!can('admin')) return null;
  const live = (list.data?.items ?? []).filter((l) => l.state === 'live');

  return (
    <>
      <Button variant="secondary" size="sm" icon={<Share2 className="size-4" />} onClick={() => setOpen(true)}>
        Share
      </Button>
      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) {
            setFresh(null);
            create.reset();
          }
        }}
        title="Share this report"
        description="A link anyone can open without an account. It shows this one report, read-only, and stops working on the day you choose."
      >
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-[13px] text-ink-2">
              <span className="mb-1 block font-medium">Stops working after</span>
              <input
                type="number"
                min={SHARE.minDays}
                max={SHARE.maxDays}
                value={days}
                onChange={(e) => setDays(e.target.value)}
                className="h-9 w-24 rounded-lg border border-line bg-surface-1 px-2.5 text-[13px] tabular text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              />
              <span className="ml-2 text-ink-3">days</span>
            </label>
            <Button size="sm" onClick={() => create.mutate()} disabled={create.isPending} icon={create.isPending ? <Loader2 className="size-4 animate-spin" /> : <Link2 className="size-4" />}>
              Create a link
            </Button>
          </div>

          {create.isError && <Callout tone="critical">{errorMessage(create.error)}</Callout>}

          {fresh?.url && (
            <Callout tone="good" title="Copy it now, it is shown only once">
              <span className="block break-all font-mono text-[12px] text-ink">{fresh.url}</span>
              <span className="mt-2 flex flex-wrap items-center gap-2">
                <CopyButton text={fresh.url} label="Copy the link" />
                <span className="text-[12px] text-ink-3">stops working on {fmtDate(fresh.expiresAt)}</span>
              </span>
            </Callout>
          )}

          <div>
            <h3 className="mb-2 text-[13px] font-medium text-ink-3">Links for this report</h3>
            {list.isLoading && <p className="text-[13px] text-ink-3">Loading...</p>}
            {list.isError && <Callout tone="warning">{errorMessage(list.error)}</Callout>}
            {list.data && live.length === 0 && <p className="text-[13px] text-ink-3">No live link. Nobody outside your company can open this report.</p>}
            <ul className="space-y-2">
              {(list.data?.items ?? []).map((l) => (
                <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-surface-1 px-3 py-2 text-[13px]">
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2">
                      {l.state === 'live' ? <Badge tone="good">live</Badge> : l.state === 'revoked' ? <Badge tone="neutral">turned off</Badge> : <Badge tone="warning">expired</Badge>}
                      <span className="text-ink">{l.state === 'live' ? `stops working on ${fmtDate(l.expiresAt)}` : `expired ${fmtDate(l.expiresAt)}`}</span>
                    </span>
                    <span className="mt-0.5 block text-[12px] text-ink-3">
                      {l.createdByName ? `created by ${l.createdByName}` : 'created'} {fmtDate(l.createdAt)} ·{' '}
                      {l.opens > 0 ? `opened ${l.opens}×, last ${fmtDateTime(l.lastOpenedAt)}` : 'never opened'}
                    </span>
                  </span>
                  {l.state === 'live' && (
                    <Button variant="ghost" size="sm" icon={<Trash2 className="size-4" />} onClick={() => revoke.mutate(l.id)} disabled={revoke.isPending}>
                      Turn it off
                    </Button>
                  )}
                </li>
              ))}
            </ul>
            {revoke.isError && <Callout tone="critical" className="mt-2">{errorMessage(revoke.error)}</Callout>}
          </div>
        </div>
      </Dialog>
    </>
  );
}
