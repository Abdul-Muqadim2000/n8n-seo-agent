import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CMS, cmsPage, type CmsPage } from '@seo/shared';
import { contentful } from '../src/services/cms/connectors/contentful';
import { articleBody, type ConnCtx, type ImageWithBytes, type PushOptions } from '../src/services/cms/connectors/types';
import { webflow } from '../src/services/cms/connectors/webflow';
import { verifyCms, webhook } from '../src/services/cms/connectors/webhook';
import { wordpress } from '../src/services/cms/connectors/wordpress';
import { setCmsTransport, type CmsHttpRequest, type CmsHttpResponse } from '../src/services/cms/http';

// The request shapes each connector sends, against a recorded fake of each vendor's API (no network). The shapes follow the vendors'
// public docs, cited in app/docs/CMS_PUBLISHING.md §4.

type Route = (r: CmsHttpRequest) => Partial<CmsHttpResponse> & { json?: unknown } | null;
let sent: CmsHttpRequest[] = [];
let routes: Route[] = [];
const respond = (status: number, json: unknown = {}): Partial<CmsHttpResponse> => ({ status, json, text: JSON.stringify(json) });
const on = (method: string, re: RegExp, res: (r: CmsHttpRequest) => Partial<CmsHttpResponse>): Route => (r) => (r.method === method && re.test(r.url) ? res(r) : null);

beforeEach(() => {
  sent = [];
  routes = [];
  setCmsTransport(async (r) => {
    sent.push(r);
    for (const route of routes) {
      const hit = route(r);
      if (hit) return { status: 200, headers: {}, text: '', json: null, ...hit } as CmsHttpResponse;
    }
    return { status: 404, headers: {}, text: '{"message":"no route"}', json: { message: 'no route' } };
  });
});
afterEach(() => setCmsTransport(null));

const body = (r: CmsHttpRequest) => JSON.parse(String(r.body));
const html = '<article>\n<h1>E-Invoicing in the UAE</h1>\n<figure><img src="images/hero.webp" alt="Hero"></figure>\n<h2>Is it mandatory?</h2><p>Yes.</p><img src="images/s1.webp">\n<script type="application/ld+json">{"@type":"Article"}</script>\n</article>';
const page: CmsPage = cmsPage({
  stage: 'content',
  keyword: 'e invoicing uae',
  domain: 'techand.ai',
  html,
  markdown: '# E-Invoicing in the UAE\n\nYes.',
  images: [{ $file: 'f1', fileName: 'hero.webp', mimeType: 'image/webp' }],
  meta: { title: 'E-Invoicing UAE: Deadlines', h1: 'E-Invoicing in the UAE', slug: 'e-invoicing-uae', meta_description: 'Find your phase.', schema_blocks: [{ json: { '@type': 'Article' } }], images: [{ filename: 'hero.webp', alt_text: 'Hero card', caption: 'c', purpose: 'hero', path: 'images/hero.webp' }], updated: '2026-10-17' },
});
const imgs: ImageWithBytes[] = page.images.map((i) => ({ ...i, data: Buffer.from('RIFF....WEBP') }));
const opts = (over: Partial<PushOptions> = {}): PushOptions => ({ mode: 'draft', remote: null, idempotencyKey: 'item-1', images: imgs, media: {}, publicUrl: 'https://techand.ai/e-invoicing-uae/', domain: 'techand.ai', report: { id: 'r1', url: 'https://app/r1' }, sentBy: 'Sara', ...over });

describe('articleBody', () => {
  it('drops the H1, scripts and the hero figure, rewrites image sources', () => {
    const out = articleBody(html, { dropH1: true, dropScripts: true, dropFigureWith: 'images/hero.webp', srcMap: { 'images/s1.webp': 'https://cdn/s1.webp' } });
    expect(out).not.toMatch(/<h1|<script|hero\.webp/);
    expect(out).toContain('src="https://cdn/s1.webp"');
  });
});

