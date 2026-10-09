import type { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { Brand, pageTitle } from '@/components/layout/Brand';
import { ThemeMenu } from '@/components/layout/ThemeMenu';
import { useDocumentTitle } from '@/components/layout/useDocumentTitle';
import { PageHeader } from '@/components/ui/misc';
import { cn } from '@/lib/utils';

/** Pages outside a company (account, platform admin): brand bar, a back link and the page header. */
export function StandaloneShell({
  title,
  description,
  actions,
  children,
  wide,
  icon,
}: {
  /** the page's icon, in a solid blue tile before the title */
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  wide?: boolean;
}) {
  const navigate = useNavigate();
  const loc = useLocation();
  useDocumentTitle(typeof title === 'string' ? pageTitle(title) : null);
  // the first page of the tab has the key "default": nothing to go back to inside the app
  const back = () => (loc.key !== 'default' ? navigate(-1) : navigate('/'));
  return (
    <div className="min-h-dvh bg-page">
      <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <Brand to="/" />
          <ThemeMenu />
        </div>
      </header>
      <main className={cn('mx-auto w-full px-4 pb-16 pt-6 sm:px-6 lg:pt-10', wide ? 'max-w-6xl' : 'max-w-3xl')}>
        <button type="button" onClick={back} className="group mb-4 inline-flex items-center gap-1.5 rounded-md text-[13px] font-medium text-ink-3 transition-colors duration-150 ease-brand hover:text-ink">
          <ArrowLeft className="size-4 transition-transform duration-200 ease-brand group-hover:-translate-x-0.5" aria-hidden />
          Back
        </button>
        <PageHeader icon={icon} title={title} description={description} actions={actions} />
        {children}
      </main>
    </div>
  );
}
