import { StrictMode, type ReactNode } from 'react';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { TooltipProvider } from '@/components/ui/overlay';
import { GuideProvider } from '@/components/guide';
import { StepUpProvider } from '@/components/identity/StepUpProvider';
import { ConfirmProvider } from '@/components/warnings/ConfirmProvider';
import { ThemeProvider } from '@/lib/theme';
import { PortalHostBrand } from '@/lib/portal';

/** Every provider around the router, in one place: the browser (main.tsx) and the build-time prerender (entry-server.tsx) render the
 *  same tree, so a prerendered page hydrates without a difference. `hydrating`: see ThemeProvider. */
export function AppProviders({ queryClient, hydrating = false, children }: { queryClient: QueryClient; hydrating?: boolean; children: ReactNode }) {
  return (
    <StrictMode>
      <ThemeProvider hydrating={hydrating}>
        <QueryClientProvider client={queryClient}>
          {/* G5: an agency's portal host carries the agency's brand on every page */}
          <PortalHostBrand />
          <TooltipProvider>
            <GuideProvider>
              <StepUpProvider>
                <ConfirmProvider>{children}</ConfirmProvider>
              </StepUpProvider>
            </GuideProvider>
            <Toaster position="bottom-right" toastOptions={{ className: '!bg-surface !text-ink !border-line' }} />
          </TooltipProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </StrictMode>
  );
}
