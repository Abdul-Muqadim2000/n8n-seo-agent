import { z } from 'zod';
import { cleanDomain, domainOk, urlOnDomain } from './domain';
import { findOpenBrackets, type OpenBracket } from './placeholders';
import { deliveryDecision } from './report-delivery';

/**
 * G2, publishing a written page to the customer's CMS (app/docs/CMS_PUBLISHING.md).
 *
 * This file holds what the server and the browser must agree on, and what is worth testing without a network: the kinds of CMS, the
 * settings and their schemas, **the rule that decides whether a page may leave the app** (`cmsReadiness`), the page package every
 * connector publishes from, the address of a live page, the field mapping and the generic webhook's body.
 *
 * The rule refuses by default. A page the run marked not ready is never sent anywhere, it is the delivery rule of B-R1
 * (`deliveryDecision`), called unchanged, and a page with text left for the owner (`[Confirm: ...]`, `[Owner: ...]`, `[Price]`,
 * `[Author Name]`) is never sent either, as a draft or live. There is no override, for any role.
 */

// ---------------------------------------------------------------------------------------------------------------------------
// 1. Kinds
// ---------------------------------------------------------------------------------------------------------------------------

export const CMS_KINDS = ['wordpress', 'webflow', 'contentful', 'webhook'] as const;
export type CmsKind = (typeof CMS_KINDS)[number];

export interface CmsKindInfo {
  id: CmsKind;
  label: string;
  description: string;
  /** the "Show me how" guide for its credentials */
  guide: string;
  /** what the secret is called in that CMS */
  secretLabel: string;
  needsBaseUrl: boolean;
  needsUsername: boolean;
  /** maps our fields onto the CMS's own fields */
  mapsFields: boolean;
}

export const CMS_KIND_INFO: Record<CmsKind, CmsKindInfo> = {
  wordpress: {
    id: 'wordpress',
    label: 'WordPress',
    description: 'Posts or pages through the WordPress REST API, signed in with an application password. Categories, tags, the featured image and your SEO plugin\'s fields when it exposes them.',
    guide: 'wordpress-application-password',
    secretLabel: 'Application password',
    needsBaseUrl: true,
    needsUsername: true,
    mapsFields: false,
  },
  webflow: {
    id: 'webflow',
    label: 'Webflow',
    description: 'An item in one of your CMS collections (Data API v2), with your collection\'s fields mapped once.',
    guide: 'webflow-api-token',
    secretLabel: 'Site API token',
    needsBaseUrl: false,
    needsUsername: false,
    mapsFields: true,
  },
  contentful: {
    id: 'contentful',
    label: 'Contentful',
    description: 'An entry of one content type (Content Management API), with its fields mapped once.',
    guide: 'contentful-cma-token',
    secretLabel: 'Content management token',
    needsBaseUrl: false,
    needsUsername: false,
    mapsFields: true,
  },
  webhook: {
    id: 'webhook',
    label: 'Webhook (any other stack)',
    description: 'The whole page package as signed JSON to an address of yours (a headless CMS, a build pipeline or a bot that opens a pull request).',
    guide: 'cms-webhook',
    secretLabel: 'Signing secret',
    needsBaseUrl: true,
    needsUsername: false,
    mapsFields: false,
  },
};

export const CMS = {
  /** connections per website */
  maxConnectionsPerSite: 5,
  /** how long one publish holds its item (a second click meanwhile is refused) */
  leaseMinutes: 2,
  /** images sent in one webhook body, and their total size */
  webhookMaxImageBytes: 3 * 1024 * 1024,
  signatureHeader: 'X-Alaventra-Signature',
  timestampHeader: 'X-Alaventra-Timestamp',
  eventHeader: 'X-Alaventra-Event',
} as const;

// ---------------------------------------------------------------------------------------------------------------------------
// 2. Field mapping (Webflow / Contentful)
// ---------------------------------------------------------------------------------------------------------------------------

