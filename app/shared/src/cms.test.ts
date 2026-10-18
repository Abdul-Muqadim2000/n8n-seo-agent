import { describe, expect, it } from 'vitest';
import {
  cmsConnectionCreateSchema,
  cmsConnectionUpdateSchema,
  cmsPage,
  cmsPublicUrl,
  cmsPublishSchema,
  cmsReadiness,
  cmsUrlOk,
  cmsWebhookBody,
  fieldMapProblems,
  findCmsPlaceholders,
  slugify,
  type CmsRemoteField,
} from './cms';

const words = (n: number) => Array.from({ length: n }, (_, i) => `word${i}`).join(' ');
const html = `<h2>Is e-invoicing mandatory?</h2><p>${words(80)}</p><img src="images/hero.webp" alt="E-invoicing flow">`;

/** A content callback as the engine sends it (stage `content`), after the app moved its files out (`$file`). */
const page = (over: Record<string, unknown> = {}, meta: Record<string, unknown> = {}) => ({
  status: 'completed',
  stage: 'content',
  keyword: 'e invoicing uae',
  domain: 'techand.ai',
  qa_summary: 'Quality check passed',
  qa_publishable: true,
  qa_not_ready: false,
  html,
  markdown: `# E-invoicing in the UAE\n\nSee [the FTA guide](https://tax.gov.ae/x). ${words(80)}`,
  images: [{ $file: '11111111-1111-1111-1111-111111111111', fileName: 'e-invoicing-uae-hero.webp', mimeType: 'image/webp', size: 1200 }],
  meta: {
    title: 'E-Invoicing UAE: Deadlines and Phases',
    h1: 'E-Invoicing in the UAE',
    slug: 'e-invoicing-uae',
    suggested_url: 'https://techand.ai/e-invoicing-uae/',
    meta_description: 'Find your phase and deadline.',
    domain: 'techand.ai',
    schema_blocks: [{ type: 'Article', json: { '@context': 'https://schema.org', '@type': 'Article', headline: 'E-Invoicing in the UAE' } }],
    images: [{ filename: 'e-invoicing-uae-hero.webp', alt_text: 'Hero card', caption: 'cap', purpose: 'hero', path: 'images/hero.webp', binary_key: 'image_1' }],
    author: { name: 'Sara Khan' },
    ladder: { ladder_id: 'lad_1', rung: 2, head_keyword: 'e invoicing in uae' },
    updated: '2026-10-17',
    publishable: true,
    ...meta,
  },
  ...over,
});
const cand = (p: Record<string, unknown>, siteDomain: string | null = 'techand.ai') => ({ stage: String(p.stage ?? 'content'), status: String(p.status ?? 'completed'), payload: p, siteDomain });

describe('cmsPage: the package every connector publishes', () => {
  it('reads title, slug, description, schema, images (alt from the plan) and the ladder', () => {
    const pg = cmsPage(page());
    expect(pg).toMatchObject({ title: 'E-Invoicing UAE: Deadlines and Phases', h1: 'E-Invoicing in the UAE', slug: 'e-invoicing-uae', metaDescription: 'Find your phase and deadline.', excerpt: 'Find your phase and deadline.', keyword: 'e invoicing uae', author: 'Sara Khan', domain: 'techand.ai', updated: '2026-10-17' });
    expect(pg.schema).toEqual([{ '@context': 'https://schema.org', '@type': 'Article', headline: 'E-Invoicing in the UAE' }]);
    expect(pg.images).toEqual([{ fileId: '11111111-1111-1111-1111-111111111111', fileName: 'e-invoicing-uae-hero.webp', mimeType: 'image/webp', alt: 'Hero card', caption: 'cap', purpose: 'hero', path: 'images/hero.webp' }]);
    expect(pg.ladder).toEqual({ id: 'lad_1', rung: 2, head: 'e invoicing in uae' });
  });
  it('makes a slug from the keyword when the package has none, and cleans a dirty one', () => {
    expect(cmsPage(page({}, { slug: '' })).slug).toBe('e-invoicing-uae');
    expect(slugify('  Ça Va / UAE 2026!! ')).toBe('ca-va-uae-2026');
  });
});

