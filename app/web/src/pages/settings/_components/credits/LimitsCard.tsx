import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { SlidersHorizontal } from 'lucide-react';
import { formatCredits, type BillingOverview, type CreditLimits } from '@seo/shared';
import { Button } from '@/components/ui/button';
import { CardBody, CardFooter } from '@/components/ui/card';
import { Callout } from '@/components/ui/feedback';
import { Field, Input } from '@/components/ui/field';
import { KeyValue } from '@/components/ui/misc';
import { SwitchRow } from '@/components/ui/tabs';
import { errorMessage } from '@/lib/api';
import { useOrgCtx } from '@/lib/context';
import { useSetCreditLimits } from '@/lib/queries';
import { SettingsCard } from '../SettingsCard';

// The company's own spending controls (app/docs/CREDITS.md §1): an on-demand limit a month, an autopilot limit a month (the schedules
// pause until the 1st when it is reached) and whether on-demand analyses leave the schedules' credits alone. The owner sets them.

const MAX = 10_000_000;
const toText = (v: number | null) => (v == null ? '' : String(v));

/** '' = no limit; otherwise a whole number of credits, or an error. */
function parseLimit(s: string): { value: number | null; error?: string } {
  const t = s.trim().replace(/[,\s]/g, '');
  if (!t) return { value: null };
  const n = Number(t);
  if (!Number.isInteger(n) || n < 0 || n > MAX) return { value: null, error: 'Enter a whole number of credits, or leave it empty for no limit' };
  return { value: n };
}

const limitText = (v: number | null) => (v == null ? 'No limit' : `${formatCredits(v)} a month`);

export function LimitsCard({ b }: { b: BillingOverview }) {
  const { org, can } = useOrgCtx();
  const owner = can('owner');
  const save = useSetCreditLimits(org.id);
  const [onDemand, setOnDemand] = useState(toText(b.limits.onDemandMonthly));
  const [autopilot, setAutopilot] = useState(toText(b.limits.autopilotMonthly));
  const [reserve, setReserve] = useState(b.limits.reserveForAutopilot);
  const [error, setError] = useState<unknown>(null);

  // a refetch (or another owner's change) resets the form to what is stored
  useEffect(() => {
    setOnDemand(toText(b.limits.onDemandMonthly));
    setAutopilot(toText(b.limits.autopilotMonthly));
    setReserve(b.limits.reserveForAutopilot);
  }, [b.limits.onDemandMonthly, b.limits.autopilotMonthly, b.limits.reserveForAutopilot]);

  const od = parseLimit(onDemand);
  const ap = parseLimit(autopilot);
  const next: CreditLimits = { onDemandMonthly: od.value, autopilotMonthly: ap.value, reserveForAutopilot: reserve };
  const dirty = next.onDemandMonthly !== b.limits.onDemandMonthly || next.autopilotMonthly !== b.limits.autopilotMonthly || next.reserveForAutopilot !== b.limits.reserveForAutopilot;

  const submit = () => {
    if (od.error || ap.error) return;
    setError(null);
    save.mutate(next, { onSuccess: () => toast.success('Credit limits saved'), onError: (e) => setError(e) });
  };

  const autopilotHint = `When the schedules reach it they pause until the 1st of next month (or until the limit is raised). This month they used ${formatCredits(b.month.autopilotUsed)} of about ${formatCredits(b.month.autopilotForecast)} forecast.`;
  const onDemandHint = `Analyses that would pass it are refused until the 1st. Used this month: ${formatCredits(b.month.onDemandUsed)}.`;
  const reserveText = 'On-demand analyses cannot use the credits your websites\' schedules still need this month, so the automatic work keeps running.';

  return (
    <SettingsCard
      icon={<SlidersHorizontal />}
      title="Limits"
      description={owner ? 'Your own caps on what your company uses each calendar month. Leave a limit empty for none.' : `Set by the owner of ${org.name}.`}
    >
      {owner ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          noValidate
        >
          <CardBody className="space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="On-demand limit a month (credits)" hint={onDemandHint} error={od.error}>
                {(p) => <Input {...p} inputMode="numeric" placeholder="No limit" value={onDemand} onChange={(e) => setOnDemand(e.target.value)} />}
              </Field>
              <Field label="Autopilot limit a month (credits)" hint={autopilotHint} error={ap.error}>
                {(p) => <Input {...p} inputMode="numeric" placeholder="No limit" value={autopilot} onChange={(e) => setAutopilot(e.target.value)} />}
              </Field>
            </div>
            <div className="border-t border-line">
              <SwitchRow title="Keep credits for autopilot" description={reserveText} checked={reserve} onCheckedChange={setReserve} />
            </div>
            {error != null && <Callout tone="critical">{errorMessage(error)}</Callout>}
          </CardBody>
          <CardFooter>
            <Button type="submit" loading={save.isPending} disabled={!dirty || !!od.error || !!ap.error}>
              Save limits
            </Button>
          </CardFooter>
        </form>
      ) : (
        <CardBody>
          <KeyValue
            items={[
              { label: 'On-demand limit', value: limitText(b.limits.onDemandMonthly) },
              { label: 'Autopilot limit', value: limitText(b.limits.autopilotMonthly) },
              { label: 'Keep credits for autopilot', value: b.limits.reserveForAutopilot ? 'On' : 'Off' },
            ]}
          />
          <p className="mt-3 text-[13px] leading-snug text-ink-3">
            When the schedules reach the autopilot limit they pause until the 1st of next month. {b.limits.reserveForAutopilot ? reserveText : ''}
          </p>
        </CardBody>
      )}
    </SettingsCard>
  );
}
