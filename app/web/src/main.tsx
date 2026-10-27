import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router';
import { Toaster } from 'sonner';
import { TooltipProvider } from '@/components/ui/overlay';
import { GuideProvider } from '@/components/guide';
import { StepUpProvider } from '@/components/identity/StepUpProvider';
import { ConfirmProvider } from '@/components/warnings/ConfirmProvider';
import { ThemeProvider } from '@/lib/theme';
import { PortalHostBrand } from '@/lib/portal';
import { router } from './router';
// brand fonts, self-hosted (the CSP blocks Google Fonts); unicode-range means browsers fetch only the latin files
import '@fontsource-variable/sora';
import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { refetchOnWindowFocus: false, staleTime: 30_000 },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        {/* G5: an agency's portal host carries the agency's brand on every page */}
        <PortalHostBrand />
        <TooltipProvider>
          <GuideProvider>
            <StepUpProvider>
              <ConfirmProvider>
                <RouterProvider router={router} />
              </ConfirmProvider>
            </StepUpProvider>
          </GuideProvider>
          <Toaster position="bottom-right" toastOptions={{ className: '!bg-surface !text-ink !border-line' }} />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>,
);