describe('findCmsPlaceholders', () => {
  it('counts Content QA’s brackets and the labelled ones it leaves for the owner', () => {
    const found = findCmsPlaceholders(['<p>From [Price] a month. [Confirm: AED 50m] threshold. [Owner: confirm — 3 offices]. [Author Name]. [Price]</p>']);
    expect(found).toEqual([
      { token: '[Price]', count: 2, kind: 'placeholder' },
      { token: '[Author Name]', count: 1, kind: 'placeholder' },
      { token: '[Confirm: AED 50m]', count: 1, kind: 'review_note' },
      { token: '[Owner: confirm — 3 offices]', count: 1, kind: 'review_note' },
    ]);
  });
  it('ignores Markdown links, numbered citations, scripts and styles', () => {
    expect(findCmsPlaceholders(['See [the FTA guide](https://tax.gov.ae/x) [1] [23]', '<script type="application/ld+json">{"a":"[Price]"}</script><style>a[href]{}</style>'])).toEqual([]);
  });
  it('finds placeholders in attributes (an alt text) too', () => {
    expect(findCmsPlaceholders(['<img alt="[Image: the team at work]">'])).toEqual([{ token: '[Image: the team at work]', count: 1, kind: 'review_note' }]);
  });
});

describe('cmsReadiness: the rule, which has no override', () => {
  it('a passed page may go as a draft and live', () => {
    const r = cmsReadiness(cand(page()));
    expect(r).toMatchObject({ draftAllowed: true, liveAllowed: true, blockers: [], qualityChecked: true, liveRefusal: '' });
  });

  it('a page that failed its quality check is blocked for both (the delivery rule, unchanged)', () => {
    const r = cmsReadiness(cand(page({ qa_not_ready: true, qa_publishable: false, qa_reasons: ['12 placeholders left', 'coverage 40% of 68%'] })));
    expect(r.draftAllowed).toBe(false);
    expect(r.liveAllowed).toBe(false);
    expect(r.blockers[0]).toMatchObject({ code: 'not_ready' });
    expect(r.blockers[0]!.message).toContain('12 placeholders left');
  });

  it('a rejected run, a refused or interim report, and a run that did not complete are blocked', () => {
    expect(cmsReadiness(cand(page({ status: 'rejected' }))).blockers.map((b) => b.code)).toContain('not_ready');
    expect(cmsReadiness(cand(page({ status: 'failed' }))).draftAllowed).toBe(false);
    expect(cmsReadiness(cand(page({ validation_error: 'bad keyword' }))).draftAllowed).toBe(false);
  });

  it('the package saying "not publishable" (the -DRAFT file) blocks it', () => {
    const r = cmsReadiness(cand(page({ qa_publishable: null, qa_summary: '' }, { publishable: false })));
    expect(r.blockers.map((b) => b.code)).toEqual(['not_publishable']);
  });

  it('a bracket left in the Markdown (the delivery rule’s A-13 hold) is one placeholder blocker with the list, not two blockers', () => {
    const r = cmsReadiness(cand(page({ markdown: '# E-Invoicing\n\nFees start at [Price band: typical fee in AED].' })));
    expect(r.blockers.map((b) => b.code)).toEqual(['placeholders']);
    expect(r.blockers[0]!.items).toEqual([{ token: '[Price band: typical fee in AED]', count: 1, kind: 'placeholder' }]);
  });

  it('a bracket in both the HTML and the Markdown of the same article is counted once per place, not twice', () => {
    const r = cmsReadiness(cand(page({ html: html + '<p>From [Price].</p>', markdown: '# X\n\nFrom [Price].' })));
    expect(r.blockers[0]!.items).toEqual([{ token: '[Price]', count: 1, kind: 'placeholder' }]);
  });

  it('placeholders block both, with the list', () => {
    const r = cmsReadiness(cand(page({ html: html + '<p>We have [Confirm: 120 clients] in the UAE, from [Price].</p>' })));
    expect(r.draftAllowed).toBe(false);
    const b = r.blockers.find((x) => x.code === 'placeholders')!;
    expect(b.items).toEqual([
      { token: '[Price]', count: 1, kind: 'placeholder' },
      { token: '[Confirm: 120 clients]', count: 1, kind: 'review_note' },
    ]);
    expect(b.message).toMatch(/^2 placeholders are still in the page/);
  });

  it('a placeholder in the title, description or author blocks it as well', () => {
    expect(cmsReadiness(cand(page({}, { meta_description: 'From [Price] a month' }))).draftAllowed).toBe(false);
    expect(cmsReadiness(cand(page({}, { author: { name: '[Author Name]', placeholder: true } }))).blockers.map((b) => b.code)).toEqual(['placeholders']);
  });

  it('quality never checked: a draft for review, never live', () => {
    const r = cmsReadiness(cand(page({ qa_publishable: null, qa_summary: '' }, { publishable: null })));
    expect(r).toMatchObject({ draftAllowed: true, liveAllowed: false, qualityChecked: false });
    expect(r.liveRefusal).toMatch(/only be sent as a draft/);
    expect(r.warnings[0]).toMatch(/quality check did not run/);
  });

  it('not a page, no website, another domain, no title', () => {
    expect(cmsReadiness(cand({ stage: 'keyword_strategy', status: 'completed' })).blockers.map((b) => b.code)).toContain('not_a_page');
    expect(cmsReadiness(cand(page({ html: '', markdown: '' }))).blockers.map((b) => b.code)).toEqual(['not_a_page']);
    expect(cmsReadiness(cand(page(), null)).blockers.map((b) => b.code)).toEqual(['no_website']);
    expect(cmsReadiness(cand(page(), 'other.com')).blockers.map((b) => b.code)).toEqual(['other_domain']);
    expect(cmsReadiness(cand(page({ keyword: '' }, { title: '', h1: '', slug: '', primary_keyword: '' }))).blockers.map((b) => b.code)).toEqual(['no_title', 'no_slug']);
  });

  it('warns when no image file came with the page', () => {
    expect(cmsReadiness(cand(page({ images: null }))).warnings).toContain('No image files came with this page: add the featured image in your CMS.');
  });
});

