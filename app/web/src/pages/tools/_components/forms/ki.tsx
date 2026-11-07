// KI (2026-11-08, DESIGN.md §6): the run forms of Competitors and Keyword research. Offered only for a website whose KI this person may
// see (On, or Trial for platform admins); the credits are shown before the run (the shared estimate the server's quote uses), a repeat
// with nothing changed reuses the recent reading at no charge, and a Trial run says plainly that only our team sees it.
import { useForm, type DefaultValues } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { Wand2 } from 'lucide-react';
import { RUN_SCHEMAS } from '@seo/shared';
import { useOrgCtx } from '@/lib/context';
import { paths } from '@/lib/paths';
import { useKi } from '@/lib/queries';
import { GuideButton } from '@/components/guide';
import { ButtonLink } from '@/components/ui/button';
import { Callout, EmptyState, Spinner } from '@/components/ui/feedback';
import { Checkbox } from '@/components/ui/field';
import { estimateCost, estimateEta } from '../estimate';
import { CountryField, DeliveryCard, DomainTagsField, errMsg, FormCard, setPristine, siteDefaults, SiteField, TextTagsField, ToolShell, useRunSubmit, useSiteChange, useSyncSiteParam } from '../kit';
import { OPTION_BOX, withPrefill, type ToolFormProps } from '../form-utils';

const CS = RUN_SCHEMAS.competitors;
type CIn = z.input<typeof CS>;
type COut = z.output<typeof CS>;
const RS = RUN_SCHEMAS.keyword_research;
type RIn = z.input<typeof RS>;
type ROut = z.output<typeof RS>;

/** The form is only there for a website whose KI is visible; elsewhere the tool "does not exist" (Off sites see nothing new). */
function useKiGate(siteId: string | null | undefined) {
  const { org } = useOrgCtx();
  const q = useKi(org.id, siteId);
  return { loading: !!siteId && q.isPending, visible: !!q.data?.visible, trial: q.data?.mode === 'trial', killed: !!q.data?.killed };
}

function NotOffered() {
  const { org } = useOrgCtx();
  return (
    <EmptyState
      icon={<Wand2 className="size-5" />}
      title="This tool does not exist"
      description="The link may be out of date."
      action={<ButtonLink to={paths.tools(org.id)}>See all tools</ButtonLink>}
    />
  );
}

function GateNotes({ trial, killed, visible, domain }: { trial: boolean; killed: boolean; visible: boolean; domain?: string }) {
  return (
    <>
      {trial && (
        <Callout tone="info" title="Trial: only platform admins see this">
          The run and its results stay with our team. The client sees nothing new until the website is switched to On.
        </Callout>
      )}
      {killed && (
        <Callout tone="warning" title="Paused for maintenance">
          New runs are paused for a short while. Nothing is charged while it is paused.
        </Callout>
      )}
      {!visible && domain && (
        <Callout tone="info" title={`Not available for ${domain} yet`}>
          It is rolling out to selected websites. Choose another website, or ask us to switch it on for this one.
        </Callout>
      )}
    </>
  );
}

export function CompetitorsForm({ initialSiteId, prefill }: ToolFormProps) {
  const { sites } = useOrgCtx();
  const sd = siteDefaults(sites.find((s) => s.id === initialSiteId) ?? null);
  const first = useKiGate(initialSiteId);
  const form = useForm<CIn, unknown, COut>({
    resolver: zodResolver(CS),
    mode: 'onTouched',
    defaultValues: withPrefill<DefaultValues<CIn>>({ mode: 'competitors', siteId: initialSiteId ?? '', country: sd.country, competitors: sd.competitors.slice(0, 5), seeds: [], kiForce: false, emailCopy: true }, prefill),
  });
  const { onSubmit, onAccept, pending, error } = useRunSubmit(form);
  const v = form.watch();
  const site = sites.find((s) => s.id === v.siteId) ?? null;
  const gate = useKiGate(v.siteId);
  const e = form.formState.errors;
  useSyncSiteParam(v.siteId);
  useSiteChange(v.siteId, (s) => {
    const d = siteDefaults(s);
    setPristine(form, 'country', d.country);
    setPristine(form, 'competitors', d.competitors.slice(0, 5));
  });
  if (first.loading) return <Spinner label="Loading" />;
  if (!first.visible) return <NotOffered />;
  return (
    <ToolShell
      onAccept={onAccept}
      values={v}
      mode="competitors"
      site={site}
      cost={estimateCost('competitors', v)}
      eta={estimateEta('competitors', v)}
      emailCopy={!!v.emailCopy}
      onSubmit={onSubmit}
      pending={pending}
      error={error}
      submitLabel="Find my competitors"
      blocked={!gate.visible ? 'This analysis is not available for this website yet.' : gate.killed ? 'New runs are paused for a short while.' : undefined}
      priceNote="If nothing changed since a recent run, we show that reading again and charge nothing."
    >
      <GateNotes trial={gate.trial} killed={gate.killed} visible={gate.visible || gate.loading} domain={site?.domain} />
      <FormCard title="Your website" description="We read Google's results for each of your services in your market and sort every website we find by what it is." info="Companies like you are scored by how often and how high they show up. Directories and 'best of' lists become places to be listed on. Platforms are shown apart, never counted as competitors.">
        <SiteField value={v.siteId} onChange={(id) => form.setValue('siteId', id ?? '', { shouldDirty: true, shouldValidate: form.formState.isSubmitted })} error={errMsg(e.siteId)} />
        <CountryField reg={form.register('country')} error={errMsg(e.country)} label="Market" hint="Your website's main country. A run for another country is stopped before anything is charged." />
      </FormCard>
      <FormCard title="Competitors you already know" description="Optional. They are always kept on your list.">
        <DomainTagsField
          value={v.competitors ?? []}
          onChange={(c) => form.setValue('competitors', c, { shouldDirty: true, shouldValidate: form.formState.isSubmitted })}
          error={errMsg(e.competitors)}
          ownDomain={site?.domain}
          max={5}
          hint={<GuideButton id="ki-choose-competitors" vars={{ domain: site?.domain ?? '' }} variant="link" label="Who counts as a competitor" />}
        />
        <TextTagsField value={v.seeds ?? []} onChange={(s) => form.setValue('seeds', s, { shouldDirty: true })} error={errMsg(e.seeds)} label="Searches to start from" max={20} maxLength={120} placeholder="e.g. erp partner dubai" hint="Optional. Without them we start from your services and your market." />
        <Checkbox {...form.register('kiForce')} className={OPTION_BOX} label="Read everything fresh" description="Ignore a reading from the last few days. Uses the full credits again." />
      </FormCard>
      <DeliveryCard reg={form.register('emailCopy')} />
    </ToolShell>
  );
}

