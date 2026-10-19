import { useState } from 'react';
import { Download, History, ScrollText } from 'lucide-react';
import { AUDIT_CATEGORIES, retentionLabel, type AuditCategory, type AuditEventView } from '@seo/shared';
import { StatusBadge } from '@/components/ui/badge';
import { Button, buttonClass } from '@/components/ui/button';
import { CardBody, CardFooter } from '@/components/ui/card';
import { Callout, EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback';
import { Field, Input, Select } from '@/components/ui/field';
import { Dialog } from '@/components/ui/overlay';
import { useOrgCtx } from '@/lib/context';
import { auditQs, useAuditLog, type AuditFilters } from '@/lib/queries';
import { fmtDateTime } from '@/lib/utils';
import { SettingsCard } from './SettingsCard';

/**
 * credits (app/docs/CREDITS.md): no provider cost and no dollar budget in what a company reads. The server leaves them out already;
 * this also hides them on a row an older server sent (`estimatedUsd`, `monthlyBudgetUsd`, a budget change's before / after).
 */
function shownDetails(e: AuditEventView): Record<string, unknown> {
  if (e.action === 'company.budget_changed') return {};
  return Object.fromEntries(Object.entries(e.details ?? {}).filter(([k]) => !/usd$/i.test(k) && !/budget/i.test(k)));
}

const ACTOR_KIND: Record<string, string> = { scim: 'Provisioning', system: 'System', platform_admin: 'Platform administrator' };

/**
 * G1: the company's audit log (Company settings -> Audit log): who did what, when and from where, sign-ins, two-step changes, team
 * and role changes, websites, settings, API keys, sharing, single sign-on. Read-only, newest first; CSV export for a SIEM or an
 * auditor. Owners and admins only (the server refuses everyone else).
 */
export function AuditTab() {
  const { org, can } = useOrgCtx();
  const admin = can('admin');
  const [filters, setFilters] = useState<AuditFilters>({});
  const log = useAuditLog(org.id, filters, admin);
  const [open, setOpen] = useState<AuditEventView | null>(null);

  if (!admin)
    return (
      <Callout tone="info" title="Only owners and admins see the audit log">
        Ask an owner or admin of {org.name} if you need to know who changed something.
      </Callout>
    );
  if (log.error) return <ErrorState error={log.error} onRetry={() => void log.refetch()} />;

  const first = log.data?.pages[0];
  const items = log.data?.pages.flatMap((p) => p.items) ?? [];
  const set = (p: Partial<AuditFilters>) => setFilters((f) => ({ ...f, ...p }));
  const qs = auditQs(filters);

  return (
    <div className="max-w-5xl space-y-5">
      <SettingsCard
        icon={<ScrollText />}
        title="Audit log"
        description={first ? `Security and admin events of ${org.name}, kept ${retentionLabel(first.retentionDays)} (change it under Security). Nothing in it can be edited or deleted.` : 'Security and admin events.'}
        actions={
          <a href={`/api/orgs/${org.id}/audit.csv${qs ? `?${qs}` : ''}`} className={buttonClass('secondary', 'sm')} download>
            <Download className="size-4" /> Export CSV
          </a>
        }
      >
        <CardBody className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Field label="What">
              {(p) => (
                <Select {...p} value={filters.category ?? ''} onChange={(e) => set({ category: e.target.value || undefined })}>
                  <option value="">Everything</option>
                  {(Object.keys(AUDIT_CATEGORIES) as AuditCategory[]).map((c) => (
                    <option key={c} value={c}>
                      {AUDIT_CATEGORIES[c]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Who">
              {(p) => (
                <Select {...p} value={filters.actor ?? ''} onChange={(e) => set({ actor: e.target.value || undefined })}>
                  <option value="">Anyone</option>
                  {(first?.actors ?? []).map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Outcome">
              {(p) => (
                <Select {...p} value={filters.outcome ?? ''} onChange={(e) => set({ outcome: e.target.value || undefined })}>
                  <option value="">Any</option>
                  <option value="success">Succeeded</option>
                  <option value="failure">Failed</option>
                </Select>
              )}
            </Field>
            <Field label="From">{(p) => <Input {...p} type="date" value={filters.from ?? ''} onChange={(e) => set({ from: e.target.value || undefined })} />}</Field>
            <Field label="To">{(p) => <Input {...p} type="date" value={filters.to ?? ''} onChange={(e) => set({ to: e.target.value || undefined })} />}</Field>
          </div>

          {log.isLoading ? (
            <Skeleton className="h-72" />
          ) : items.length ? (
            <div className="overflow-x-auto rounded-xl border border-line">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="bg-surface-2 text-xs text-ink-3">
                  <tr>
                    <th className="px-3 py-2 font-medium">When</th>
                    <th className="px-3 py-2 font-medium">Who</th>
                    <th className="px-3 py-2 font-medium">What</th>
                    <th className="px-3 py-2 font-medium">On</th>
                    <th className="px-3 py-2 font-medium">Where from</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {items.map((e) => (
                    <tr key={e.id} className="cursor-pointer align-top transition-colors duration-150 ease-brand hover:bg-surface-2" onClick={() => setOpen(e)}>
                      <td className="whitespace-nowrap px-3 py-2 font-mono text-xs tabular text-ink-2">{fmtDateTime(e.at)}</td>
                      <td className="max-w-[200px] truncate px-3 py-2 text-ink">{ACTOR_KIND[e.actorType] ? `${ACTOR_KIND[e.actorType]} · ${e.actorLabel}` : e.actorLabel}</td>
                      <td className="px-3 py-2">
                        <button type="button" className="text-left text-ink hover:underline" onClick={() => setOpen(e)}>
                          {e.label}
                        </button>
                        {e.outcome === 'failure' && (
                          <StatusBadge tone="critical" className="ml-2">
                            Failed
                          </StatusBadge>
                        )}
                      </td>
                      <td className="max-w-[200px] truncate px-3 py-2 text-ink-2">{e.targetLabel ?? '-'}</td>
                      <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-ink-3">{e.ip ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState icon={<History />} title="Nothing here yet" description="Sign-ins, team changes and settings changes appear here as they happen." />
          )}
        </CardBody>
        {log.hasNextPage && (
          <CardFooter>
            <Button variant="secondary" onClick={() => void log.fetchNextPage()} loading={log.isFetchingNextPage}>
              Show older events
            </Button>
          </CardFooter>
        )}
      </SettingsCard>

      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)} title={open?.label ?? ''} description={open ? fmtDateTime(open.at) : undefined} wide>
        {open && (
          <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-ink-3">Who</dt>
            <dd className="break-all text-ink">{open.actorLabel} {ACTOR_KIND[open.actorType] ? `(${ACTOR_KIND[open.actorType]})` : ''}</dd>
            <dt className="text-ink-3">Outcome</dt>
            <dd>{open.outcome === 'failure' ? <StatusBadge tone="critical">Failed</StatusBadge> : <StatusBadge tone="good">Succeeded</StatusBadge>}</dd>
            {open.targetLabel || open.targetId ? (
              <>
                <dt className="text-ink-3">On</dt>
                <dd className="break-all text-ink">
                  {open.targetLabel ?? open.targetId} {open.targetType ? <span className="text-ink-3">({open.targetType.replace('_', ' ')})</span> : null}
                </dd>
              </>
            ) : null}
            <dt className="text-ink-3">IP address</dt>
            <dd className="font-mono text-xs text-ink">{open.ip ?? '-'}</dd>
            <dt className="text-ink-3">Browser</dt>
            <dd className="break-all text-xs text-ink-2">{open.userAgent ?? '-'}</dd>
            <dt className="text-ink-3">Action</dt>
            <dd className="font-mono text-xs text-ink-2">{open.action}</dd>
            {Object.keys(shownDetails(open)).length > 0 && (
              <>
                <dt className="text-ink-3">Details</dt>
                <dd>
                  <pre className="max-h-64 overflow-auto rounded-md border border-line bg-surface-2 p-2 font-mono text-xs text-ink-2">{JSON.stringify(shownDetails(open), null, 2)}</pre>
                </dd>
              </>
            )}
          </dl>
        )}
      </Dialog>
    </div>
  );
}
