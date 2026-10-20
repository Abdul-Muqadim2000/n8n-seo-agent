// The Pipeline's "What happens next" line: the website's own next dates from its cycle (the page's copy, then the cycle's own read),
// and where its first page stands.
import { useMemo } from 'react';
import type { NeedsYouItem, PipelineData } from '@seo/shared';
import { WhatHappensNext } from '@/components/site/WhatHappensNext';
import { useOrgCtx, useSiteCtx } from '@/lib/context';
import { autopilotGuideVars } from '@/lib/guide-vars';
import { firstPageOf, firstPageReady, nextSteps } from '@/lib/next-steps';
import { useSiteCycle, useSiteData } from '@/lib/queries';

export function PipelineNextSteps({ data, needs, now }: { data: PipelineData; needs: NeedsYouItem[]; now?: number }) {
  const { org } = useOrgCtx();
  const { site } = useSiteCtx();
  const verified = !!site.verifiedAt;
  const cycleQ = useSiteCycle(org.id, site.id, verified);
  // the first page waits for the author profile and the business facts; read from the profile the app already has (the server's own
  // readiness of the first page replaces this once it exposes one)
  const settings = useSiteData(org.id, site.id, 'settings', undefined, { enabled: verified });
  const cycle = cycleQ.data ?? data.cycle ?? null;
  const level = data.autopilot?.level ?? data.automation?.autopilotLevel ?? site.autopilotLevel;
  const ready = settings.data ? firstPageReady(settings.data.profile, site.businessFacts) : true;
  const steps = useMemo(
    () =>
      nextSteps({
        cycle,
        now: now ?? Date.now(),
        firstPage: firstPageOf({ needsKeyword: needs.some((n) => n.id === 'keyword:first'), ladders: data.ladderCards ?? [], ready }),
      }),
    [cycle, now, needs, data.ladderCards, ready],
  );
  const vars = useMemo(() => autopilotGuideVars(site, { cycle, level }), [site, cycle, level]);
  return <WhatHappensNext steps={steps} vars={vars} />;
}