export const CMS_SOURCE_FIELDS = [
  { id: 'title', label: 'Title', hint: 'The page title (the SEO title when there is one)' },
  { id: 'slug', label: 'Slug', hint: 'The planned address of the page' },
  { id: 'body_html', label: 'Article (HTML)', hint: 'For a rich-text field' },
  { id: 'body_markdown', label: 'Article (Markdown)', hint: 'For a long-text field' },
  { id: 'h1', label: 'Main heading (H1)', hint: '' },
  { id: 'seo_title', label: 'SEO title', hint: 'The <title> of the page' },
  { id: 'meta_description', label: 'Meta description', hint: '' },
  { id: 'excerpt', label: 'Excerpt / summary', hint: 'The meta description, as a summary' },
  { id: 'keyword', label: 'Main keyword', hint: '' },
  { id: 'author', label: 'Author name', hint: '' },
  { id: 'schema_json', label: 'Structured data (JSON-LD)', hint: 'For a plain or long-text field' },
  { id: 'updated', label: 'Updated date', hint: 'YYYY-MM-DD' },
] as const;
export type CmsSourceField = (typeof CMS_SOURCE_FIELDS)[number]['id'];
const SOURCE_IDS = CMS_SOURCE_FIELDS.map((f) => f.id) as [CmsSourceField, ...CmsSourceField[]];

/** One field of the CMS's own model, as the connection test read it. */
export interface CmsRemoteField {
  id: string;
  name: string;
  /** the CMS's own type name (Webflow: PlainText, RichText...; Contentful: Symbol, Text, RichText...) */
  type: string;
  required: boolean;
}

export type CmsFieldMap = Partial<Record<CmsSourceField, string>>;

/** Remote types that can hold each kind of value. */
const TEXT_TYPES: Record<'webflow' | 'contentful', string[]> = {
  webflow: ['PlainText', 'RichText', 'Link', 'Email', 'Phone'],
  contentful: ['Symbol', 'Text'],
};
const HTML_TYPES: Record<'webflow' | 'contentful', string[]> = { webflow: ['RichText', 'PlainText'], contentful: ['Text'] };
const DATE_TYPES: Record<'webflow' | 'contentful', string[]> = { webflow: ['DateTime', 'PlainText'], contentful: ['Date', 'Symbol'] };

/**
 * What is wrong with a field mapping, in words (empty = it can be used). Webflow always fills `name` and `slug` itself; Contentful
 * needs the title, the slug and the article mapped. A field of the wrong type (Contentful Rich Text above all) is refused with why.
 */
export function fieldMapProblems(kind: CmsKind, map: CmsFieldMap, remote: readonly CmsRemoteField[]): string[] {
  if (kind !== 'webflow' && kind !== 'contentful') return [];
  const out: string[] = [];
  const byId = new Map(remote.map((f) => [f.id, f]));
  const used = new Map<string, string>();
  for (const [src, dst] of Object.entries(map) as [CmsSourceField, string][]) {
    if (!dst) continue;
    const label = CMS_SOURCE_FIELDS.find((f) => f.id === src)?.label ?? src;
    const f = byId.get(dst);
    if (!f) {
      out.push(`${label}: the field "${dst}" is not in the ${kind === 'webflow' ? 'collection' : 'content type'} any more. Test the connection again`);
      continue;
    }
    if (kind === 'webflow' && (dst === 'name' || dst === 'slug')) {
      out.push(`${label}: "${f.name}" is filled by Alaventra already (the title and the slug)`);
      continue;
    }
    if (used.has(dst)) out.push(`${f.name} is mapped twice (${used.get(dst)} and ${label})`);
    used.set(dst, label);
    if (kind === 'contentful' && f.type === 'RichText')
      out.push(`${label} (${f.name}): Contentful Rich Text is a document model, not HTML. Map the article to a long-text (Markdown) field`);
    else if ((src === 'body_html' || src === 'body_markdown') && !HTML_TYPES[kind].includes(f.type))
      out.push(`${label} (${f.name}): a ${f.type} field cannot hold a whole article`);
    else if (src === 'updated' && !DATE_TYPES[kind].includes(f.type)) out.push(`${label} (${f.name}): a ${f.type} field cannot hold a date`);
    else if (src !== 'body_html' && src !== 'body_markdown' && src !== 'updated' && !TEXT_TYPES[kind].includes(f.type) && !(kind === 'contentful' && f.type === 'Symbol'))
      out.push(`${label} (${f.name}): a ${f.type} field cannot hold text`);
  }
  if (kind === 'contentful') {
    if (!map.title) out.push('Choose the field that holds the title');
    if (!map.slug) out.push('Choose the field that holds the slug');
    if (!map.body_markdown && !map.body_html) out.push('Choose the field that holds the article');
  }
  if (kind === 'webflow' && !map.body_html && !map.body_markdown) out.push('Choose the rich-text field that holds the article');
  // a required field of the CMS that nothing fills would make every create fail
  const filled = new Set(Object.values(map).filter(Boolean));
  for (const f of remote)
    if (f.required && !filled.has(f.id) && !(kind === 'webflow' && (f.id === 'name' || f.id === 'slug')))
      out.push(`${f.name} is required in your CMS and nothing fills it. Map a field to it or make it optional there`);
  return out;
}