describe('WordPress (REST API, application password)', () => {
  const wp: ConnCtx = { baseUrl: 'https://blog.example.org', username: 'editor', secret: 'abcd efgh ijkl', settings: { postType: 'posts', categories: ['Guides'], tags: ['UAE'], seoPlugin: 'yoast', seoFields: ['_yoast_wpseo_title', '_yoast_wpseo_metadesc', '_yoast_wpseo_focuskw'], unfilteredHtml: false } };
  const authHeader = 'Basic ' + Buffer.from('editor:abcd efgh ijkl').toString('base64');

  it('test: who the user is, what it may do, which SEO fields are open', async () => {
    routes = [
      on('GET', /\/wp-json\/wp\/v2\/users\/me\?context=edit$/, () => respond(200, { id: 3, name: 'Editor', capabilities: { edit_posts: true, publish_posts: true, unfiltered_html: false } })),
      on('OPTIONS', /\/wp-json\/wp\/v2\/posts$/, () => respond(200, { schema: { properties: { meta: { properties: { _yoast_wpseo_metadesc: {}, _yoast_wpseo_title: {} } } } } })),
      on('GET', /\/wp-json\/$/, () => respond(200, { namespaces: ['wp/v2', 'yoast/v1'] })),
    ];
    const r = await wordpress.test(wp);
    expect(r.ok).toBe(true);
    expect(r.settings).toMatchObject({ account: 'Editor', canPublish: true, unfilteredHtml: false, seoPlugin: 'yoast', seoFields: ['_yoast_wpseo_title', '_yoast_wpseo_metadesc'] });
    expect(sent[0]!.headers!.authorization).toBe(authHeader);
  });

  it('test: a wrong password and a site without the REST API say so', async () => {
    routes = [on('GET', /users\/me/, () => respond(401, { code: 'invalid_username' }))];
    expect((await wordpress.test(wp)).message).toMatch(/refused the user name or the application password/);
    routes = [];
    expect((await wordpress.test(wp)).message).toMatch(/No WordPress REST API answered at https:\/\/blog\.example\.org\/wp-json/);
  });

  it('find: by slug, across every status, with the edit context', async () => {
    routes = [on('GET', /\/wp\/v2\/posts\?slug=e-invoicing-uae&status=publish,future,draft,pending,private&context=edit$/, () => respond(200, [{ id: 41, link: 'https://blog.example.org/?p=41', status: 'draft' }]))];
    expect(await wordpress.find(wp, page)).toEqual({ id: '41', url: 'https://blog.example.org/?p=41', status: 'draft' });
  });

  it('push: media upload + alt, categories/tags by name, the draft with Yoast fields, H1 / hero / scripts out', async () => {
    routes = [
      on('POST', /\/wp\/v2\/media$/, () => respond(201, { id: 77, source_url: 'https://blog.example.org/wp-content/uploads/hero.webp' })),
      on('POST', /\/wp\/v2\/media\/77$/, () => respond(200, { id: 77 })),
      on('GET', /\/wp\/v2\/categories\?search=Guides/, () => respond(200, [{ id: 5, name: 'guides' }])),
      on('GET', /\/wp\/v2\/tags\?search=UAE/, () => respond(200, [])),
      on('POST', /\/wp\/v2\/tags$/, () => respond(201, { id: 9, name: 'UAE' })),
      on('POST', /\/wp\/v2\/posts$/, () => respond(201, { id: 41, link: 'https://blog.example.org/?p=41', status: 'draft' })),
    ];
    const r = await wordpress.push(wp, page, opts());
    expect(r).toMatchObject({ id: '41', status: 'draft', media: { 'hero.webp': { id: '77', url: 'https://blog.example.org/wp-content/uploads/hero.webp' } } });
    const media = sent.find((s) => /\/media$/.test(s.url))!;
    expect(media.headers).toMatchObject({ 'content-type': 'image/webp', 'content-disposition': 'attachment; filename="hero.webp"', authorization: authHeader });
    expect(body(sent.find((s) => /\/media\/77$/.test(s.url))!)).toEqual({ alt_text: 'Hero card', caption: 'c' });
    const post = body(sent.find((s) => s.method === 'POST' && /\/posts$/.test(s.url))!);
    expect(post).toMatchObject({ title: 'E-Invoicing in the UAE', slug: 'e-invoicing-uae', status: 'draft', excerpt: 'Find your phase.', featured_media: 77, categories: [5], tags: [9], meta: { _yoast_wpseo_metadesc: 'Find your phase.', _yoast_wpseo_title: 'E-Invoicing UAE: Deadlines', _yoast_wpseo_focuskw: 'e invoicing uae' } });
    expect(post.content).not.toMatch(/<h1|<script|images\/hero\.webp/);
    expect(r.notes.join(' ')).toMatch(/Structured data \(Article\) was left out/);
  });

  it('push: an update goes to /posts/<id>, live is status publish, images already uploaded are not sent again, JSON-LD kept for unfiltered_html', async () => {
    routes = [on('POST', /\/wp\/v2\/posts\/41$/, () => respond(200, { id: 41, link: 'https://techand.ai/e-invoicing-uae/', status: 'publish' }))];
    const ctx: ConnCtx = { ...wp, settings: { ...wp.settings, categories: [], tags: [], seoPlugin: 'none', seoFields: [], unfilteredHtml: true } };
    const r = await wordpress.push(ctx, page, opts({ mode: 'live', remote: { id: '41', url: '', status: 'draft' }, media: { 'hero.webp': { id: '77', url: 'https://cdn/hero.webp' } } }));
    expect(r).toMatchObject({ id: '41', url: 'https://techand.ai/e-invoicing-uae/', status: 'published' });
    expect(sent.filter((s) => /\/media/.test(s.url))).toEqual([]);
    const post = body(sent.at(-1)!);
    expect(post).toMatchObject({ status: 'publish', featured_media: 77 });
    expect(post.meta).toBeUndefined();
    expect(post.content).toContain('application/ld+json');
    expect(r.notes.join(' ')).toMatch(/meta description went into the excerpt.*Paste the SEO title/);
  });
});

