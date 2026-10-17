import type { CmsFieldMap, CmsRemoteField, CmsSourceField } from '@seo/shared';
import { cmsRequest } from '../http';
import { call, CmsError, obj, str, type CmsConnector, type ConnCtx, type RemoteItem } from './types';
import { sourceValue } from './webflow';

/**
 * Contentful through the Content Management API with a CMA token. One content type, its fields mapped once. Request shapes and the
 * doc pages they follow: app/docs/CMS_PUBLISHING.md §4 "Contentful".
 */

const CMS = 'Contentful';
export const CONTENTFUL_API = 'https://api.contentful.com';
const MIME = 'application/vnd.contentful.management.v1+json';
const headers = (c: ConnCtx, extra: Record<string, string> = {}) => ({ authorization: `Bearer ${c.secret}`, 'content-type': MIME, accept: 'application/json', ...extra });
const env = (c: ConnCtx) => `${CONTENTFUL_API}/spaces/${encodeURIComponent(c.settings.spaceId ?? '')}/environments/${encodeURIComponent(c.settings.environment || 'master')}`;

/** Live when it was ever published (an entry edited after publishing is still live, with pending changes). */
const toRemote = (e: Record<string, unknown>): RemoteItem => {
  const sys = obj(e.sys);
  return { id: str(sys.id), url: '', status: typeof sys.publishedVersion === 'number' ? 'published' : 'draft', version: Number(sys.version) || undefined };
};

/** A value shaped for the field's type: Symbol holds 256 characters, Text 50,000, Date an ISO date. */
function shaped(v: string, type: string): unknown {
  if (type === 'Symbol') return v.slice(0, 255);
  if (type === 'Text') return v.slice(0, 50_000);
  if (type === 'Date') return /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : undefined;
  return v;
}

export const contentful: CmsConnector = {
  kind: 'contentful',

  async test(c) {
    const ct = await cmsRequest({ method: 'GET', url: `${env(c)}/content_types/${encodeURIComponent(c.settings.contentTypeId ?? '')}`, headers: headers(c) });
    if (ct.status === 401) return { ok: false, message: 'Contentful refused the token. Create a content management token (not a delivery token) and paste it again.' };
    if (ct.status === 404) return { ok: false, message: 'Contentful has no such space, environment or content type for this token. Check the three ids.' };
    if (ct.status < 200 || ct.status >= 300) return { ok: false, message: `Contentful answered ${ct.status} when asked for the content type.` };
    const t = obj(ct.json);
    const remoteFields: CmsRemoteField[] = (Array.isArray(t.fields) ? t.fields : [])
      .map(obj)
      .filter((f) => f.disabled !== true && f.omitted !== true)
      .map((f) => ({ id: str(f.id), name: str(f.name) || str(f.id), type: str(f.type), required: f.required === true }));
    const loc = await cmsRequest({ method: 'GET', url: `${env(c)}/locales`, headers: headers(c) }).catch(() => null);
    const locales = (Array.isArray(obj(loc?.json).items) ? (obj(loc?.json).items as unknown[]) : []).map(obj);
    const locale = str(locales.find((l) => l.default === true)?.code) || str(locales[0]?.code) || 'en-US';
    if (!remoteFields.some((f) => f.type === 'Text'))
      return { ok: false, message: `The content type "${str(t.name)}" has no long-text field for the article. Add a Long text (Markdown) field, then test again.`, settings: { remoteFields, locale } };
    return {
      ok: true,
      message: `Connected to the content type "${str(t.name)}" (${remoteFields.length} fields, locale ${locale}). Choose which fields hold the title, the slug and the article below.`,
      settings: { remoteFields, locale, account: str(t.name) },
    };
  },

  async find(c, page) {
    const slugField = c.settings.fieldMap?.slug;
    if (!slugField) return null;
    const res = await call(
      { method: 'GET', url: `${env(c)}/entries?content_type=${encodeURIComponent(c.settings.contentTypeId ?? '')}&fields.${encodeURIComponent(slugField)}=${encodeURIComponent(page.slug)}&limit=1`, headers: headers(c) },
      'look the entry up',
      CMS,
    );
    const first = (Array.isArray(obj(res.json).items) ? (obj(res.json).items as unknown[]) : []).map(obj)[0];
    return first ? toRemote(first) : null;
  },

  async status(c, remoteId) {
    const res = await cmsRequest({ method: 'GET', url: `${env(c)}/entries/${encodeURIComponent(remoteId)}`, headers: headers(c) });
    if (res.status === 404) return null;
    if (res.status < 200 || res.status >= 300) throw new CmsError(`Contentful answered ${res.status} when asked about the entry.`, res.status);
    return toRemote(obj(res.json));
  },

  async push(c, page, o) {
    const notes: string[] = [];
    const locale = c.settings.locale || 'en-US';
    const map: CmsFieldMap = c.settings.fieldMap ?? {};
    const types = new Map((c.settings.remoteFields ?? []).map((f) => [f.id, f.type]));
    const ours: Record<string, Record<string, unknown>> = {};
    for (const [src, dst] of Object.entries(map) as [CmsSourceField, string][]) {
      if (!dst) continue;
      const v = shaped(sourceValue(page, src), types.get(dst) ?? 'Text');
      if (v !== undefined && v !== '') ours[dst] = { [locale]: v };
    }
    if (o.images.length) notes.push(`Images are not uploaded to Contentful: add the featured image (${o.images[0]!.fileName}, alt text "${o.images[0]!.alt}") as an asset.`);

    let id: string;
    let version: number;
    if (o.remote) {
      // PUT replaces every field: start from the entry as it is, so fields we do not map are kept
      const cur = await call({ method: 'GET', url: `${env(c)}/entries/${encodeURIComponent(o.remote.id)}`, headers: headers(c) }, 'read the entry', CMS);
      const e = obj(cur.json);
      const fields = { ...obj(e.fields) } as Record<string, unknown>;
      for (const [k, v] of Object.entries(ours)) fields[k] = { ...obj(fields[k]), ...v };
      const res = await call(
        { method: 'PUT', url: `${env(c)}/entries/${encodeURIComponent(o.remote.id)}`, headers: headers(c, { 'x-contentful-version': String(obj(e.sys).version ?? o.remote.version ?? 1) }), body: JSON.stringify({ fields }) },
        'update the entry',
        CMS,
      );
      id = o.remote.id;
      version = Number(obj(obj(res.json).sys).version) || 0;
    } else {
      const res = await call(
        { method: 'POST', url: `${env(c)}/entries`, headers: headers(c, { 'x-contentful-content-type': c.settings.contentTypeId ?? '' }), body: JSON.stringify({ fields: ours }) },
        'create the entry',
        CMS,
      );
      const sys = obj(obj(res.json).sys);
      id = str(sys.id);
      version = Number(sys.version) || 0;
    }
    if (!id) throw new CmsError('Contentful answered without the id of the entry.');
    if (o.mode === 'live') {
      await call({ method: 'PUT', url: `${env(c)}/entries/${encodeURIComponent(id)}/published`, headers: headers(c, { 'x-contentful-version': String(version) }) }, 'publish the entry', CMS);
      return { id, url: o.publicUrl, status: 'published', notes };
    }
    // an entry that was live keeps its published version until somebody publishes again: say so
    if (o.remote?.status === 'published') notes.push('The entry is live with its earlier version; this draft waits in Contentful until it is published.');
    return { id, url: o.publicUrl, status: o.remote?.status === 'published' ? 'published' : 'draft', notes };
  },
};
