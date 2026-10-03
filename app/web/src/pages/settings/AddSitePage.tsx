import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { Lock } from 'lucide-react';
import { cleanDomain, domainOk } from '@seo/shared';
import { DomainClaimedCallout, SiteBusinessForm } from '@/components/site/SiteBusinessFields';
import { StepList } from '@/components/site/ServiceAccountSteps';
import { ButtonLink } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Callout, EmptyState } from '@/components/ui/feedback';
import { PageHeader } from '@/components/ui/misc';
import { ApiRequestError } from '@/lib/api';
import { useOrgCtx } from '@/lib/context';
import { paths } from '@/lib/paths';
import { useCreateSite } from '@/lib/queries';

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
        title={first ? 'Add your first website' : 'Add a website'}
        description="Tell us about the website. Next you verify that it belongs to your company, connect Search Console and start weekly tracking."
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <Card>
          <CardBody className="py-6">
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
        </Card>
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <Card>
            <CardHeader title="What happens next" />
            <CardBody>
              <StepList
                steps={[
                  <>
                    <strong className="font-medium text-ink">Verify ownership</strong> with Search Console, a DNS record or a meta tag.
                  </>,
                  <>
                    <strong className="font-medium text-ink">Connect your data:</strong> Search Console and, optionally, GA4.
                  </>,
                  <>
                    <strong className="font-medium text-ink">Start tracking</strong> and choose blog posts and monitors. The first report arrives within minutes.
                  </>,
                ]}
              />
            </CardBody>
          </Card>
        </aside>
      </div>
    </div>
  );
}
