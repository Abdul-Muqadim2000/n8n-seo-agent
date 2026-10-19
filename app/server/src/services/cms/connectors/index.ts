import type { CmsKind } from '@seo/shared';
import { contentful } from './contentful';
import type { CmsConnector } from './types';
import { webflow } from './webflow';
import { webhook } from './webhook';
import { wordpress } from './wordpress';

/** Every connector by kind. A new CMS (AEM, Sanity, Shopify...) is one more entry here and a kind in shared `CMS_KINDS`. */
export const CONNECTORS: Record<CmsKind, CmsConnector> = { wordpress, webflow, contentful, webhook };

export const connectorFor = (kind: string): CmsConnector | null => (kind in CONNECTORS ? CONNECTORS[kind as CmsKind] : null);

export * from './types';
