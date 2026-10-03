import { useState, type ReactNode } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router';
import { ArrowLeft, History, Plus, Wand2 } from 'lucide-react';
import { MODES, type ModeId } from '@seo/shared';
import { lastSite, useOrgCtx } from '@/lib/context';
import { paths } from '@/lib/paths';
import { useProviders } from '@/lib/queries';
import { decodePrefill } from '@/lib/utils';
import { ButtonLink } from '@/components/ui/button';
import { Callout, EmptyState } from '@/components/ui/feedback';
import { PageHeader } from '@/components/ui/misc';
import { isModeId, ModeGlyph } from '@/components/reports/meta';
import type { ToolFormProps } from './_components/form-utils';
import { DiscoverForm, KeywordForm, VerdictForm } from './_components/forms/research';
import { AuditForm, CheckinForm, DescribeForm, PublishedForm } from './_components/forms/site';
import { AiVisibilityForm, BacklinksForm, CaseStudyForm, LadderForm } from './_components/forms/growth';

const FORMS: Partial<Record<ModeId, (p: ToolFormProps) => ReactNode>> = {
  verdict: VerdictForm,
  keyword: KeywordForm,
  discover: DiscoverForm,
  describe: DescribeForm,
  audit: AuditForm,
  ladder: LadderForm,
  published: PublishedForm,
  checkin: CheckinForm,
  case_study: CaseStudyForm,
  ai_visibility: AiVisibilityForm,
  backlinks: BacklinksForm,
};

/** Modes configured in the website settings instead of a one-off form. */
const SETTINGS_TAB: Partial<Record<ModeId, string>> = { profile: 'settings/profile', track: 'settings/tracking' };

export default function ToolFormPage() {
  const providers = useProviders();
  const { mode = '' } = useParams();
  const [params] = useSearchParams();
  const { org, sites, can, me } = useOrgCtx();
  // the website the link asked for (the form then keeps ?site= in step with its own choice)
  const [askedSiteId] = useState(() => params.get('site'));

  if (!isModeId(mode))
    return (
      <EmptyState
        icon={<Wand2 className="size-5" />}
        title="This tool does not exist"
        description="The link may be out of date."
        action={<ButtonLink to={paths.tools(org.id)}>See all tools</ButtonLink>}
      />
    );

  const info = MODES[mode];
  const paramSite = sites.find((s) => s.id === params.get('site')) ?? null;
  const askedSite = sites.find((s) => s.id === askedSiteId) ?? null;
  const verified = sites.filter((s) => s.verifiedAt);
  const remembered = lastSite(org.id);
  const initialSite = (paramSite?.verifiedAt ? paramSite : null) ?? verified.find((s) => s.id === remembered) ?? verified[0] ?? null;

  const tab = SETTINGS_TAB[mode];
  if (tab) {
    const target = paramSite ?? initialSite ?? sites[0];
    if (target) return <Navigate to={paths.site(org.id, target.id, tab)} replace />;
    return (
      <EmptyState
        icon={<Plus className="size-5" />}
        title="Add your website first"
        description={`${info.title} is set up per website, in its settings.`}
        action={can('admin') && <ButtonLink to={paths.newSite(org.id)}>Add a website</ButtonLink>}
      />
    );
  }

  const Form = FORMS[mode];
  const prefillParam = params.get('prefill');
  const prefill = decodePrefill(prefillParam);
  const prefilled = Object.keys(prefill).filter((k) => k !== 'mode' && k !== 'siteId').length > 0;

  return (
    <div>
      <Link to={paths.tools(org.id)} className="mb-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-3 hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> All tools
      </Link>
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <ModeGlyph mode={mode} size="lg" />
            {info.title}
          </span>
        }
        description={info.summary}
        actions={
          <ButtonLink to={`${paths.runs(org.id)}?mode=${mode}`} variant="secondary" size="sm" icon={<History className="size-4" />}>
            Past runs
          </ButtonLink>
        }
      />

      <div className="mb-5 space-y-3">
        {org.disabled && (
          <Callout tone="critical" title="This company is disabled">
            Runs cannot start until the platform administrator enables it again.
          </Callout>
        )}
        {!can('member') && (
          <Callout tone="info" title="View-only access">
            You can see what this tool needs, but starting runs takes the member role. Ask an admin of {org.name}.
          </Callout>
        )}
        {can('member') && !me.user.emailVerified && !!providers.data?.requireEmailVerification && (
          <Callout
            tone="warning"
            title="Verify your e-mail address first"
            action={
              <ButtonLink to={paths.account} variant="secondary" size="sm">
                Your account
              </ButtonLink>
            }
          >
            Runs start once your address is confirmed. Check your inbox for the link, or resend it from your account page.
          </Callout>
        )}
        {askedSite && !askedSite.verifiedAt && (
          <Callout
            tone="warning"
            title={`${askedSite.domain} is not verified yet`}
            action={
              can('admin') && (
                <ButtonLink to={paths.site(org.id, askedSite.id, 'settings/verification')} variant="secondary" size="sm">
                  Verify it
                </ButtonLink>
              )
            }
          >
            {info.siteBound ? 'Checks run only against websites you have proven you own.' : 'You can still research without it, or verify it to include site checks.'}
            {initialSite && initialSite.id !== askedSite.id && ` ${initialSite.domain} is selected instead.`}
          </Callout>
        )}
        {info.siteBound && !verified.length && (
          <Callout
            tone="warning"
            title="No verified website yet"
            action={
              can('admin') &&
              (sites[0] ? (
                <ButtonLink to={paths.site(org.id, sites[0].id, 'settings/verification')} variant="secondary" size="sm">
                  Verify {sites[0].domain}
                </ButtonLink>
              ) : (
                <ButtonLink to={paths.newSite(org.id)} variant="secondary" size="sm">
                  Add a website
                </ButtonLink>
              ))
            }
          >
            This tool works on your own website. Prove ownership once (Search Console, a DNS record or a meta tag) and every tool opens up.
          </Callout>
        )}
        {prefilled && (
          <Callout tone="info" title="Pre-filled for you">
            The values come from a report or recommendation. Check them, then start the run.
          </Callout>
        )}
      </div>

      {Form ? (
        <Form key={`${mode}:${prefillParam ?? ''}`} initialSiteId={initialSite?.id ?? null} prefill={prefill} />
      ) : (
        <EmptyState title="Not available here" description="This tool is configured in the website settings." action={<ButtonLink to={paths.tools(org.id)}>All tools</ButtonLink>} />
      )}
    </div>
  );
}