describe('cmsUrlOk (SSRF: what a customer may type as a CMS address)', () => {
  it.each(['https://blog.example.org', 'https://www.techand.ai/', 'https://cms.techand.ai:8443/wp'])('accepts %s', (u) => expect(cmsUrlOk(u)).toBe(true));
  it.each([
    'http://blog.example.org',
    'https://localhost',
    'https://127.0.0.1',
    'https://169.254.169.254/latest/meta-data/',
    'https://10.0.0.5',
    'https://[::1]/',
    'https://wp.internal',
    'https://user:pass@blog.example.org', // trufflehog:ignore (a refused-URL fixture, not a credential)
    'ftp://blog.example.org',
    'javascript:alert(1)',
    '',
  ])('refuses %s', (u) => expect(cmsUrlOk(u)).toBe(false));
  it('a developer may lift it for a local CMS', () => expect(cmsUrlOk('http://localhost:8080', { allowPrivate: true })).toBe(true));
});

describe('schemas', () => {
  it('WordPress: https address, user, application password (spaces normalised), defaults', () => {
    const v = cmsConnectionCreateSchema.parse({ kind: 'wordpress', baseUrl: 'https://blog.example.org/', username: 'editor', secret: 'abcd efgh  ijkl mnop' });
    expect(v).toMatchObject({ kind: 'wordpress', baseUrl: 'https://blog.example.org', secret: 'abcd efgh ijkl mnop', postType: 'posts', categories: [], tags: [], publicUrlTemplate: '' });
    expect(cmsConnectionCreateSchema.safeParse({ kind: 'wordpress', baseUrl: 'http://blog.example.org', username: 'a', secret: 'abcdefghij' }).success).toBe(false);
  });
  it('Webflow and Contentful ids, the address pattern needs {slug}', () => {
    expect(cmsConnectionCreateSchema.safeParse({ kind: 'webflow', secret: 'x'.repeat(40), collectionId: 'nope' }).success).toBe(false);
    expect(cmsConnectionCreateSchema.safeParse({ kind: 'webflow', secret: 'x'.repeat(40), collectionId: '643fd856d66b6528195ee2ca' }).success).toBe(true);
    expect(cmsConnectionCreateSchema.safeParse({ kind: 'contentful', secret: 'x'.repeat(40), spaceId: 'abc123xyz', contentTypeId: 'blogPost', publicUrlTemplate: 'https://x.com/blog/' }).success).toBe(false);
    expect(cmsConnectionCreateSchema.parse({ kind: 'contentful', secret: 'x'.repeat(40), spaceId: 'abc123xyz', contentTypeId: 'blogPost', publicUrlTemplate: 'https://{domain}/blog/{slug}' })).toMatchObject({ environment: 'master' });
  });
  it('an unknown kind or an unknown mapped field is refused', () => {
    expect(cmsConnectionCreateSchema.safeParse({ kind: 'drupal' }).success).toBe(false);
    expect(cmsConnectionUpdateSchema.safeParse({ fieldMap: { password: 'x' } }).success).toBe(false);
  });
  it('publish: draft by default, live needs its own tick', () => {
    expect(cmsPublishSchema.parse({ connectionId: '11111111-1111-4111-8111-111111111111' })).toEqual({ connectionId: '11111111-1111-4111-8111-111111111111', mode: 'draft', confirmLive: false });
  });
});

