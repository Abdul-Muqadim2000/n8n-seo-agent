import { ButtonLink } from '@/components/ui/button';

export default function NotFoundPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-page px-6 text-center">
      <p className="text-sm font-medium text-accent-text">404</p>
      <h1 className="text-2xl font-semibold text-ink">Page not found</h1>
      <p className="max-w-md text-sm text-ink-3">The page you opened does not exist or was moved.</p>
      <ButtonLink to="/" className="mt-3">
        Go to the dashboard
      </ButtonLink>
    </div>
  );
}