// ---------------------------------------------------------------------------------------------------------------------------
// 3. Settings and their schemas
// ---------------------------------------------------------------------------------------------------------------------------

/** Non-secret settings of a connection (stored as they are and returned to the browser). */
export interface CmsConnectionSettings {
  // WordPress
  postType?: 'posts' | 'pages';
  categories?: string[];
  tags?: string[];
  seoPlugin?: 'yoast' | 'rankmath' | 'none';
  seoFields?: string[];
  unfilteredHtml?: boolean;
  canPublish?: boolean;
  // Webflow
  collectionId?: string;
  collectionName?: string;
  // Contentful
  spaceId?: string;
  environment?: string;
  contentTypeId?: string;
  locale?: string;
  // Webflow / Contentful
  fieldMap?: CmsFieldMap;
  remoteFields?: CmsRemoteField[];
  // every kind
  /** the address of a live page, e.g. https://example.com/blog/{slug}/ (empty: the engine's planned address) */
  publicUrlTemplate?: string;
  /** who the credentials belong to, as the CMS answered the test */
  account?: string;
}

/**
 * A CMS address a customer typed: https only, a public host name (no IP literals, no localhost / internal names), no credentials in
 * the URL. The server also pins the connection to public IPs (DNS can say anything).
 */
export function cmsUrlOk(value: string, opts: { allowPrivate?: boolean } = {}): boolean {
  const m = String(value || '').trim().match(/^(https?):\/\/([^/?#@\s]+)(?:[/?#]\S*)?$/i);
  if (!m) return false;
  const scheme = m[1]!.toLowerCase();
  const host = m[2]!.toLowerCase().replace(/:\d+$/, '');
  if (opts.allowPrivate) return true;
  if (scheme !== 'https') return false;
  return domainOk(host.replace(/^www\./, '')) || domainOk(host);
}

const trimmed = (max: number) => z.string().trim().max(max);
const httpsUrl = z
  .string()
  .trim()
  .max(500)
  .refine((v) => cmsUrlOk(v), 'Enter an https:// address on a public host')
  .transform((v) => v.replace(/\/+$/, ''));
const urlTemplate = z
  .string()
  .trim()
  .max(300)
  .refine((v) => !v || (/^https:\/\/[^/\s]+/i.test(v) && v.includes('{slug}')), 'Use an https:// address with {slug} in it, e.g. https://{domain}/blog/{slug}/')
  .default('');
const terms = z.array(trimmed(60).min(1)).max(10).default([]);
const fieldMapSchema = z.partialRecord(z.enum(SOURCE_IDS), z.string().trim().max(80)).default({});

const wordpressCreate = z.object({
  kind: z.literal('wordpress'),
  label: trimmed(60).default(''),
  baseUrl: httpsUrl,
  username: trimmed(120).min(1, 'Enter the WordPress user name'),
  secret: z
    .string()
    .trim()
    .min(8, 'Paste the application password')
    .max(200)
    .transform((v) => v.replace(/\s+/g, ' ')),
  postType: z.enum(['posts', 'pages']).default('posts'),
  categories: terms,
  tags: terms,
  publicUrlTemplate: urlTemplate,
});
const webflowCreate = z.object({
  kind: z.literal('webflow'),
  label: trimmed(60).default(''),
  secret: trimmed(400).min(20, 'Paste the site API token'),
  collectionId: z.string().trim().regex(/^[0-9a-f]{24}$/i, 'The collection id is 24 letters and digits (from the collection settings)'),
  fieldMap: fieldMapSchema,
  publicUrlTemplate: urlTemplate,
});
const contentfulCreate = z.object({
  kind: z.literal('contentful'),
  label: trimmed(60).default(''),
  secret: trimmed(400).min(20, 'Paste the content management token'),
  spaceId: z.string().trim().regex(/^[a-z0-9]{6,64}$/i, 'The space id is letters and digits (Settings > General settings)'),
  environment: z.string().trim().regex(/^[A-Za-z0-9_.-]{1,64}$/, 'Letters, digits, dots, dashes').default('master'),
  contentTypeId: z.string().trim().regex(/^[A-Za-z0-9_.-]{1,64}$/, 'The content type id (Content model > the type > its id)'),
  fieldMap: fieldMapSchema,
  publicUrlTemplate: urlTemplate,
});
const webhookCreate = z.object({
  kind: z.literal('webhook'),
  label: trimmed(60).default(''),
  baseUrl: httpsUrl,
  publicUrlTemplate: urlTemplate,
});

export const cmsConnectionCreateSchema = z.discriminatedUnion('kind', [wordpressCreate, webflowCreate, contentfulCreate, webhookCreate]);
export type CmsConnectionCreate = z.input<typeof cmsConnectionCreateSchema>;
export type CmsConnectionCreateParsed = z.output<typeof cmsConnectionCreateSchema>;

/** A change: any field of the connection's own kind; `secret` left out keeps the stored one. The kind never changes. */
export const cmsConnectionUpdateSchema = z.object({
  label: trimmed(60).optional(),
  baseUrl: httpsUrl.optional(),
  username: trimmed(120).min(1).optional(),
  secret: z.string().trim().min(8).max(400).optional(),
  postType: z.enum(['posts', 'pages']).optional(),
  categories: z.array(trimmed(60).min(1)).max(10).optional(),
  tags: z.array(trimmed(60).min(1)).max(10).optional(),
  collectionId: z.string().trim().regex(/^[0-9a-f]{24}$/i, 'The collection id is 24 letters and digits').optional(),
  spaceId: z.string().trim().regex(/^[a-z0-9]{6,64}$/i).optional(),
  environment: z.string().trim().regex(/^[A-Za-z0-9_.-]{1,64}$/).optional(),
  contentTypeId: z.string().trim().regex(/^[A-Za-z0-9_.-]{1,64}$/).optional(),
  fieldMap: z.partialRecord(z.enum(SOURCE_IDS), z.string().trim().max(80)).optional(),
  publicUrlTemplate: urlTemplate.optional(),
});
export type CmsConnectionUpdate = z.input<typeof cmsConnectionUpdateSchema>;

export const CMS_MODES = ['draft', 'live'] as const;
export type CmsMode = (typeof CMS_MODES)[number];

export const cmsPublishSchema = z.object({
  connectionId: z.string().uuid('Choose a connection'),
  mode: z.enum(CMS_MODES).default('draft'),
  /** "publish live" is an explicit choice: without it a live request is refused */
  confirmLive: z.boolean().default(false),
});
export type CmsPublishInput = z.input<typeof cmsPublishSchema>;

export const cmsRefreshSchema = z.object({ connectionId: z.string().uuid('Choose a connection') });

// ---------------------------------------------------------------------------------------------------------------------------
// 4. The page package
// ---------------------------------------------------------------------------------------------------------------------------

export interface CmsImage {
  /** the app's file id, when the run delivered the image file */
  fileId: string | null;
  fileName: string;
  mimeType: string;
  alt: string;
  caption: string;
  /** hero | section | ... */
  purpose: string;
  /** the path the article's HTML uses for it (images/...webp) */
  path: string;
}

export interface CmsPage {
  title: string;
  h1: string;
  seoTitle: string;
  slug: string;
  metaDescription: string;
  excerpt: string;
  html: string;
  markdown: string;
  keyword: string;
  /** JSON-LD blocks */
  schema: Record<string, unknown>[];
  images: CmsImage[];
  author: string;
  updated: string;
  /** the engine's planned address of the page (may be a path) */
  suggestedUrl: string;
  domain: string;
  ladder: { id: string; rung: number | null; head: string } | null;
}

type P = Record<string, unknown>;
const obj = (v: unknown): P => (v && typeof v === 'object' && !Array.isArray(v) ? (v as P) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const s = (v: unknown): string => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '');

export const slugify = (v: string): string =>
  v
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90);

/** The engine's callback (stage `content`) > the one package every connector publishes from. */
export function cmsPage(payload: P): CmsPage {
  const meta = obj(payload.meta);
  const plan = arr(meta.images).map(obj);
  const files = arr(payload.images).map(obj);
  const images: CmsImage[] = files
    .filter((f) => s(f.$file) || s(f.fileName))
    .map((f, i) => {
      const name = s(f.fileName);
      const p = plan.find((x) => s(x.filename) && s(x.filename) === name) ?? plan.find((x) => s(x.binary_key) === `image_${i + 1}`) ?? plan[i] ?? {};
      return {
        fileId: s(f.$file) || null,
        fileName: name || s(p.filename) || `image-${i + 1}.webp`,
        mimeType: s(f.mimeType) || 'image/webp',
        alt: (s(p.alt_text) || s(f.alt_text)).slice(0, 250),
        caption: (s(p.caption) || s(f.caption)).slice(0, 500),
        purpose: s(p.purpose) || s(f.purpose) || (i === 0 ? 'hero' : 'section'),
        path: s(p.path),
      };
    });
  const seoTitle = s(meta.title);
  const h1 = s(meta.h1) || seoTitle;
  const description = s(meta.meta_description);
  const author = obj(meta.author);
  const ladder = obj(meta.ladder);
  const keyword = s(payload.keyword) || s(meta.primary_keyword);
  return {
    title: seoTitle || h1 || keyword,
    h1,
    seoTitle,
    slug: slugify(s(meta.slug) || keyword),
    metaDescription: description,
    excerpt: description,
    html: s(payload.html),
    markdown: s(payload.markdown),
    keyword,
    schema: arr(meta.schema_blocks)
      .map(obj)
      .map((b) => obj(b.json ?? b))
      .filter((b) => Object.keys(b).length > 0),
    images,
    author: s(author.name),
    updated: s(meta.updated) || s(meta.generated_at).slice(0, 10),
    suggestedUrl: s(meta.suggested_url),
    domain: cleanDomain(s(payload.domain) || s(meta.domain)),
    ladder: s(ladder.ladder_id) || s(payload.ladder_id)
      ? { id: s(ladder.ladder_id) || s(payload.ladder_id), rung: typeof ladder.rung === 'number' ? ladder.rung : typeof payload.ladder_rung === 'number' ? payload.ladder_rung : null, head: s(ladder.head_keyword) || s(payload.ladder_head) }
      : null,
  };
}

// ---------------------------------------------------------------------------------------------------------------------------
// 5. Placeholders
// ---------------------------------------------------------------------------------------------------------------------------

/** Text of a page a reader sees as text: scripts and styles out (JSON-LD and CSS selectors are not gaps for a person). */
const visibleText = (t: string): string => t.replace(/<script\b[\s\S]*?<\/script>/gi, ' ').replace(/<style\b[\s\S]*?<\/style>/gi, ' ');

/**
 * Every bracket left for a person (a gap to fill or a review note to confirm), once each with its count, through the ONE detector
 * the engine's Content QA and the delivery rule use (`findOpenBrackets`, placeholders.ts), so the CMS gate cannot disagree with them.
 */
export function findCmsPlaceholders(texts: readonly string[]): OpenBracket[] {
  const m = new Map<string, OpenBracket>();
  for (const raw of texts)
    for (const b of findOpenBrackets(visibleText(raw || ''))) {
      const token = b.token.length > 120 ? `${b.token.slice(0, 117)}...]` : b.token;
      const had = m.get(token);
      m.set(token, { token, kind: b.kind, count: (had?.count ?? 0) + b.count });
    }
  return [...m.values()].sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'placeholder' ? -1 : 1) || b.count - a.count || a.token.localeCompare(b.token));
}

