import { ApiRequestError } from '@/lib/api';
import { paths } from '@/lib/paths';
import { ButtonLink } from '@/components/ui/button';
import { Callout } from '@/components/ui/feedback';

// credits (app/docs/CREDITS.md): the 402 an analysis gets before it starts. The server's message is already in credits; the title
// names the rule that refused it (`reason` on the body for code 'credits', the platform admin's usage limit for code 'budget').

/** a refusal before work starts (a plain boolean, so an `else` after it keeps the error's type) */
export const isCreditRefusal = (e: unknown): boolean => e instanceof ApiRequestError && e.status === 402;

export function creditRefusalTitle(e: ApiRequestError): string {
  if (e.code === 'budget') return 'Over your monthly usage limit';
  const reason = typeof e.data?.reason === 'string' ? e.data.reason : null;
  if (reason === 'reserve') return 'These credits are kept for autopilot';
  if (reason === 'on_demand_limit') return 'Over your on-demand limit';
  return 'Not enough credits';
}

/** The refusal as a callout: the rule as the title, the server's sentence, and the way to Settings → Credits. */
export function CreditRefusal({ orgId, error, className }: { orgId: string; error: ApiRequestError; className?: string }) {
  return (
    <Callout
      tone="critical"
      className={className}
      title={creditRefusalTitle(error)}
      action={
        <ButtonLink to={paths.settings(orgId, 'credits')} variant="secondary" size="sm">
          Open Credits
        </ButtonLink>
      }
    >
      {error.message}
    </Callout>
  );
}