export function KeywordResearchForm({ initialSiteId, prefill }: ToolFormProps) {
  const { sites } = useOrgCtx();
  const sd = siteDefaults(sites.find((s) => s.id === initialSiteId) ?? null);
  const first = useKiGate(initialSiteId);
  const form = useForm<RIn, unknown, ROut>({
    resolver: zodResolver(RS),
    mode: 'onTouched',
    defaultValues: withPrefill<DefaultValues<RIn>>({ mode: 'keyword_research', siteId: initialSiteId ?? '', country: sd.country, competitors: [], seeds: [], kiForce: false, emailCopy: true }, prefill),
  });
  const { onSubmit, onAccept, pending, error } = useRunSubmit(form);
  const v = form.watch();
  const site = sites.find((s) => s.id === v.siteId) ?? null;
  const gate = useKiGate(v.siteId);
  const e = form.formState.errors;
  useSyncSiteParam(v.siteId);
  useSiteChange(v.siteId, (s) => setPristine(form, 'country', siteDefaults(s).country));
  if (first.loading) return <Spinner label="Loading" />;
  if (!first.visible) return <NotOffered />;
  return (
    <ToolShell
      onAccept={onAccept}
      values={v}
      mode="keyword_research"
      site={site}
      cost={estimateCost('keyword_research', v)}
      eta={estimateEta('keyword_research', v)}
      emailCopy={!!v.emailCopy}
      onSubmit={onSubmit}
      pending={pending}
      error={error}
      submitLabel="Research my keywords"
      blocked={!gate.visible ? 'This analysis is not available for this website yet.' : gate.killed ? 'New runs are paused for a short while.' : undefined}
      priceNote="If nothing changed since a recent run, we show that reading again and charge nothing."
    >
      <GateNotes trial={gate.trial} killed={gate.killed} visible={gate.visible || gate.loading} domain={site?.domain} />
      <FormCard title="Your website" description="We collect what buyers search from your Search Console, Google's suggestions and questions, and the competitors you follow." info="Searches that do not fit what you sell (job seekers, other companies' names, other countries) are set aside with the reason. The rest are grouped by topic and given a verdict.">
        <SiteField value={v.siteId} onChange={(id) => form.setValue('siteId', id ?? '', { shouldDirty: true, shouldValidate: form.formState.isSubmitted })} error={errMsg(e.siteId)} />
        <CountryField reg={form.register('country')} error={errMsg(e.country)} label="Market" hint="Your website's main country. A run for another country is stopped before anything is charged." />
      </FormCard>
      <FormCard title="Where to start" description="Optional. Your services and the competitors you chose are used anyway.">
        <TextTagsField value={v.seeds ?? []} onChange={(s) => form.setValue('seeds', s, { shouldDirty: true })} error={errMsg(e.seeds)} label="Searches to start from" max={20} maxLength={120} placeholder="e.g. business central partner abu dhabi" hint="Up to 20, the way a buyer would type them." />
        <Checkbox {...form.register('kiForce')} className={OPTION_BOX} label="Read everything fresh" description="Ignore a reading from the last few days. Uses the full credits again." />
      </FormCard>
      <DeliveryCard reg={form.register('emailCopy')} />
    </ToolShell>
  );
}