// ---------------------------------------------------------------------------------------------------------------------------
// 6. The rule
// ---------------------------------------------------------------------------------------------------------------------------

export type CmsBlockCode = 'not_a_page' | 'not_ready' | 'not_publishable' | 'placeholders' | 'no_title' | 'no_slug' | 'other_domain' | 'no_website';

export interface CmsBlocker {
  code: CmsBlockCode;
  message: string;
  /** the open brackets, for `placeholders` (gaps to fill first, then review notes to confirm) */
  items?: { token: string; count: number; kind?: 'placeholder' | 'review_note' }[];
}

export interface CmsReadiness {
  draftAllowed: boolean;
  liveAllowed: boolean;
  blockers: CmsBlocker[];
  warnings: string[];
  /** why live is refused when a draft is allowed */
  liveRefusal: string;
  qualityChecked: boolean;
}

export interface CmsCandidate {
  stage: string;
  status: string;
  payload: P;
  /** the website the report belongs to (null: written without one) */
  siteDomain: string | null;
}

/** Whether a page report may go to a CMS, as a draft and live, and every reason it may not. */
export function cmsReadiness(c: CmsCandidate, page: CmsPage = cmsPage(c.payload ?? {})): CmsReadiness {
  const p = c.payload ?? {};
  const meta = obj(p.meta);
  const blockers: CmsBlocker[] = [];
  const warnings: string[] = [];
  const isPage = (c.stage || s(p.stage)) === 'content' && (page.html.trim().length > 50 || page.markdown.trim().length > 50);

  if (!isPage) blockers.push({ code: 'not_a_page', message: 'This report has no written page to publish.' });
  if (!c.siteDomain) blockers.push({ code: 'no_website', message: 'This page was written without one of your websites, so there is no CMS connection to send it to.' });

  // B-R1's rule, unchanged: rejected, not ready (QA failed, or A-13: brackets still open), refused, could not be checked, interim.
  // When the only reason is the open brackets, the placeholder blocker below says it with the full list, so it is not said twice.
  const d = deliveryDecision({ stage: c.stage, status: c.status, payload: p });
  const bracketsOnly = !d.deliver && deliveryDecision({ stage: c.stage, status: c.status, payload: { ...p, markdown: '', page_markdown: '' } }).deliver;
  if (!d.deliver && !bracketsOnly) blockers.push({ code: 'not_ready', message: d.reason });
  const quality = obj(p.qa_quality ?? meta.quality);
  if ((d.deliver || bracketsOnly) && (meta.publishable === false || quality.publishable === false || quality.not_ready === true))
    blockers.push({ code: 'not_publishable', message: 'The page package says this page may not be published as it is (a draft to finish by hand).' });

  if (isPage) {
    const author = obj(meta.author);
    // the HTML and the Markdown both: the delivery rule reads the Markdown, the CMS receives the HTML (or the Markdown)
    // (the two are the same article: a bracket in both counts as often as the version that has it more often, not twice)
    const inHtml = findCmsPlaceholders([page.html, page.title, page.h1, page.metaDescription, s(author.name)]);
    const inMd = findCmsPlaceholders([page.markdown]);
    const merged = new Map(inHtml.map((b) => [b.token, b]));
    for (const b of inMd) merged.set(b.token, { ...b, count: Math.max(b.count, merged.get(b.token)?.count ?? 0) });
    const ph = [...merged.values()].sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'placeholder' ? -1 : 1) || b.count - a.count || a.token.localeCompare(b.token));
    if (ph.length) {
      const total = ph.reduce((t, x) => t + x.count, 0);
      blockers.push({
        code: 'placeholders',
        message: `${total} ${total === 1 ? 'placeholder is' : 'placeholders are'} still in the page. Fill ${total === 1 ? 'it' : 'them'} in (or remove ${total === 1 ? 'it' : 'them'}) and run the page again before it goes to your CMS.`,
        items: ph.slice(0, 40),
      });
    }
    if (!page.title.trim()) blockers.push({ code: 'no_title', message: 'The page has no title.' });
    if (!page.slug) blockers.push({ code: 'no_slug', message: 'The page has no slug (address).' });
    if (c.siteDomain && page.domain && cleanDomain(c.siteDomain) !== page.domain)
      blockers.push({ code: 'other_domain', message: `The page was written for ${page.domain}, not for ${cleanDomain(c.siteDomain)}.` });
  }

  const qualityChecked = p.qa_publishable === true || meta.publishable === true || quality.publishable === true || /quality check passed/i.test(s(p.qa_summary) || s(meta.qa_summary));
  let liveRefusal = '';
  if (isPage && !qualityChecked) {
    warnings.push('The quality check did not run for this page: it can go to your CMS as a draft for a person to review, not live.');
    liveRefusal = 'The quality check did not run for this page, so it can only be sent as a draft.';
  }
  if (isPage && page.images.length === 0) warnings.push('No image files came with this page: add the featured image in your CMS.');

  const draftAllowed = blockers.length === 0;
  return { draftAllowed, liveAllowed: draftAllowed && qualityChecked, blockers, warnings, liveRefusal: draftAllowed ? liveRefusal : blockers[0]!.message, qualityChecked };
}

