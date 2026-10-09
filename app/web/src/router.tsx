import { createBrowserRouter, isRouteErrorResponse, Navigate, useRouteError, type LoaderFunctionArgs, type RouteObject } from 'react-router';
import { pageTitle } from '@/components/layout/Brand';
import { useDocumentTitle } from '@/components/layout/useDocumentTitle';
import { RouteError } from '@/components/layout/RouteError';
import { PageLoader } from '@/components/ui/feedback';
import { AuthLayout, PublicOnly, RequireAuth } from '@/components/layout/AuthGate';
import { RootRoute } from '@/marketing/RootRoute';
import { OrgLayout, OrgIndex } from '@/components/layout/OrgLayout';
import { SiteLayout } from '@/components/layout/SiteLayout';

// Pages are loaded on demand (one chunk per page). Every page module default-exports its component.
const page = (load: () => Promise<{ default: React.ComponentType }>) => async () => ({ Component: (await load()).default });

const siteDataPages: RouteObject[] = [
  { index: true, element: <Navigate to="overview" replace /> },
  { path: 'overview', lazy: page(() => import('@/pages/site/OverviewPage')) },
  { path: 'pipeline', lazy: page(() => import('@/pages/site/PipelinePage')) },
  { path: 'pipeline/new', lazy: page(() => import('@/pages/site/NewLadderPage')) },
  { path: 'pipeline/ladders/:ladderId', lazy: page(() => import('@/pages/site/LadderPage')) },
  { path: 'recommendations', lazy: page(() => import('@/pages/site/RecommendationsPage')) },
  { path: 'search', lazy: page(() => import('@/pages/site/SearchPage')) },
  { path: 'rankings', lazy: page(() => import('@/pages/site/RankingsPage')) },
  { path: 'content', lazy: page(() => import('@/pages/site/ContentPage')) },
  { path: 'technical', lazy: page(() => import('@/pages/site/TechnicalPage')) },
  { path: 'ai', lazy: page(() => import('@/pages/site/AiVisibilityPage')) },
  { path: 'backlinks', lazy: page(() => import('@/pages/site/BacklinksPage')) },
  { path: 'alerts', lazy: page(() => import('@/pages/site/AlertsPage')) },
  { path: 'settings', element: <Navigate to="business" replace /> },
  { path: 'settings/:tab', lazy: page(() => import('@/pages/site/SiteSettingsPage')) },
];

// An unknown /platform/:slug or /solutions/:slug is a 404 (shown by RouteError), checked against the content registry first.
const slugGuard = (exists: (slug: string | undefined) => Promise<boolean>) => async ({ params }: LoaderFunctionArgs) => {
  if (!(await exists(params.slug))) throw new Response('Not found', { status: 404 });
  return null;
};

// A slug page with its own error boundary, both loaded on demand (app pages never load marketing code): an unknown slug's 404 renders
// inside the marketing layout (header and footer stay); any other error goes on to the app's error page.
const slugPage = (load: () => Promise<{ default: React.ComponentType }>) => async () => {
  const [{ default: Component }, { MarketingNotFound }] = await Promise.all([load(), import('@/marketing/components')]);
  function ErrorBoundary() {
    const err = useRouteError();
    const notFound = isRouteErrorResponse(err) && err.status === 404;
    useDocumentTitle(notFound ? pageTitle('Page not found') : null);
    if (!notFound) throw err;
    return <MarketingNotFound />;
  }
  return { Component, ErrorBoundary };
};

