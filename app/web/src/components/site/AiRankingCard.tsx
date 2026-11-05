import { useState } from 'react';
import { toast } from 'sonner';
import { Sparkles } from 'lucide-react';
import { AI_RANK_MODE_TEXT, AI_RANK_MODES, AI_RANK_RESERVE_PAGES_MONTH, type AdminResult, type AiRankMode, type AiRankSettings, type AiRankSettingsPatch } from '@seo/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardFooter, CardHeader } from '@/components/ui/card';
import { Callout } from '@/components/ui/feedback';
import { Field, Select } from '@/components/ui/field';
import { Segmented, SwitchRow } from '@/components/ui/tabs';
import { IconTile } from '@/components/insight';
import { GuideButton } from '@/components/guide';
import { toastError } from '@/lib/api';
import { useOrgCtx, useSiteCtx } from '@/lib/context';
import { PRICES } from '@/lib/prices';
import { useSiteAdmin } from '@/lib/queries';

const OFF: AiRankSettings = { mode: 'off', reserve: false, fanoutN: 0, mentions: false, brave: false };

/**
 * AIR (2026-11-06, docs/ai-ranking-2026-11-05/DESIGN.md §4.1, §6.7): the website's AI ranking setting. Off / Trial (the engine's `shadow`:
 * the plan is worked out privately, nothing a client sees changes) / On, and the reserved AI answer page slot: owners and admins. The three
 * paid readings are shown to platform admins only. Saved apart from the monitors (only the fields changed are sent), so an ordinary
 * monitors save never sends these.
 */
export function AiRankingCard({ initial, admin }: { initial: AiRankSettings | undefined; admin: boolean }) {
  const { org, me } = useOrgCtx();
  const { site } = useSiteCtx();
  const action = useSiteAdmin(org.id, site.id);
  const start = initial ?? OFF;
  const [v, setV] = useState<AiRankSettings>(start);
  const platform = !!me.platformAdmin;
  const changed: AiRankSettingsPatch = {};
  if (v.mode !== start.mode) changed.mode = v.mode;
  if (v.reserve !== start.reserve) changed.reserve = v.reserve;
  if (platform && v.fanoutN !== start.fanoutN) changed.fanoutN = v.fanoutN;
  if (platform && v.mentions !== start.mentions) changed.mentions = v.mentions;
  if (platform && v.brave !== start.brave) changed.brave = v.brave;
  const dirty = Object.keys(changed).length > 0;

  const save = () =>
    action.mutate(
      { action: 'monitors', monitors: {}, aiRank: changed },
      {
        onSuccess: (r: AdminResult) => (r.ok ? toast.success('AI ranking saved') : toast.error(r.error ?? 'The change was not applied')),
        onError: (e) => toastError(e),
      },
    );

  return (
    <Card>
      <CardHeader
        icon={<IconTile size="sm" tone="blue" className="-mt-0.5"><Sparkles /></IconTile>}
        title="AI ranking"
        description="A weekly plan of the few steps most likely to get you named in AI answers, acted on and then checked."
        actions={start.mode !== 'off' ? <Badge tone={start.mode === 'on' ? 'good' : 'accent'}>{AI_RANK_MODE_TEXT[start.mode].label}</Badge> : undefined}
      />
      <CardBody className="space-y-4">
        <fieldset disabled={!admin} className="min-w-0 space-y-4">
          <Segmented<AiRankMode>
            label="AI ranking"
            value={v.mode}
            onChange={(mode) => setV({ ...v, mode })}
            options={AI_RANK_MODES.map((m) => ({ value: m, label: AI_RANK_MODE_TEXT[m].label }))}
            disabled={!admin}
          />
          <p className="text-sm text-ink-2">{AI_RANK_MODE_TEXT[v.mode].text}</p>
          {v.mode === 'on' && start.mode !== 'on' && (
            <Callout tone="info">The plan starts acting from the next weekly run. You can go back to Trial or Off at any time.</Callout>
          )}
          <div className="rounded-xl border border-line px-4">
            <SwitchRow
              title="Reserve a slot for AI answer pages"
              description={`With AI ranking On, up to ${AI_RANK_RESERVE_PAGES_MONTH} pages a month for the questions the plan picks, written on top of your keyword pages and inside your AI answer pages a month, at about ${PRICES.page()} each. Off: those questions are suggested to you instead.`}
              checked={v.reserve}
              onCheckedChange={(reserve) => setV({ ...v, reserve })}
              disabled={!admin}
            />
          </div>
          {platform && (
            <div className="space-y-3 rounded-xl border border-dashed border-line p-4">
              <p className="text-[13px] font-medium text-ink">Paid readings (platform admins only, On only)</p>
              <Field label="Fan-out searches read a week" hint="0 = off. Each one is a paid results-page reading." className="max-w-xs">
                {(p) => (
                  <Select {...p} value={v.fanoutN} onChange={(e) => setV({ ...v, fanoutN: Number(e.target.value) })}>
                    {[...new Set([0, 10, 20, 30, 50, v.fanoutN])].sort((a, b) => a - b).map((n) => (
                      <option key={n} value={n}>
                        {n === 0 ? 'Off' : `${n} a week`}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <SwitchRow title="AI mention database, monthly" description="A paid monthly reading of which pages AI answers name in this market." checked={v.mentions} onCheckedChange={(mentions) => setV({ ...v, mentions })} />
              <SwitchRow title="Independent search index" description="Needs the search key on the engine. Read only when the key is set." checked={v.brave} onCheckedChange={(brave) => setV({ ...v, brave })} />
            </div>
          )}
        </fieldset>
        <GuideButton id="ai-ranking" vars={{ domain: site.domain }} variant="link" label="How AI ranking works" />
      </CardBody>
      {admin && (
        <CardFooter>
          {dirty && (
            <Button variant="ghost" size="sm" onClick={() => setV(start)}>
              Undo changes
            </Button>
          )}
          <Button size="sm" onClick={save} loading={action.isPending} disabled={!dirty}>
            Save AI ranking
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
