import type { ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { Activity, Building2, Globe, ListChecks, Lock, PlugZap, ShieldCheck } from 'lucide-react';
import { cleanDomain, domainOk } from '@seo/shared';
import { DomainClaimedCallout, SiteBusinessForm } from '@/components/site/SiteBusinessFields';
import { ButtonLink } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { Callout, EmptyState } from '@/components/ui/feedback';
import { PageHeader } from '@/components/ui/misc';
import { IconTile, Stagger } from '@/components/insight';
import { ApiRequestError } from '@/lib/api';
import { useOrgCtx } from '@/lib/context';
import { paths } from '@/lib/paths';
import { useCreateSite } from '@/lib/queries';
import { cn } from '@/lib/utils';
import { SettingsCard, StepDot } from './_components/SettingsCard';

export default function AddSitePage() {
  const { org, sites, can } = useOrgCtx();
  const navigate = useNavigate();
  const create = useCreateSite(org.id);
  const first = sites.length === 0;

  if (!can('admin'))
    return (
      <Card>
        <EmptyState
          icon={<Lock className="size-5" />}
          title={first ? `${org.name} has no website yet` : 'Only admins can add websites'}
          description="Ask an owner or admin of your company to add the website. You will see its dashboard as soon as it is set up."
          action={first ? undefined : <ButtonLink to={paths.org(org.id)}>Back to the dashboard</ButtonLink>}
        />
      </Card>
    );

  const orgDomain = cleanDomain(org.website);
  const defaultDomain = orgDomain && domainOk(orgDomain) && !sites.some((s) => s.domain === orgDomain) ? orgDomain : '';

  return (
    <div>
      <PageHeader
        icon={<Globe />}
        title={first ? 'Add your first website' : 'Add a website'}
        description="Tell us about the website. Next you verify that it belongs to your company, connect Search Console and start weekly tracking."
      />
      <Stagger className="space-y-6">
        <AddSiteStepper />
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <SettingsCard icon={<Building2 />} title="About the website" description="Its address, market and what it sells.">
            <CardBody className="pt-5 pb-6">
              <SiteBusinessForm
                mode="create"
                defaultDomain={defaultDomain}
                showSubmit
                submitLabel="Add website"
                submitting={create.isPending}
                onSubmit={async (v) => {
                  const site = await create.mutateAsync(v);
                  toast.success(`${site.domain} added`, { description: 'Now confirm that it belongs to your company.' });
                  navigate(paths.site(org.id, site.id, 'settings/verification'));
                }}
                renderError={(e, v) => {
                  if (!(e instanceof ApiRequestError) || e.status !== 409) return null;
                  if (e.code === 'domain_claimed') return <DomainClaimedCallout domain={cleanDomain(v.domain)} />;
                  const existing = sites.find((s) => s.domain === cleanDomain(v.domain));
                  return (
                    <Callout
                      tone="warning"
                      title="You already added this website"
                      action={existing ? <ButtonLink size="sm" variant="secondary" to={paths.site(org.id, existing.id, 'settings/business')}>Open its settings</ButtonLink> : undefined}
                    >
                      {e.message}
                    </Callout>
                  );
                }}
              />
            </CardBody>
          </SettingsCard>
          <aside className="lg:sticky lg:top-6 lg:self-start">
            <SettingsCard icon={<ListChecks />} title="What happens next">
              <ol className="px-5 pt-5 pb-5">
                {NEXT_STEPS.map((step, i) => (
                  <li key={i} className="relative flex gap-3 pb-5 last:pb-0">
                    {i < NEXT_STEPS.length - 1 && <span className="absolute top-11 bottom-1.5 left-[17px] w-px bg-line-strong" aria-hidden />}
                    <IconTile size="md">{step.icon}</IconTile>
                    <p className="min-w-0 pt-1.5 text-sm leading-relaxed text-ink-2">
                      <span className="sr-only">Step {i + 2}: </span>
                      {step.text}
                    </p>
                  </li>
                ))}
              </ol>
            </SettingsCard>
          </aside>
        </div>
      </Stagger>
    </div>
  );
}

/** The steps after this form (the same text as before, now with an icon each). */
const NEXT_STEPS: { icon: ReactNode; text: ReactNode }[] = [
  {
    icon: <ShieldCheck />,
    text: (
      <>
        <strong className="font-medium text-ink">Verify ownership</strong> with Search Console, a DNS record or a meta tag.
      </>
    ),
  },
  {
    icon: <PlugZap />,
    text: (
      <>
        <strong className="font-medium text-ink">Connect your data:</strong> Search Console and, optionally, GA4.
      </>
    ),
  },
  {
    icon: <Activity />,
    text: (
      <>
        <strong className="font-medium text-ink">Start tracking</strong> and choose blog posts and monitors. The first report arrives within minutes.
      </>
    ),
  },
];

/** Where this page sits in getting a website going: this form is step 1 of 4. */
function AddSiteStepper() {
  const steps = [
    { label: 'Add the website', hint: 'Address, market and business' },
    { label: 'Verify ownership', hint: 'Search Console, DNS or meta tag' },
    { label: 'Connect your data', hint: 'Search Console and GA4' },
    { label: 'Start tracking', hint: 'First report within minutes' },
  ];
  return (
    <Card className="px-4 py-5 sm:px-6">
      <ol className="flex items-start" aria-label="Getting your website going">
        {steps.map((s, i) => (
          <li key={s.label} className="relative flex flex-1 flex-col items-center text-center" aria-current={i === 0 ? 'step' : undefined}>
            {i > 0 && <span className="absolute top-4 right-1/2 -left-1/2 h-0.5 -translate-y-1/2 bg-line-strong" aria-hidden />}
            <span className="relative z-10">
              <StepDot state={i === 0 ? 'current' : 'next'} n={i + 1} />
            </span>
            <span className={cn('mt-2.5 px-1 text-xs leading-snug font-medium sm:text-[13px]', i === 0 ? 'text-ink' : 'text-ink-2')}>
              <span className="sr-only">{i === 0 ? 'Current step: ' : `Step ${i + 1}: `}</span>
              {s.label}
            </span>
            <span className="mt-0.5 hidden px-2 text-xs leading-snug text-ink-3 sm:block">{s.hint}</span>
          </li>
        ))}
      </ol>
    </Card>
  );
}
