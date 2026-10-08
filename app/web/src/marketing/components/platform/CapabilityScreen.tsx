import type { Feature, ScreenKey, VisualKey } from '../../content/features';
import { BrowserFrame } from '../BrowserFrame';
import { FeatureVisual } from '../FeatureVisual';
import { PipelineMockup, ReportMockup } from './screens';

/** where each capability lives in the app, for the address bar of the browser frame */
const APP_PATH: Record<string, string> = {
  autopilot: 'pipeline',
  'keyword-research': 'keywords',
  'keyword-ladders': 'pipeline/ladders',
  content: 'content',
  'technical-audits': 'technical',
  'site-tracking': 'overview',
  'ai-visibility': 'ai-visibility',
  backlinks: 'backlinks',
  reports: 'reports',
  enterprise: 'settings/company',
};

/** a full product page (the dashboard) needs the full content width: pages stack text above it instead of beside it */
export const isWideScreen = (f: Feature) => !f.screen && f.visual === 'dashboard';

const DIAGRAMS: VisualKey[] = ['growth-loop', 'link-sources', 'ai-engines'];
const SCREENS: Record<ScreenKey, typeof PipelineMockup> = { pipeline: PipelineMockup, report: ReportMockup };
/** a mockup's own card chrome, removed when it sits inside a browser frame */
const FLAT = 'rounded-none border-0 shadow-none';

/** A capability's product visual: its platform screen if it has one, else its registry visual.
 *  `framed` puts product screens in a browser window (diagrams and the already-framed dashboard are shown as they are). */
export function CapabilityScreen({ feature, framed = false, className }: { feature: Feature; framed?: boolean; className?: string }) {
  const url = `app.ascentra.com/${APP_PATH[feature.slug] ?? feature.slug}`;
  const label = `${feature.name}: product preview`;
  if (feature.screen) {
    const Screen = SCREENS[feature.screen];
    return framed ? (
      <BrowserFrame url={url} label={label} className={className}>
        <Screen className={FLAT} />
      </BrowserFrame>
    ) : (
      <Screen className={className} />
    );
  }
  const kind = feature.visual;
  if (!framed || kind === 'dashboard' || DIAGRAMS.includes(kind)) return <FeatureVisual kind={kind} className={className} />;
  return (
    <BrowserFrame url={url} label={label} className={className}>
      <FeatureVisual kind={kind} className={FLAT} />
    </BrowserFrame>
  );
}
