import type { CmsPage } from '@seo/shared';
import { cmsRequest } from '../http';
import { articleBody, call, CmsError, obj, str, type CmsConnector, type ConnCtx, type RemoteItem } from './types';

/**
 * WordPress through its REST API, signed in with an Application Password (WordPress 5.6+). Request shapes and the doc pages they
 * follow: app/docs/CMS_PUBLISHING.md §4 "WordPress".
 */

const CMS = 'WordPress';
const STATUSES = 'publish,future,draft,pending,private';

/** "https://blog.example.org" or ".../wp-json" -> the REST root. */
export const wpApi = (baseUrl: string): string => baseUrl.replace(/\/+$/, '').replace(/\/wp-json$/i, '') + '/wp-json';
const auth = (c: ConnCtx) => ({ authorization: 'Basic ' + Buffer.from(`${c.username}:${c.secret}`, 'utf8').toString('base64') });
const type = (c: ConnCtx) => (c.settings.postType === 'pages' ? 'pages' : 'posts');
const json = (c: ConnCtx) => ({ ...auth(c), 'content-type': 'application/json' });

/** Registered meta keys of the SEO plugins, when the site exposes them to the REST API (`show_in_rest`). */
export const SEO_KEYS = {
  yoast: { title: '_yoast_wpseo_title', description: '_yoast_wpseo_metadesc', keyword: '_yoast_wpseo_focuskw' },
  rankmath: { title: 'rank_math_title', description: 'rank_math_description', keyword: 'rank_math_focus_keyword' },
} as const;

const toRemote = (p: Record<string, unknown>): RemoteItem => ({
  id: str(p.id),
  url: str(p.link),
  // `future` (scheduled) is not live yet, `private` is not public: neither counts as published
  status: str(p.status) === 'publish' ? 'published' : 'draft',
});

/** Category / tag names -> ids, creating the missing ones (exact name match, case-insensitive). */
async function termIds(c: ConnCtx, taxonomy: 'categories' | 'tags', names: string[], notes: string[]): Promise<number[]> {
  const ids: number[] = [];
  for (const name of names) {
    try {
      const res = await call({ method: 'GET', url: `${wpApi(c.baseUrl)}/wp/v2/${taxonomy}?search=${encodeURIComponent(name)}&per_page=100&context=edit`, headers: auth(c) }, `read the ${taxonomy}`, CMS);
      const found = (Array.isArray(res.json) ? res.json : []).map(obj).find((t) => str(t.name).toLowerCase() === name.toLowerCase());
      if (found) {
        ids.push(Number(found.id));
        continue;
      }
      const made = await call({ method: 'POST', url: `${wpApi(c.baseUrl)}/wp/v2/${taxonomy}`, headers: json(c), body: JSON.stringify({ name }) }, `create the ${taxonomy === 'tags' ? 'tag' : 'category'} "${name}"`, CMS);
      ids.push(Number(obj(made.json).id));
    } catch (e) {
      notes.push(`The ${taxonomy === 'tags' ? 'tag' : 'category'} "${name}" could not be set: ${(e as Error).message}`);
    }
  }
  return ids.filter((n) => Number.isFinite(n) && n > 0);
}

