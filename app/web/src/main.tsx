import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router';
import { Toaster } from 'sonner';
import { TooltipProvider } from '@/components/ui/overlay';
import { ThemeProvider } from '@/lib/theme';
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
        <TooltipProvider>
          <RouterProvider router={router} />
          <Toaster position="bottom-right" toastOptions={{ className: '!bg-surface !text-ink !border-line' }} />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>,
);