// ---------------------------------------------------------------------------------------------------------------------------
// 7. Where the live page is
// ---------------------------------------------------------------------------------------------------------------------------

/**
 * The public address of the page: the connection's pattern (`{domain}`, `{slug}`), else the engine's planned address, else
 * https://<domain>/<slug>/. Empty when no domain is known.
 */
export function cmsPublicUrl(template: string | undefined, page: Pick<CmsPage, 'slug' | 'suggestedUrl'>, domain: string): string {
  const d = cleanDomain(domain);
  if (template && template.includes('{slug}')) return template.replace(/\{domain\}/g, d).replace(/\{slug\}/g, page.slug);
  const u = page.suggestedUrl.trim();
  if (/^https?:\/\//i.test(u) && d && urlOnDomain(u, d)) return u;
  if (u.startsWith('/') && d) return `https://${d}${u}`;
  return d && page.slug ? `https://${d}/${page.slug}/` : '';
}

// ---------------------------------------------------------------------------------------------------------------------------
// 8. The generic webhook's body
// ---------------------------------------------------------------------------------------------------------------------------

export interface CmsWebhookImage extends CmsImage {
  /** base64 bytes, when the file was small enough to carry */
  data?: string;
}

export function cmsWebhookBody(o: {
  idempotencyKey: string;
  mode: CmsMode;
  domain: string;
  page: CmsPage;
  images: CmsWebhookImage[];
  publicUrl: string;
  report: { id: string; url: string };
  sentAt: string;
  sentBy: string;
}): Record<string, unknown> {
  const { page } = o;
  return {
    event: 'cms.publish',
    version: 1,
    idempotency_key: o.idempotencyKey,
    mode: o.mode,
    status: o.mode === 'live' ? 'publish' : 'draft',
    sent_at: o.sentAt,
    sent_by: o.sentBy,
    website: o.domain,
    report: o.report,
    page: {
      title: page.title,
      h1: page.h1,
      seo_title: page.seoTitle,
      slug: page.slug,
      public_url: o.publicUrl,
      meta_description: page.metaDescription,
      excerpt: page.excerpt,
      keyword: page.keyword,
      author: page.author,
      updated: page.updated,
      html: page.html,
      markdown: page.markdown,
      schema: page.schema,
      ladder: page.ladder,
      images: o.images.map((im) => ({
        file_name: im.fileName,
        mime_type: im.mimeType,
        alt: im.alt,
        caption: im.caption,
        purpose: im.purpose,
        path: im.path,
        ...(im.data ? { data: im.data } : {}),
      })),
    },
  };
}

// ---------------------------------------------------------------------------------------------------------------------------
// 9. What the API returns
// ---------------------------------------------------------------------------------------------------------------------------

export type CmsConnectionStatus = 'untested' | 'ok' | 'error';
export type CmsRemoteStatus = 'draft' | 'published' | 'unknown';
export type CmsPublishStatus = 'sent' | 'failed' | 'blocked';

export interface CmsConnectionView {
  id: string;
  siteId: string;
  kind: CmsKind;
  label: string;
  baseUrl: string;
  username: string;
  hasSecret: boolean;
  settings: CmsConnectionSettings;
  status: CmsConnectionStatus;
  statusReason: string;
  lastTestedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CmsTestResultView {
  ok: boolean;
  message: string;
  connection: CmsConnectionView;
}

export interface CmsItemView {
  id: string;
  connectionId: string;
  connectionLabel: string;
  kind: CmsKind;
  slug: string;
  keyword: string;
  remoteId: string;
  remoteUrl: string;
  remoteStatus: CmsRemoteStatus;
  lastReportId: string | null;
  engineToldAt: string | null;
  updatedAt: string;
}

export interface CmsPublishView {
  id: string;
  reportId: string | null;
  connectionId: string | null;
  connectionLabel: string;
  kind: CmsKind | null;
  keyword: string;
  mode: CmsMode;
  status: CmsPublishStatus;
  remoteId: string;
  remoteUrl: string;
  target: string;
  error: string;
  notes: string[];
  blockers: CmsBlocker[];
  engineRunId: string | null;
  userName: string | null;
  createdAt: string;
}

export interface CmsReportState {
  readiness: CmsReadiness;
  /** what this person may do (the server checks again) */
  canDraft: boolean;
  canLive: boolean;
  page: { title: string; slug: string; keyword: string; images: number } | null;
  connections: CmsConnectionView[];
  items: CmsItemView[];
  history: CmsPublishView[];
  /** the address the page would have on the website, per connection */
  publicUrls: Record<string, string>;
}

export interface CmsSiteState {
  connections: CmsConnectionView[];
  items: CmsItemView[];
  recent: CmsPublishView[];
}

export interface CmsPublishResult {
  ok: boolean;
  record: CmsPublishView;
  item: CmsItemView | null;
  /** what happened in the engine after a live publish */
  engine: { told: boolean; runId: string | null; note: string };
}

export const CMS_REMOTE_STATUS_LABEL: Record<CmsRemoteStatus, string> = { draft: 'Draft', published: 'Live', unknown: 'Sent' };
export const cmsKindLabel = (k: string | null | undefined): string => (k && k in CMS_KIND_INFO ? CMS_KIND_INFO[k as CmsKind].label.replace(/ \(.*\)$/, '') : 'CMS');
