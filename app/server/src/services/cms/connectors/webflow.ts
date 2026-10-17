import type { CmsFieldMap, CmsPage, CmsRemoteField, CmsSourceField } from '@seo/shared';
import { cmsRequest } from '../http';
import { articleBody, call, CmsError, obj, str, type CmsConnector, type ConnCtx, type RemoteItem } from './types';

/**
 * Webflow CMS through the Data API v2 with a site API token (cms:read, cms:write). One collection, its fields mapped once. Request
 * shapes and the doc pages they follow: app/docs/CMS_PUBLISHING.md §4 "Webflow".
 */

const CMS = 'Webflow';
export const WEBFLOW_API = 'https://api.webflow.com/v2';
const headers = (c: ConnCtx) => ({ authorization: `Bearer ${c.secret}`, 'content-type': 'application/json', accept: 'application/json' });
const col = (c: ConnCtx) => `${WEBFLOW_API}/collections/${encodeURIComponent(c.settings.collectionId ?? '')}`;

const toRemote = (it: Record<string, unknown>, publicUrl = ''): RemoteItem => ({
  id: str(it.id),
  url: publicUrl,
  // staged item: live once it is not a draft and has been published at least once
  status: it.isDraft !== true && !!str(it.lastPublished) ? 'published' : 'draft',
});

/** The value of one of our fields for the page. */
export function sourceValue(page: CmsPage, field: CmsSourceField, o: { stripForRichText?: boolean } = {}): string {
  switch (field) {
    case 'title':
      return page.title;
    case 'slug':
      return page.slug;
    case 'body_html':
      return o.stripForRichText ? articleBody(page.html, { dropH1: true, dropScripts: true }) : page.html;
    case 'body_markdown':
      return page.markdown.replace(/^#\s+[^\n]*\n+/, '');
    case 'h1':
      return page.h1;
    case 'seo_title':
      return page.seoTitle;
    case 'meta_description':
      return page.metaDescription;
    case 'excerpt':
      return page.excerpt;
    case 'keyword':
      return page.keyword;
    case 'author':
      return page.author;
    case 'schema_json':
      return page.schema.length ? JSON.stringify(page.schema.length === 1 ? page.schema[0] : page.schema) : '';
    case 'updated':
      return page.updated;
  }
}

export const webflow: CmsConnector = {
  kind: 'webflow',

  async test(c) {
    const res = await cmsRequest({ method: 'GET', url: col(c), headers: headers(c) });
    if (res.status === 401) return { ok: false, message: 'Webflow refused the API token. Create a site API token with CMS read and write access and paste it again.' };
    if (res.status === 403) return { ok: false, message: 'The API token may not read this collection: give it CMS read and write access.' };
    if (res.status === 404) return { ok: false, message: 'Webflow has no collection with this id for this token. Copy the collection id from the collection’s settings in the Designer.' };
    if (res.status < 200 || res.status >= 300) return { ok: false, message: `Webflow answered ${res.status} when asked for the collection.` };
    const j = obj(res.json);
    const remoteFields: CmsRemoteField[] = (Array.isArray(j.fields) ? j.fields : [])
      .map(obj)
      .map((f) => ({ id: str(f.slug), name: str(f.displayName) || str(f.slug), type: str(f.type), required: f.isRequired === true }))
      .filter((f) => f.id);
    if (!remoteFields.some((f) => f.type === 'RichText'))
      return { ok: false, message: `The collection "${str(j.displayName)}" has no rich-text field to hold the article. Add one in Webflow, then test again.`, settings: { remoteFields, collectionName: str(j.displayName) } };
    return {
      ok: true,
      message: `Connected to the collection "${str(j.displayName)}" (${remoteFields.length} fields). Choose which field holds the article and the SEO fields below.`,
      settings: { remoteFields, collectionName: str(j.displayName), account: str(j.displayName) },
    };
  },

  async find(c, page) {
    const res = await call({ method: 'GET', url: `${col(c)}/items?slug=${encodeURIComponent(page.slug)}&limit=10`, headers: headers(c) }, 'look the item up', CMS);
    // the slug filter is exact, but an older API that ignores it must not make us adopt someone else's item
    const it = (Array.isArray(obj(res.json).items) ? (obj(res.json).items as unknown[]) : []).map(obj).find((x) => str(obj(x.fieldData).slug) === page.slug);
    return it ? toRemote(it) : null;
  },

  async status(c, remoteId) {
    const res = await cmsRequest({ method: 'GET', url: `${col(c)}/items/${encodeURIComponent(remoteId)}`, headers: headers(c) });
    if (res.status === 404) return null;
    if (res.status < 200 || res.status >= 300) throw new CmsError(`Webflow answered ${res.status} when asked about the item.`, res.status);
    return toRemote(obj(res.json));
  },

  async push(c, page, o) {
    const notes: string[] = [];
    const map: CmsFieldMap = c.settings.fieldMap ?? {};
    const types = new Map((c.settings.remoteFields ?? []).map((f) => [f.id, f.type]));
    const fieldData: Record<string, unknown> = { name: page.title.slice(0, 256), slug: page.slug };
    for (const [src, dst] of Object.entries(map) as [CmsSourceField, string][]) {
      if (!dst || dst === 'name' || dst === 'slug') continue;
      const v = sourceValue(page, src, { stripForRichText: types.get(dst) === 'RichText' });
      if (v) fieldData[dst] = v;
    }
    if (o.images.length) notes.push(`Images are not uploaded to Webflow: add the featured image (${o.images[0]!.fileName}, alt text "${o.images[0]!.alt}") in the item.`);
    if (page.schema.length && !map.schema_json) notes.push('Structured data was left out: map it to a field your template renders, or add it in the page settings.');

    const isDraft = o.mode !== 'live';
    const res = o.remote
      ? await call({ method: 'PATCH', url: `${col(c)}/items/${encodeURIComponent(o.remote.id)}`, headers: headers(c), body: JSON.stringify({ isArchived: false, isDraft, fieldData }) }, 'update the item', CMS)
      : await call({ method: 'POST', url: `${col(c)}/items`, headers: headers(c), body: JSON.stringify({ isArchived: false, isDraft, fieldData }) }, 'create the item', CMS);
    const id = str(obj(res.json).id) || o.remote?.id || '';
    if (!id) throw new CmsError('Webflow answered without the id of the item.');
    if (o.mode === 'live') {
      const pub = await call({ method: 'POST', url: `${col(c)}/items/publish`, headers: headers(c), body: JSON.stringify({ itemIds: [id] }) }, 'publish the item', CMS);
      const errors = Array.isArray(obj(pub.json).errors) ? (obj(pub.json).errors as unknown[]) : [];
      if (errors.length) throw new CmsError(`Webflow did not publish the item: ${errors.map((e) => str(e) || str(obj(e).message)).join('; ').slice(0, 200)}`);
      return { id, url: o.publicUrl, status: 'published', notes };
    }
    return { id, url: o.publicUrl, status: 'draft', notes };
  },
};
