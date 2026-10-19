import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router';
import { Button } from '@/components/ui/button';
import { Callout, PageLoader } from '@/components/ui/feedback';
import { errorMessage } from '@/lib/api';
import { usePortalHandoff } from '@/lib/queries';
import { AuthCard } from './shared';

/**
 * G5 (WHITE_LABEL.md §2): after signing in on the app's own address (Google or single sign-on, whose redirect URIs are registered
 * there), this page asks for a one-use link and opens the agency's portal with the same session. The server checks the host is a
 * verified portal address the person belongs to; nothing else can be opened from here.
 */
export default function PortalHandoffPage() {
  const [params] = useSearchParams();
  const host = params.get('host') ?? '';
  const handoff = usePortalHandoff();
  const started = useRef(false);
  useEffect(() => {
    if (started.current || !host) return;
    started.current = true;
    handoff.mutate(host, { onSuccess: (r) => window.location.assign(r.url) });
  }, [host, handoff]);
  if (handoff.isError || !host)
    return (
      <AuthCard title="Could not open the portal" subtitle={host ? `We could not open ${host} for you.` : 'No portal address was given.'}>
        <Callout tone="critical" className="mb-5">
          {host ? errorMessage(handoff.error) : 'Open the portal from the link your agency sent you.'}
        </Callout>
        <Button className="w-full" onClick={() => window.location.assign('/')}>
          Go to your companies
        </Button>
      </AuthCard>
    );
  return <PageLoader fullPage label="Opening your portal..." />;
}
