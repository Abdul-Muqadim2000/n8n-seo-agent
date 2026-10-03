import { createBrowserRouter, Navigate, type RouteObject } from 'react-router';
import { RouteError } from '@/components/layout/RouteError';
import { PageLoader } from '@/components/ui/feedback';
import { AuthLayout, PublicOnly, RequireAuth } from '@/components/layout/AuthGate';
import { HomeRedirect } from '@/components/layout/HomeRedirect';
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

export const router = createBrowserRouter([
  {
    errorElement: <RouteError />,
    // shown while the first lazy page module loads
    hydrateFallbackElement: <PageLoader />,
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
          { path: '/', element: <HomeRedirect /> },
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
      { path: '*', lazy: page(() => import('@/pages/NotFoundPage')) },
    ],
  },
]);