// Public marketing pages (no sign-in), inside the marketing layout. Content lives in src/marketing/content.
const marketingPages: RouteObject[] = [
  { path: '/platform', lazy: page(() => import('@/marketing/pages/PlatformPage')) },
  { path: '/platform/:slug', loader: slugGuard(async (slug) => !!(await import('@/marketing/content/features')).featureBySlug(slug)), lazy: slugPage(() => import('@/marketing/pages/FeaturePage')) },
  { path: '/how-it-works', lazy: page(() => import('@/marketing/pages/HowItWorksPage')) },
  { path: '/solutions', lazy: page(() => import('@/marketing/pages/SolutionsPage')) },
  { path: '/solutions/:slug', loader: slugGuard(async (slug) => !!(await import('@/marketing/content/solutions')).solutionBySlug(slug)), lazy: slugPage(() => import('@/marketing/pages/SolutionPage')) },
  { path: '/pricing', lazy: page(() => import('@/marketing/pages/PricingPage')) },
  { path: '/security', lazy: page(() => import('@/marketing/pages/SecurityPage')) },
  { path: '/about', lazy: page(() => import('@/marketing/pages/AboutPage')) },
  { path: '/contact', lazy: page(() => import('@/marketing/pages/ContactPage')) },
  { path: '/changelog', lazy: page(() => import('@/marketing/pages/ChangelogPage')) },
  { path: '/privacy', lazy: page(() => import('@/marketing/pages/LegalPage')) },
  { path: '/terms', lazy: page(() => import('@/marketing/pages/LegalPage')) },
];

export const router = createBrowserRouter([
  {
    errorElement: <RouteError />,
    // shown while the first lazy page module loads
    hydrateFallbackElement: <PageLoader fullPage />,
    children: [
      {
        element: <PublicOnly />,
        children: [
          {
            element: <AuthLayout />,
            children: [
              { path: '/login', lazy: page(() => import('@/pages/auth/LoginPage')) },
              { path: '/signup', lazy: page(() => import('@/pages/auth/SignupPage')) },
              { path: '/forgot-password', lazy: page(() => import('@/pages/auth/ForgotPasswordPage')) },
            ],
          },
        ],
      },
      {
        element: <AuthLayout />,
        children: [
          { path: '/reset-password', lazy: page(() => import('@/pages/auth/ResetPasswordPage')) },
          { path: '/verify-email', lazy: page(() => import('@/pages/auth/VerifyEmailPage')) },
          { path: '/invite/:token', lazy: page(() => import('@/pages/auth/AcceptInvitePage')) },
        ],
      },
      {
        element: <RequireAuth />,
        children: [
          { path: '/onboarding', lazy: page(() => import('@/pages/onboarding/OnboardingPage')) },
          { path: '/onboarding/:orgId/:step?', lazy: page(() => import('@/pages/onboarding/OnboardingPage')) },
          { path: '/account', lazy: page(() => import('@/pages/settings/AccountPage')) },
          { path: '/admin', lazy: page(() => import('@/pages/settings/PlatformAdminPage')) },
          {
            path: '/o/:orgId',
            element: <OrgLayout />,
            children: [
              { index: true, element: <OrgIndex /> },
              { path: 'sites/new', lazy: page(() => import('@/pages/settings/AddSitePage')) },
              { path: 'sites/:siteId', element: <SiteLayout />, children: siteDataPages },
              { path: 'tools', lazy: page(() => import('@/pages/tools/ToolsPage')) },
              { path: 'tools/:mode', lazy: page(() => import('@/pages/tools/ToolFormPage')) },
              { path: 'runs', lazy: page(() => import('@/pages/runs/RunsPage')) },
              { path: 'runs/:runId', lazy: page(() => import('@/pages/runs/RunDetailPage')) },
              { path: 'reports', lazy: page(() => import('@/pages/runs/ReportsPage')) },
              { path: 'reports/:reportId', lazy: page(() => import('@/pages/runs/ReportPage')) },
              { path: 'settings', element: <Navigate to="company" replace /> },
              { path: 'settings/:tab', lazy: page(() => import('@/pages/settings/OrgSettingsPage')) },
            ],
          },
        ],
      },
      // public website: "/" is the marketing home for visitors and the app (HomeRedirect) for signed-in users
      { path: '/', element: <RootRoute /> },
      { lazy: page(() => import('@/marketing/MarketingLayout')), children: marketingPages },
      { path: '*', lazy: page(() => import('@/pages/NotFoundPage')) },
    ],
  },
]);
