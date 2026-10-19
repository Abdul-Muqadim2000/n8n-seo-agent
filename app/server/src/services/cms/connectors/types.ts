import type { CmsConnectionSettings, CmsImage, CmsKind, CmsMode, CmsPage, CmsRemoteStatus } from '@seo/shared';
import { cmsRequest, type CmsHttpRequest, type CmsHttpResponse } from '../http';

/**
 * The connector interface (app/docs/CMS_PUBLISHING.md §4). One module per CMS; adding AEM, Sanity, Shopify or HubSpot is a new file
 * here and a kind in shared `CMS_KINDS`, the service, the routes, the rule and the UI do not change.
 */

/** What a connector gets: the connection's address, user, the opened secret and its non-secret settings. */
export interface ConnCtx {
  baseUrl: string;
  username: string;
  secret: string;
  settings: CmsConnectionSettings;
}

export interface CmsTestResult {
  ok: boolean;
  /** a sentence for the customer */
  message: string;
  /** what the test learned, merged into the stored settings (fields, plugin, locale, account) */
  settings?: Partial<CmsConnectionSettings>;
}

export interface RemoteItem {
  id: string;
  /** the address the CMS gives the item (a preview link for a WordPress draft), '' when it gives none */
  url: string;
  status: CmsRemoteStatus;
  /** Contentful's sys.version */
  version?: number;
}

export interface ImageWithBytes extends CmsImage {
  data: Buffer | null;
}

export interface PushOptions {
  mode: CmsMode;
  /** the item this page already is in the CMS (known from our table, or adopted by slug); null = create */
  remote: RemoteItem | null;
  /** the same for every send of the same item */
  idempotencyKey: string;
  images: ImageWithBytes[];
  /** images already uploaded for this item */
  media: Record<string, { id: string; url: string }>;
  /** the page's public address on the website */
  publicUrl: string;
  domain: string;
  report: { id: string; url: string };
  sentBy: string;
}

export interface PushResult {
  id: string;
  url: string;
  status: CmsRemoteStatus;
  /** what the customer should know (fields the CMS did not take, images not uploaded...) */
  notes: string[];
  media?: Record<string, { id: string; url: string }>;
}

export interface CmsConnector {
  kind: CmsKind;
  test(c: ConnCtx): Promise<CmsTestResult>;
  find(c: ConnCtx, page: CmsPage): Promise<RemoteItem | null>;
  push(c: ConnCtx, page: CmsPage, o: PushOptions): Promise<PushResult>;
  /** null: the item is gone, or this CMS cannot be asked */
  status(c: ConnCtx, remoteId: string): Promise<RemoteItem | null>;
}

/** A failure in the customer's words; `status` is the CMS's own HTTP status when it answered. */
export class CmsError extends Error {
  constructor(
    message: string,
    public status: number | null = null,
  ) {
    super(message);
  }
}

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
export { obj };
export const str = (v: unknown): string => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '');

/** The CMS's own error text, short, with nothing that looks like a credential. */
export function cmsMessage(res: CmsHttpResponse): string {
  const j = obj(res.json);
  const m =
    str(j.message) || str(obj(j.error).message) || str(j.msg) || str(j.error) || str(obj(j.details).errors) || (Array.isArray(j.errors) ? str(obj(j.errors[0]).message) || str(obj(j.errors[0]).details) : '') || res.text.slice(0, 200);
  return m
    .replace(/<[^>]+>/g, ' ')
    .replace(/(bearer|basic)\s+\S+/gi, '$1 ***')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 240);
}

/** Calls the CMS and turns a non-2xx answer into a CmsError that says what went wrong. */
export async function call(r: CmsHttpRequest, what: string, cms: string): Promise<CmsHttpResponse> {
  const res = await cmsRequest(r);
  if (res.status >= 200 && res.status < 300) return res;
  const detail = cmsMessage(res);
  if (res.status === 401) throw new CmsError(`${cms} refused the credentials (401) while trying to ${what}. Test the connection and paste a new secret if it was revoked.`, 401);
  if (res.status === 403) throw new CmsError(`${cms} says this account may not ${what} (403)${detail ? `: ${detail}` : ''}.`, 403);
  if (res.status === 404) throw new CmsError(`${cms} could not find what it needed to ${what} (404)${detail ? `: ${detail}` : ''}.`, 404);
  if (res.status >= 300 && res.status < 400) throw new CmsError(`${cms} redirected to ${res.headers.location ?? 'another address'}. Use that address in the connection.`, res.status);
  if (res.status === 429) throw new CmsError(`${cms} is limiting requests (429). Try again in a minute.`, 429);
  throw new CmsError(`${cms} answered ${res.status} while trying to ${what}${detail ? `: ${detail}` : ''}.`, res.status);
}

/**
 * The article as a CMS body: the CMS template shows the title as the page's H1 and the featured image above it, so the H1 (and the
 * hero figure, when it became the featured image) come out; scripts come out unless the CMS keeps them.
 */
export function articleBody(html: string, o: { dropH1?: boolean; dropScripts?: boolean; dropFigureWith?: string | null; srcMap?: Record<string, string> } = {}): string {
  let h = html;
  if (o.dropH1) h = h.replace(/<h1\b[^>]*>[\s\S]*?<\/h1>\s*/i, '');
  if (o.dropScripts) h = h.replace(/<script\b[\s\S]*?<\/script>\s*/gi, '');
  if (o.dropFigureWith) {
    const esc = o.dropFigureWith.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    h = h.replace(new RegExp(`<figure>\\s*<img[^>]*src="${esc}"[\\s\\S]*?</figure>\\s*`, 'i'), '');
  }
  for (const [from, to] of Object.entries(o.srcMap ?? {})) {
    if (!from || !to) continue;
    h = h.split(`src="${from}"`).join(`src="${to}"`);
  }
  return h.trim();
}
