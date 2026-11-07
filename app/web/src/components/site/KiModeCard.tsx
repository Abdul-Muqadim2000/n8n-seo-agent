import { useState } from 'react';
import { toast } from 'sonner';
import { Telescope } from 'lucide-react';
import { KI_MODE_LABELS, KI_MODES, type KiMode } from '@seo/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardFooter, CardHeader } from '@/components/ui/card';
import { Callout } from '@/components/ui/feedback';
import { Segmented } from '@/components/ui/tabs';
import { IconTile } from '@/components/insight';
import { GuideButton } from '@/components/guide';
import { toastError } from '@/lib/api';
import { useOrgCtx, useSiteCtx } from '@/lib/context';
import { useKi, useKiMode } from '@/lib/queries';

const TEXT: Record<KiMode, string> = {
  off: 'Off: nothing new anywhere for this website. The client sees no Competitors or Keyword research page and no new tools.',
  trial: 'Trial: our team can run both analyses and see the pages. The client sees nothing new, and nothing else in the app reads the results.',
  on: 'On: the client sees both pages and can run both analyses, priced in credits before each run.',
};

/**
 * KI (2026-11-08, CONTRACTS.md §1, §7): Off / Trial / On for Competitors and Keyword research, the pattern of the AI ranking switch. Only
 * platform admins see or change it (an Off website shows nothing new anywhere); saved on its own route and confirmed by reading it back.
 */
export function KiModeCard() {
  const { org, me } = useOrgCtx();
  const { site } = useSiteCtx();
  const platform = !!me.platformAdmin;
  const ki = useKi(org.id, site.id, platform);
  if (!platform || !ki.data) return null;
  return <KiModeEditor key={ki.data.mode} start={ki.data.mode} orgId={org.id} siteId={site.id} domain={site.domain} />;
}

function KiModeEditor({ start, orgId, siteId, domain }: { start: KiMode; orgId: string; siteId: string; domain: string }) {
  const save = useKiMode(orgId, siteId);
  const [mode, setMode] = useState<KiMode>(start);
  return (
    <Card>
      <CardHeader
        icon={<IconTile size="sm" tone="blue" className="-mt-0.5"><Telescope /></IconTile>}
        title="Competitors and Keyword research"
        description="Who this website really competes with, and what its buyers search. Platform admins only."
        actions={<Badge tone={start === 'on' ? 'good' : start === 'trial' ? 'accent' : 'neutral'}>{KI_MODE_LABELS[start]}</Badge>}
      />
      <CardBody className="space-y-3">
        <Segmented<KiMode> label="Competitors and Keyword research" value={mode} onChange={setMode} options={KI_MODES.map((m) => ({ value: m, label: KI_MODE_LABELS[m] }))} />
        <p className="text-sm text-ink-2">{TEXT[mode]}</p>
        {mode === 'on' && start !== 'on' && <Callout tone="info">Compare the trial results with the owner before switching a client website to On.</Callout>}
        <GuideButton id="ki-read-keyword-research" vars={{ domain }} variant="link" label="What the client will see" />
      </CardBody>
      <CardFooter>
        {mode !== start && (
          <Button variant="ghost" size="sm" onClick={() => setMode(start)}>
            Undo changes
          </Button>
        )}
        <Button
          size="sm"
          disabled={mode === start}
          loading={save.isPending}
          onClick={() =>
            save.mutate(mode, {
              onSuccess: () => toast.success(`Competitors and Keyword research: ${KI_MODE_LABELS[mode]}`),
              onError: (e) => toastError(e),
            })
          }
        >
          Save
        </Button>
      </CardFooter>
    </Card>
  );
}
