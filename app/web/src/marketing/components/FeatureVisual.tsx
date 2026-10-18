import type { VisualKey } from '../content/features';
import { BrowserFrame } from './BrowserFrame';
import { AiEnginesDiagram } from './diagrams/AiEnginesDiagram';
import { GrowthLoopDiagram } from './diagrams/GrowthLoopDiagram';
import { LinkSourcesDiagram } from './diagrams/LinkSourcesDiagram';
import { AiVisibilityMockup } from './mockups/AiVisibilityMockup';
import { AuditMockup } from './mockups/AuditMockup';
import { BacklinkLedgerMockup } from './mockups/BacklinkLedgerMockup';
import { ContentMockup } from './mockups/ContentMockup';
import { CrawlersMockup } from './mockups/CrawlersMockup';
import { DashboardMockup } from './mockups/DashboardMockup';
import { DeliveryMockup } from './mockups/DeliveryMockup';
import { GuideMockup } from './mockups/GuideMockup';
import { IntegrationsMockup } from './mockups/IntegrationsMockup';
import { KeywordVerdictMockup } from './mockups/KeywordVerdictMockup';
import { LadderMockup } from './mockups/LadderMockup';
import { WorkspaceMockup } from './mockups/WorkspaceMockup';
import { AgencyPortalMockup } from './mockups/AgencyPortalMockup';
import { AiGrowthMockup } from './mockups/AiGrowthMockup';
import { OutreachMockup } from './mockups/OutreachMockup';

/** Renders the mockup or diagram a feature names in the registry (`feature.visual` / `feature.diagram`). */
export function FeatureVisual({ kind, className }: { kind: VisualKey; className?: string }) {
  switch (kind) {
    case 'dashboard':
      return (
        <BrowserFrame url="app.alaventra.com/overview" className={className}>
          <DashboardMockup />
        </BrowserFrame>
      );
    case 'ai-visibility':
      return <AiVisibilityMockup className={className} />;
    case 'ladder':
      return <LadderMockup className={className} />;
    case 'backlinks':
      return <BacklinkLedgerMockup className={className} />;
    case 'keyword-verdict':
      return <KeywordVerdictMockup className={className} />;
    case 'content':
      return <ContentMockup className={className} />;
    case 'audit':
      return <AuditMockup className={className} />;
    case 'workspace':
      return <WorkspaceMockup className={className} />;
    case 'agency-portal':
      return <AgencyPortalMockup className={className} />;
    case 'report-delivery':
      return <DeliveryMockup className={className} />;
    case 'guided-setup':
      return <GuideMockup className={className} />;
    case 'integrations':
      return <IntegrationsMockup className={className} />;
    case 'growth-loop':
      return <GrowthLoopDiagram className={className} />;
    case 'link-sources':
      return <LinkSourcesDiagram className={className} />;
    case 'crawlers':
      return <CrawlersMockup className={className} />;
    case 'ai-engines':
      return <AiEnginesDiagram className={className} />;
    case 'ai-growth':
      return <AiGrowthMockup className={className} />;
    case 'outreach':
      return <OutreachMockup className={className} />;
  }
}
