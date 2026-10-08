import { isRouteErrorResponse, useRouteError } from 'react-router';
import { AlertTriangle, Compass, RefreshCw } from 'lucide-react';
import { Button, ButtonLink } from '../ui/button';
import { StatusScreen } from './StatusScreen';

export function RouteError() {
  const err = useRouteError();
  const notFound = isRouteErrorResponse(err) && err.status === 404;
  // a new deploy replaced the chunk this tab tried to load: a reload fetches the current one
  const staleChunk = err instanceof Error && /dynamically imported module|Importing a module script failed/i.test(err.message);
  return (
    <StatusScreen
      code={notFound ? '404' : undefined}
      icon={notFound ? <Compass className="size-5" /> : staleChunk ? <RefreshCw className="size-5" /> : <AlertTriangle className="size-5" />}
      title={notFound ? 'Page not found' : staleChunk ? 'A new version is available' : 'Something went wrong'}
      actions={
        staleChunk ? (
          <Button size="lg" icon={<RefreshCw className="size-4" />} onClick={() => window.location.reload()}>
            Reload
          </Button>
        ) : (
          <ButtonLink to="/" size="lg">
            Back to home
          </ButtonLink>
        )
      }
    >
      <p className="break-words">{notFound ? 'The page you opened does not exist.' : staleChunk ? 'Reload the page to continue.' : err instanceof Error ? err.message : 'An unexpected error occurred.'}</p>
    </StatusScreen>
  );
}
