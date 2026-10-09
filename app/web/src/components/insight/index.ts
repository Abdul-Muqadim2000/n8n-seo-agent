// Ascentra in-app design system: building blocks that turn text-heavy pages into scannable, visual ones (summary hero, metric
// cards, score rings, insight rows, info tips, collapsibles, motion). Reference page: pages/site/OverviewPage.tsx.
// Import everything from '@/components/insight'.
export { IconTile, type IconTileTone } from '@/components/ui/icon-tile';
export { ActionCard, HeroLink, HeroNextStep, HeroStat, InsightItem, MetricCard, SummaryHero } from './cards';
export { CollapsePanel, Collapsible, DisclosureButton, InfoTip } from './disclosure';
export { DistributionBar, DistributionLegend, ProgressBar, ProgressSteps, ScoreRing, SEQ, TrendChip, trendOf, type RingTone, type Step } from './measures';
export { CountUp, prefersReducedMotion, Stagger } from './motion';
export { SurfaceContext, useSurface, type Surface } from './surface';
