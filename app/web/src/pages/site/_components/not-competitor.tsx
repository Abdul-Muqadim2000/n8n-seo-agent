// CR17-F (2026-11-17, client report C5): "Not a competitor" on any page that names another website (AI visibility, Rankings). It takes the
// domain off THE one competitor list (Site settings + the Competitors page choices), which every page and monitor reads, keyword intelligence
// on or off (PATCH .../sites/:siteId/competitors/:domain). Shown to members and above only; the caller checks `can('member')`.
import { Ban } from 'lucide-react';
import { toast } from 'sonner';
import { toastError } from '@/lib/api';
import { useCompetitorStatus } from '@/lib/queries';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/overlay';
import { useSitePage } from './kit';

export function NotCompetitorButton({ domain }: { domain: string }) {
  const { org, site } = useSitePage();
  const set = useCompetitorStatus(org.id, site.id);
  return (
    <Tooltip content="Not a competitor">
      <Button
        variant="ghost"
        size="icon"
        className="size-8"
        aria-label={`Not a competitor: ${domain}`}
        loading={set.isPending}
        icon={<Ban className="size-4" aria-hidden />}
        onClick={() =>
          set.mutate(
            { domain, status: 'not_competitor' },
            { onSuccess: () => toast.success(`${domain} is marked as not a competitor`), onError: (e) => toastError(e) },
          )
        }
      />
    </Tooltip>
  );
}