describe('Webflow (Data API v2)', () => {
  const wf: ConnCtx = {
    baseUrl: '',
    username: '',
    secret: 'wf-token-xxxxxxxxxxxxxxxxxxxx',
    settings: {
      collectionId: '643fd856d66b6528195ee2ca',
      fieldMap: { body_html: 'post-body', meta_description: 'meta-description', schema_json: 'schema' },
      remoteFields: [
        { id: 'post-body', name: 'Post body', type: 'RichText', required: false },
        { id: 'meta-description', name: 'Meta', type: 'PlainText', required: false },
        { id: 'schema', name: 'Schema', type: 'PlainText', required: false },
      ],
    },
  };
  const col = 'https://api.webflow.com/v2/collections/643fd856d66b6528195ee2ca';

  it('test: reads the collection fields with the bearer token', async () => {
    routes = [on('GET', new RegExp(`^${col}$`), () => respond(200, { displayName: 'Blog Posts', fields: [{ slug: 'name', displayName: 'Name', type: 'PlainText', isRequired: true }, { slug: 'post-body', displayName: 'Post body', type: 'RichText', isRequired: false }] }))];
    const r = await webflow.test(wf);
    expect(r.ok).toBe(true);
    expect(r.settings!.remoteFields).toEqual([{ id: 'name', name: 'Name', type: 'PlainText', required: true }, { id: 'post-body', name: 'Post body', type: 'RichText', required: false }]);
    expect(sent[0]!.headers!.authorization).toBe('Bearer wf-token-xxxxxxxxxxxxxxxxxxxx');
  });

  it('find: the exact slug filter, and an item with another slug is never adopted', async () => {
    routes = [on('GET', new RegExp(`^${col}/items\\?slug=e-invoicing-uae`), () => respond(200, { items: [{ id: 'x', fieldData: { slug: 'other' } }, { id: 'it1', isDraft: false, lastPublished: '2026-10-10', fieldData: { slug: 'e-invoicing-uae' } }] }))];
    expect(await webflow.find(wf, page)).toEqual({ id: 'it1', url: '', status: 'published' });
  });

  it('push: a draft is created with isDraft and the mapped fieldData; live is PATCH then publish', async () => {
    routes = [on('POST', new RegExp(`^${col}/items$`), () => respond(202, { id: 'it1', isDraft: true }))];
    const r = await webflow.push(wf, page, opts());
    expect(r).toMatchObject({ id: 'it1', status: 'draft', url: 'https://techand.ai/e-invoicing-uae/' });
    const b = body(sent[0]!);
    expect(b).toMatchObject({ isArchived: false, isDraft: true, fieldData: { name: 'E-Invoicing UAE: Deadlines', slug: 'e-invoicing-uae', 'meta-description': 'Find your phase.', schema: '{"@type":"Article"}' } });
    expect(b.fieldData['post-body']).not.toMatch(/<h1|<script/);
    expect(r.notes.join(' ')).toMatch(/Images are not uploaded to Webflow/);

    sent = [];
    routes = [on('PATCH', new RegExp(`^${col}/items/it1$`), () => respond(200, { id: 'it1' })), on('POST', new RegExp(`^${col}/items/publish$`), () => respond(202, { publishedItemIds: ['it1'], errors: [] }))];
    const live = await webflow.push(wf, page, opts({ mode: 'live', remote: { id: 'it1', url: '', status: 'draft' } }));
    expect(live.status).toBe('published');
    expect(body(sent[0]!).isDraft).toBe(false);
    expect(body(sent[1]!)).toEqual({ itemIds: ['it1'] });
  });

  it('a publish that Webflow refuses is an error, not a success', async () => {
    routes = [on('POST', new RegExp(`^${col}/items$`), () => respond(202, { id: 'it1' })), on('POST', /items\/publish$/, () => respond(202, { publishedItemIds: [], errors: ['Site has no domain'] }))];
    await expect(webflow.push(wf, page, opts({ mode: 'live' }))).rejects.toThrow(/did not publish the item: Site has no domain/);
  });
});