describe('fieldMapProblems', () => {
  const contentful: CmsRemoteField[] = [
    { id: 'title', name: 'Title', type: 'Symbol', required: true },
    { id: 'slug', name: 'Slug', type: 'Symbol', required: true },
    { id: 'body', name: 'Body', type: 'Text', required: false },
    { id: 'rich', name: 'Rich body', type: 'RichText', required: false },
    { id: 'hero', name: 'Hero', type: 'Link', required: false },
  ];
  it('a complete Contentful mapping is fine', () => expect(fieldMapProblems('contentful', { title: 'title', slug: 'slug', body_markdown: 'body' }, contentful)).toEqual([]));
  it('Rich Text, missing required, a gone field and a double use are named', () => {
    const p = fieldMapProblems('contentful', { title: 'title', body_html: 'rich', excerpt: 'gone', keyword: 'title' }, contentful);
    expect(p.join('\n')).toMatch(/Rich Text is a document model/);
    expect(p.join('\n')).toMatch(/Choose the field that holds the slug/);
    expect(p.join('\n')).toMatch(/"gone" is not in the content type/);
    expect(p.join('\n')).toMatch(/Title is mapped twice/);
    expect(p.join('\n')).toMatch(/Slug is required in your CMS/);
  });
  it('Webflow: name and slug are ours, the article needs a rich-text field', () => {
    const wf: CmsRemoteField[] = [
      { id: 'name', name: 'Name', type: 'PlainText', required: true },
      { id: 'slug', name: 'Slug', type: 'PlainText', required: true },
      { id: 'post-body', name: 'Post body', type: 'RichText', required: false },
      { id: 'thumb', name: 'Thumbnail', type: 'Image', required: false },
    ];
    expect(fieldMapProblems('webflow', { body_html: 'post-body' }, wf)).toEqual([]);
    expect(fieldMapProblems('webflow', {}, wf)).toEqual(['Choose the rich-text field that holds the article']);
    expect(fieldMapProblems('webflow', { body_html: 'post-body', excerpt: 'thumb', title: 'name' }, wf).length).toBe(2);
  });
  it('WordPress and webhooks map nothing', () => expect(fieldMapProblems('wordpress', {}, [])).toEqual([]));
});

describe('cmsPublicUrl', () => {
  const pg = { slug: 'e-invoicing-uae', suggestedUrl: 'https://techand.ai/e-invoicing-uae/' };
  it('uses the pattern, then the planned address on the domain, then /slug/', () => {
    expect(cmsPublicUrl('https://{domain}/blog/{slug}/', pg, 'techand.ai')).toBe('https://techand.ai/blog/e-invoicing-uae/');
    expect(cmsPublicUrl('', pg, 'techand.ai')).toBe('https://techand.ai/e-invoicing-uae/');
    expect(cmsPublicUrl('', { slug: 'x', suggestedUrl: '/guides/x/' }, 'techand.ai')).toBe('https://techand.ai/guides/x/');
    expect(cmsPublicUrl('', { slug: 'x', suggestedUrl: 'https://evil.com/x' }, 'techand.ai')).toBe('https://techand.ai/x/');
    expect(cmsPublicUrl('', pg, '')).toBe('');
  });
});

describe('cmsWebhookBody', () => {
  it('carries the whole package, the mode and the idempotency key, never a secret', () => {
    const pg = cmsPage(page());
    const b = cmsWebhookBody({ idempotencyKey: 'item-1', mode: 'draft', domain: 'techand.ai', page: pg, images: pg.images.map((i) => ({ ...i, data: 'AAAA' })), publicUrl: 'https://techand.ai/e-invoicing-uae/', report: { id: 'r1', url: 'https://app/r1' }, sentAt: '2026-10-17T10:00:00.000Z', sentBy: 'Sara' });
    expect(b).toMatchObject({ event: 'cms.publish', version: 1, idempotency_key: 'item-1', mode: 'draft', status: 'draft', website: 'techand.ai' });
    const p = b.page as Record<string, unknown>;
    expect(p.slug).toBe('e-invoicing-uae');
    expect((p.images as Record<string, unknown>[])[0]).toMatchObject({ file_name: 'e-invoicing-uae-hero.webp', alt: 'Hero card', data: 'AAAA' });
    expect(JSON.stringify(b)).not.toMatch(/secret|password|token/i);
  });
});
