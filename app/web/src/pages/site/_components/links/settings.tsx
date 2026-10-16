import { useEngineCal } from '@/lib/engine-cal';
// Link building — the website's settings (approve each / automatic, the mailbox) and "Find opportunities now".
import { PRICES } from '@/lib/prices';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Mail, Search, Settings2, ShieldBan, UserCheck, Zap } from 'lucide-react';
import type { LinkBuildingData } from '@seo/shared';
import { GuideButton } from '@/components/guide';
import { errorMessage } from '@/lib/api';
import { paths } from '@/lib/paths';
import { useRunLinkBuilder, useUpdateLinkSettings } from '@/lib/queries';
import { fmtDate } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/feedback';
import { Checkbox, ChoiceCard, Field, Input, Select } from '@/components/ui/field';
import { Dialog } from '@/components/ui/overlay';
import { MoreLink, Panel, useSitePage } from '../kit';

export function LinkSettingsCard({ d, onRun }: { d: LinkBuildingData; onRun?: () => void }) {
  const { org, site, can } = useSitePage();
  const update = useUpdateLinkSettings(org.id, site.id);
  const admin = can('admin');
  const owner = can('owner');
  const [mode, setMode] = useState(d.settings.mode);
  const [max, setMax] = useState(String(d.settings.autoDailyMax));
  const [mailboxId, setMailboxId] = useState(d.settings.mailboxId ?? '');
  // the server's answer (or another person's change) resets the form
  useEffect(() => {
    setMode(d.settings.mode);
    setMax(String(d.settings.autoDailyMax));
    setMailboxId(d.settings.mailboxId ?? '');
  }, [d.settings.mode, d.settings.autoDailyMax, d.settings.mailboxId]);

  const maxN = Number(max);
  const maxOk = Number.isInteger(maxN) && maxN >= 1 && maxN <= 30;
  const dirty = mode !== d.settings.mode || (mode === 'auto' && maxN !== d.settings.autoDailyMax) || (mailboxId || null) !== d.settings.mailboxId;
  const save = () =>
    update.mutate(
      {
        ...(mode !== d.settings.mode ? { mode } : {}),
        ...(mode === 'auto' && maxN !== d.settings.autoDailyMax ? { autoDailyMax: maxN } : {}),
        ...((mailboxId || null) !== d.settings.mailboxId ? { mailboxId: mailboxId || null } : {}),
      },
      { onSuccess: () => toast.success('Link building settings saved'), onError: (e) => toast.error(errorMessage(e)) },
    );

  return (
    <section id="lb-settings" className="scroll-mt-20">
      <Panel
        title="Settings"
        icon={<Settings2 />}
        description={admin ? 'How pitches are approved and which mailbox sends them' : 'Admins change these settings'}
        footer={
          admin ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>{d.lastRun ? `Last search ${fmtDate(d.lastRun)} · next Monday 11:00` : 'Runs every Monday at 11:00'}</span>
              <Button size="sm" disabled={!dirty || (mode === 'auto' && !maxOk)} loading={update.isPending} onClick={save}>
                Save settings
              </Button>
            </div>
          ) : undefined
        }
      >
        <div className="space-y-5">
          <div role="radiogroup" aria-label="Approval" className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <ChoiceCard
              selected={mode === 'approve'}
              onSelect={() => setMode('approve')}
              disabled={!admin}
              icon={<UserCheck className="size-5" />}
              title="Approve each"
              badge={<Badge tone="accent">Recommended</Badge>}
              description="Someone reads, edits and approves every pitch before it goes out."
            />
            <ChoiceCard
              selected={mode === 'auto'}
              onSelect={() => setMode('auto')}
              disabled={!owner}
              icon={<Zap className="size-5" />}
              title={`Automatic, up to ${maxOk ? maxN : d.settings.autoDailyMax} a day`}
              badge={!owner ? <Badge>Owner only</Badge> : undefined}
              description="Pitches with a contact and a good topic fit go out without anyone reading them first."
            />
          </div>
          {mode === 'auto' && (
            <div className="space-y-3">
              <Callout tone="warning" title="Nobody reads these e-mails before they go out">
                They still follow every rule: your mailbox limits and sending window, one conversation per site, three e-mails at most, a stop at the first reply. Recipients who need consent always wait for a person.
              </Callout>
              {owner && (
                <Field label="Pitches a day at most" hint="1 to 30; your mailbox's own daily limits apply too" className="max-w-xs">
                  {(f) => <Input {...f} type="number" inputMode="numeric" min={1} max={30} step={1} value={max} onChange={(e) => setMax(e.target.value)} aria-invalid={!maxOk || undefined} />}
                </Field>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field
              label="Send from"
              hint={
                d.mailboxes.length ? (
                  'Pitches go out from this address; replies are read from its inbox.'
                ) : (
                  <>
                    No mailbox connected yet. <GuideButton id="mailbox-connect" variant="link" label="How to connect one" />
                  </>
                )
              }
              labelAction={can('admin') ? <MoreLink to={paths.settings(org.id, 'mailboxes')}>Mailboxes</MoreLink> : undefined}
            >
              {(f) => (
                <Select {...f} value={mailboxId} disabled={!admin || !d.mailboxes.length} onChange={(e) => setMailboxId(e.target.value)}>
                  <option value="">Any active mailbox</option>
                  {d.mailboxes.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.fromName} · {m.fromEmail}
                      {m.status !== 'active' ? ` (${m.status === 'paused' ? 'paused' : 'error'})` : ''}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <div className="flex min-w-0 items-start gap-3 rounded-lg border border-line p-3">
              <ShieldBan className="mt-0.5 size-4 shrink-0 text-ink-3" aria-hidden />
              <div className="min-w-0 text-[13px]">
                <p className="font-medium text-ink">
                  Opt-out list: {d.suppressed} {d.suppressed === 1 ? 'entry' : 'entries'}
                </p>
                <p className="mt-0.5 text-ink-3">Addresses and domains that said no, bounced or that you added. They never get another e-mail from your company.</p>
                <div className="mt-1.5">
                  <MoreLink to={paths.settings(org.id, 'mailboxes')}>See the list</MoreLink>
                </div>
              </div>
            </div>
          </div>

          {admin && onRun && (
            <div className="flex flex-col gap-3 rounded-lg bg-surface-2 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 text-[13px]">
                <p className="font-medium text-ink">Find opportunities now</p>
                <p className="mt-0.5 text-ink-3">Runs the weekly search for this website now instead of waiting for Monday.</p>
              </div>
              <Button size="sm" variant="secondary" icon={<Search className="size-3.5" />} onClick={onRun}>
                Find opportunities now
              </Button>
            </div>
          )}
          {!admin && !d.mailboxes.length && (
            <p className="flex items-center gap-2 text-[13px] text-ink-3">
              <Mail className="size-4 shrink-0" aria-hidden />
              An admin connects the company's mailbox in company settings.
            </p>
          )}
        </div>
      </Panel>
    </section>
  );
}

/** "Find opportunities now" (admins): full search, or the free check (no e-mails drafted, no DataForSEO). */
export function RunDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  useEngineCal();   // R99 / R100: re-render with the engine's own prices once they arrive
  const { org, site } = useSitePage();
  const run = useRunLinkBuilder(org.id, site.id);
  const [freeOnly, setFreeOnly] = useState(false);
  const start = () =>
    run.mutate(
      { freeOnly },
      {
        onSuccess: () => {
          toast.success('The Link Builder started: new opportunities appear here in a few minutes, and its report under Reports.');
          onOpenChange(false);
        },
        onError: (e) => toast.error(errorMessage(e)),
      },
    );
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) setFreeOnly(false);
      }}
      title="Find link opportunities now"
      description={`Runs the weekly Link Builder for ${site.domain} now: new opportunities, the right contact, your page and the link text, and drafted pitches for your approval.`}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button icon={<Search className="size-4" />} loading={run.isPending} onClick={start}>
            {freeOnly ? 'Start the free check' : 'Start'}
          </Button>
        </>
      }
    >
      <div className="space-y-4 text-sm text-ink-2">
        <Checkbox
          checked={freeOnly}
          onChange={(e) => setFreeOnly(e.target.checked)}
          label="Free check"
          description="Opportunities, contacts, listings and redirects only: no e-mails drafted and no paid data. Costs nothing."
        />
        <p className="text-[13px] text-ink-3">
          Across a month the Link Builder costs about {PRICES.linkBuilderMonthly()} (the e-mail writer; the competitors' broken links once a month). Nothing is sent: pitches wait here for your approval. Takes a few minutes.
        </p>
        {run.isError && <Callout tone="critical">{errorMessage(run.error)}</Callout>}
      </div>
    </Dialog>
  );
}