export const wordpress: CmsConnector = {
  kind: 'wordpress',

  async test(c) {
    const me = await cmsRequest({ method: 'GET', url: `${wpApi(c.baseUrl)}/wp/v2/users/me?context=edit`, headers: auth(c) });
    if (me.status === 404 || (me.status === 200 && !obj(me.json).id))
      return { ok: false, message: `No WordPress REST API answered at ${wpApi(c.baseUrl)}. Check the address (the site's own address, not /wp-admin) and that the REST API is not blocked by a security plugin.` };
    if (me.status === 401)
      return { ok: false, message: 'WordPress refused the user name or the application password. Create a new application password for this user (Users > Profile > Application Passwords) and paste it again.' };
    if (me.status < 200 || me.status >= 300) return { ok: false, message: `WordPress answered ${me.status} when asked who this user is.` };
    const user = obj(me.json);
    const caps = obj(user.capabilities);
    const canPublish = caps[type(c) === 'pages' ? 'publish_pages' : 'publish_posts'] === true;
    const canEdit = caps[type(c) === 'pages' ? 'edit_pages' : 'edit_posts'] === true;
    if (!canEdit) return { ok: false, message: `The user ${str(user.name)} may not create ${type(c)} in WordPress. Use an Editor or Administrator account.` };

    // which SEO fields the site exposes to the REST API (registered meta of the post type)
    const opts = await cmsRequest({ method: 'OPTIONS', url: `${wpApi(c.baseUrl)}/wp/v2/${type(c)}`, headers: auth(c) }).catch(() => null);
    const metaProps = Object.keys(obj(obj(obj(obj(opts?.json).schema).properties).meta).properties ?? {});
    const root = await cmsRequest({ method: 'GET', url: `${wpApi(c.baseUrl)}/`, headers: auth(c) }).catch(() => null);
    const namespaces = (Array.isArray(obj(root?.json).namespaces) ? (obj(root?.json).namespaces as unknown[]) : []).map(str);
    const exposed = (Object.keys(SEO_KEYS) as (keyof typeof SEO_KEYS)[]).find((p) => metaProps.includes(SEO_KEYS[p].description));
    const installed = namespaces.some((n) => n.startsWith('yoast')) ? 'yoast' : namespaces.some((n) => n.startsWith('rankmath')) ? 'rankmath' : null;
    const seoPlugin = exposed ?? installed ?? 'none';
    const seoFields = exposed ? Object.values(SEO_KEYS[exposed]).filter((k) => metaProps.includes(k)) : [];
    const pluginName = seoPlugin === 'yoast' ? 'Yoast SEO' : seoPlugin === 'rankmath' ? 'Rank Math' : '';
    const parts = [
      `Signed in as ${str(user.name) || c.username}.`,
      canPublish ? `It may publish ${type(c)}.` : `It may create drafts but not publish ${type(c)}: "Publish live" will fail until the user is an Editor or Administrator.`,
      exposed
        ? `${pluginName} fields are open to the REST API: the SEO title and the meta description go straight into them.`
        : installed
          ? `${pluginName} is installed but its fields are not open to the REST API: the meta description goes into the excerpt, and the SEO title has to be pasted in ${pluginName}.`
          : 'No SEO plugin fields were found: the meta description goes into the excerpt.',
      caps.unfiltered_html === true ? '' : 'This user cannot save structured data (JSON-LD) in a post, so it is left out and listed for your SEO plugin.',
    ].filter(Boolean);
    return {
      ok: true,
      message: parts.join(' '),
      settings: { account: str(user.name) || c.username, canPublish, unfilteredHtml: caps.unfiltered_html === true, seoPlugin, seoFields },
    };
  },

  async find(c, page) {
    const res = await call({ method: 'GET', url: `${wpApi(c.baseUrl)}/wp/v2/${type(c)}?slug=${encodeURIComponent(page.slug)}&status=${STATUSES}&context=edit`, headers: auth(c) }, 'look the page up', CMS);
    const first = (Array.isArray(res.json) ? res.json : []).map(obj)[0];
    return first ? toRemote(first) : null;
  },

  async status(c, remoteId) {
    const res = await cmsRequest({ method: 'GET', url: `${wpApi(c.baseUrl)}/wp/v2/${type(c)}/${encodeURIComponent(remoteId)}?context=edit`, headers: auth(c) });
    if (res.status === 404 || res.status === 410) return null;
    if (res.status < 200 || res.status >= 300) throw new CmsError(`WordPress answered ${res.status} when asked about the page.`, res.status);
    return toRemote(obj(res.json));
  },

  async push(c, page: CmsPage, o) {
    const notes: string[] = [];
    const media = { ...o.media };

    // 1. images: upload once per item, the hero becomes the featured image, article src rewritten to the media URLs
    for (const im of o.images) {
      if (media[im.fileName] || !im.data) continue;
      try {
        const up = await call(
          { method: 'POST', url: `${wpApi(c.baseUrl)}/wp/v2/media`, headers: { ...auth(c), 'content-type': im.mimeType || 'image/webp', 'content-disposition': `attachment; filename="${im.fileName.replace(/["\\\r\n]/g, '')}"` }, body: im.data, timeoutMs: 60_000 },
          `upload ${im.fileName}`,
          CMS,
        );
        const m = obj(up.json);
        media[im.fileName] = { id: str(m.id), url: str(m.source_url) };
        if (im.alt || im.caption)
          await call({ method: 'POST', url: `${wpApi(c.baseUrl)}/wp/v2/media/${str(m.id)}`, headers: json(c), body: JSON.stringify({ alt_text: im.alt, caption: im.caption }) }, `set the alt text of ${im.fileName}`, CMS).catch(() =>
            notes.push(`The alt text of ${im.fileName} could not be set: add "${im.alt}" in the media library.`),
          );
      } catch (e) {
        notes.push(`${im.fileName} was not uploaded (${(e as Error).message}). Add it in WordPress.`);
      }
    }
    const hero = o.images.find((im) => im.purpose === 'hero') ?? o.images[0];
    const heroMedia = hero ? media[hero.fileName] : undefined;
    const srcMap: Record<string, string> = {};
    for (const im of o.images) if (media[im.fileName]?.url) for (const from of [im.path, im.fileName, `images/${im.fileName}`]) if (from) srcMap[from] = media[im.fileName]!.url;

    // 2. structured data stays only when this user may save it (WordPress strips <script> otherwise)
    const keepScripts = c.settings.unfilteredHtml === true;
    if (!keepScripts && page.schema.length)
      notes.push(`Structured data (${page.schema.map((b) => str(b['@type'])).filter(Boolean).join(', ') || 'JSON-LD'}) was left out: this WordPress user may not save scripts. Add it with your SEO plugin, or connect an Administrator.`);
    const content = articleBody(page.html, { dropH1: true, dropScripts: !keepScripts, dropFigureWith: heroMedia ? hero!.path : null, srcMap });

    // 3. the SEO fields: into the plugin's own fields when they are open, else the description into the excerpt
    const meta: Record<string, string> = {};
    const plugin = c.settings.seoPlugin === 'yoast' || c.settings.seoPlugin === 'rankmath' ? SEO_KEYS[c.settings.seoPlugin] : null;
    const fields = new Set(c.settings.seoFields ?? []);
    if (plugin && fields.has(plugin.description)) {
      meta[plugin.description] = page.metaDescription;
      if (fields.has(plugin.title) && page.seoTitle) meta[plugin.title] = page.seoTitle;
      if (fields.has(plugin.keyword) && page.keyword) meta[plugin.keyword] = page.keyword;
    } else notes.push(`The meta description went into the excerpt. ${page.seoTitle ? `Paste the SEO title "${page.seoTitle}" into your SEO plugin.` : ''}`.trim());

    const isPost = type(c) === 'posts';
    const body: Record<string, unknown> = {
      title: page.h1 || page.title,
      content,
      excerpt: page.excerpt,
      slug: page.slug,
      status: o.mode === 'live' ? 'publish' : 'draft',
      ...(heroMedia?.id ? { featured_media: Number(heroMedia.id) } : {}),
      ...(Object.keys(meta).length ? { meta } : {}),
    };
    if (isPost) {
      const cats = await termIds(c, 'categories', c.settings.categories ?? [], notes);
      const tags = await termIds(c, 'tags', c.settings.tags ?? [], notes);
      if (cats.length) body.categories = cats;
      if (tags.length) body.tags = tags;
    }

    const url = o.remote ? `${wpApi(c.baseUrl)}/wp/v2/${type(c)}/${encodeURIComponent(o.remote.id)}` : `${wpApi(c.baseUrl)}/wp/v2/${type(c)}`;
    const res = await call({ method: 'POST', url, headers: json(c), body: JSON.stringify(body), timeoutMs: 60_000 }, o.mode === 'live' ? `publish the ${isPost ? 'post' : 'page'}` : `save the draft`, CMS);
    const r = toRemote(obj(res.json));
    if (!r.id) throw new CmsError('WordPress answered without the id of the post.');
    if (o.mode === 'live' && r.status !== 'published') notes.push(`WordPress saved the ${isPost ? 'post' : 'page'} as "${str(obj(res.json).status)}", not published: the user may lack the right to publish.`);
    return { ...r, notes, media };
  },
};