describe('Contentful (Content Management API)', () => {
  const cf: ConnCtx = {
    baseUrl: '',
    username: '',
    secret: 'CFPAT-xxxxxxxxxxxxxxxxxxxx',
    settings: {
      spaceId: 'abc123xyz',
      environment: 'master',
      contentTypeId: 'blogPost',
      locale: 'en-US',
      fieldMap: { title: 'title', slug: 'slug', body_markdown: 'body', updated: 'date' },
      remoteFields: [
        { id: 'title', name: 'Title', type: 'Symbol', required: true },
        { id: 'slug', name: 'Slug', type: 'Symbol', required: true },
        { id: 'body', name: 'Body', type: 'Text', required: false },
        { id: 'date', name: 'Date', type: 'Date', required: false },
      ],
    },
  };
  const env = 'https://api.contentful.com/spaces/abc123xyz/environments/master';

  it('test: the content type and the default locale', async () => {
    routes = [
      on('GET', new RegExp(`^${env}/content_types/blogPost$`), () => respond(200, { name: 'Blog post', fields: [{ id: 'title', name: 'Title', type: 'Symbol', required: true }, { id: 'body', name: 'Body', type: 'Text' }, { id: 'old', name: 'Old', type: 'Symbol', omitted: true }] })),
      on('GET', new RegExp(`^${env}/locales$`), () => respond(200, { items: [{ code: 'de-DE' }, { code: 'en-GB', default: true }] })),
    ];
    const r = await contentful.test(cf);
    expect(r.ok).toBe(true);
    expect(r.settings).toMatchObject({ locale: 'en-GB', remoteFields: [{ id: 'title', name: 'Title', type: 'Symbol', required: true }, { id: 'body', name: 'Body', type: 'Text', required: false }] });
    expect(sent[0]!.headers).toMatchObject({ authorization: 'Bearer CFPAT-xxxxxxxxxxxxxxxxxxxx', 'content-type': 'application/vnd.contentful.management.v1+json' });
  });

  it('find by the mapped slug field', async () => {
    routes = [on('GET', new RegExp(`^${env}/entries\\?content_type=blogPost&fields\\.slug=e-invoicing-uae&limit=1$`), () => respond(200, { items: [{ sys: { id: 'e1', version: 4, publishedVersion: 3 } }] }))];
    expect(await contentful.find(cf, page)).toEqual({ id: 'e1', url: '', status: 'published', version: 4 });
  });

  it('create with the content-type header and localised fields; live publishes with the version', async () => {
    routes = [on('POST', new RegExp(`^${env}/entries$`), () => respond(201, { sys: { id: 'e1', version: 1 } })), on('PUT', new RegExp(`^${env}/entries/e1/published$`), () => respond(200, { sys: { id: 'e1', version: 2, publishedVersion: 1 } }))];
    const r = await contentful.push(cf, page, opts({ mode: 'live' }));
    expect(r).toMatchObject({ id: 'e1', status: 'published' });
    expect(sent[0]!.headers).toMatchObject({ 'x-contentful-content-type': 'blogPost' });
    expect(body(sent[0]!)).toEqual({ fields: { title: { 'en-US': 'E-Invoicing UAE: Deadlines' }, slug: { 'en-US': 'e-invoicing-uae' }, body: { 'en-US': 'Yes.' }, date: { 'en-US': '2026-10-17' } } });
    expect(sent[1]!.headers).toMatchObject({ 'x-contentful-version': '1' });
  });

  it('update keeps the fields we do not map and sends the current version', async () => {
    routes = [
      on('GET', new RegExp(`^${env}/entries/e1$`), () => respond(200, { sys: { id: 'e1', version: 7 }, fields: { title: { 'en-US': 'Old' }, hero: { 'en-US': { sys: { id: 'asset1' } } } } })),
      on('PUT', new RegExp(`^${env}/entries/e1$`), () => respond(200, { sys: { id: 'e1', version: 8 } })),
    ];
    const r = await contentful.push(cf, page, opts({ remote: { id: 'e1', url: '', status: 'draft', version: 7 } }));
    expect(r.status).toBe('draft');
    const put = sent.find((s) => s.method === 'PUT')!;
    expect(put.headers).toMatchObject({ 'x-contentful-version': '7' });
    expect(body(put).fields.hero).toEqual({ 'en-US': { sys: { id: 'asset1' } } });
    expect(body(put).fields.title).toEqual({ 'en-US': 'E-Invoicing UAE: Deadlines' });
  });
});

