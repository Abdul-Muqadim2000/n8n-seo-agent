import { isRouteErrorResponse, useRouteError } from 'react-router';
import { ButtonLink } from '../ui/button';

export function RouteError() {
  const err = useRouteError();
  const notFound = isRouteErrorResponse(err) && err.status === 404;
  // a new deploy replaced the chunk this tab tried to load: a reload fetches the current one
  const staleChunk = err instanceof Error && /dynamically imported module|Importing a module script failed/i.test(err.message);
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-page px-6 text-center">
      <h1 className="text-xl font-semibold text-ink">{notFound ? 'Page not found' : staleChunk ? 'A new version is available' : 'Something went wrong'}</h1>
      <p className="max-w-md text-sm text-ink-3">
        {notFound ? 'The page you opened does not exist.' : staleChunk ? 'Reload the page to continue.' : err instanceof Error ? err.message : 'An unexpected error occurred.'}
      </p>
      <div className="mt-2 flex gap-2">
        {staleChunk ? (
          <button type="button" className="h-9 rounded-lg bg-accent px-4 text-sm font-medium text-accent-ink" onClick={() => window.location.reload()}>
            Reload
          </button>
        ) : (
          <ButtonLink to="/">Go to the dashboard</ButtonLink>
        )}
      </div>
    </div>
  );
}