describe('Generic signed webhook', () => {
  const wh: ConnCtx = { baseUrl: 'https://hooks.example.org/alaventra', username: '', secret: 'whsec_test', settings: {} };

  it('signs the body, sends the idempotency key and the whole package, and reads the answer', async () => {
    routes = [on('POST', /hooks\.example\.org/, () => respond(200, { id: 'pr-12', url: 'https://github.com/x/y/pull/12', status: 'draft' }))];
    const r = await webhook.push(wh, page, opts());
    expect(r).toEqual({ id: 'pr-12', url: 'https://github.com/x/y/pull/12', status: 'draft', notes: [] });
    const req = sent[0]!;
    const h = req.headers!;
    expect(h['idempotency-key']).toBe('item-1');
    expect(h[CMS.eventHeader]).toBe('cms.publish');
    expect(verifyCms('whsec_test', h[CMS.timestampHeader]!, String(req.body), h[CMS.signatureHeader]!)).toBe(true);
    expect(verifyCms('wrong', h[CMS.timestampHeader]!, String(req.body), h[CMS.signatureHeader]!)).toBe(false);
    const b = body(req);
    expect(b.page.images[0]).toMatchObject({ file_name: 'hero.webp', data: Buffer.from('RIFF....WEBP').toString('base64') });
    expect(String(req.body)).not.toContain('whsec_test');
  });

  it('a non-2xx answer is a failure with the status', async () => {
    routes = [on('POST', /hooks/, () => respond(500, { error: 'boom' }))];
    await expect(webhook.push(wh, page, opts())).rejects.toThrow(/answered 500: boom/);
    expect((await webhook.test(wh)).ok).toBe(false);
  });
});
