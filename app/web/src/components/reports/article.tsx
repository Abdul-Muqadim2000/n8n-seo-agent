import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Download, Eye, FileCode, FileJson, FileText } from 'lucide-react';
import type { ReportFile } from '@seo/shared';
import { fileUrl } from '@/lib/api';
import { useOrgCtx } from '@/lib/context';
import { downloadText } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { buttonClass } from '@/components/ui/button';
import { Callout } from '@/components/ui/feedback';
import { CopyButton, ExternalLink, KeyValue } from '@/components/ui/misc';
import { Tab, TabList, TabPanel, Tabs } from '@/components/ui/tabs';
import { arr, Bullets, Chips, CodeBlock, Disclosure, Facts, has, JsonViewer, num, obj, objs, SectionTitle, str, strs, type P } from './kit';

// The generated article: a sandboxed preview (no scripts, no same-origin, no network except https images) with the raw HTML,
// Markdown and meta.json next to it. Placeholders the writer could not fill ([Author Name], [Price]) are highlighted and counted.

const TOKEN_NAMES = ['surface', 'surface-2', 'ink', 'ink-2', 'ink-3', 'line', 'accent-text', 'warning-soft', 'warning-text'] as const;
type Tokens = Record<(typeof TOKEN_NAMES)[number], string> & { dark: boolean };

function readTokens(): Tokens {
  const cs = getComputedStyle(document.documentElement);
  const t = Object.fromEntries(TOKEN_NAMES.map((k) => [k, cs.getPropertyValue(`--${k}`).trim()])) as Record<(typeof TOKEN_NAMES)[number], string>;
  return { ...t, dark: cs.getPropertyValue('color-scheme').trim() === 'dark' };
}

/** The app's colour tokens, re-read when the theme attribute or the OS colour scheme changes (the iframe cannot see CSS variables). */
function useThemeTokens(): Tokens {
  const [tokens, setTokens] = useState<Tokens>(readTokens);
  useEffect(() => {
    const update = () => setTokens(readTokens());
    const mo = new MutationObserver(update);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class', 'style'] });
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', update);
    return () => {
      mo.disconnect();
      mq.removeEventListener('change', update);
    };
  }, []);
  return tokens;
}

const PLACEHOLDER = /\[[A-Z][A-Za-z0-9 &/'’.,()-]{1,48}\]/g;

/** Counts [Placeholders] anywhere in the HTML (text and attributes). */
export function findPlaceholders(html: string): { token: string; count: number }[] {
  const m = new Map<string, number>();
  for (const x of html.match(PLACEHOLDER) ?? []) m.set(x, (m.get(x) ?? 0) + 1);
  return [...m.entries()].map(([token, count]) => ({ token, count })).sort((a, b) => b.count - a.count);
}

/** Parses the article inertly, drops anything executable, and wraps text placeholders in <mark>. */
function prepareBody(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('script, iframe, object, embed, link, meta, base').forEach((el) => el.remove());
  doc.querySelectorAll('*').forEach((el) => {
    for (const a of [...el.attributes]) if (/^on/i.test(a.name) || /^\s*javascript:/i.test(a.value)) el.removeAttribute(a.name);
  });
  // images planned but not uploaded yet (relative paths): a labelled placeholder instead of a broken image
  doc.querySelectorAll('img').forEach((img) => {
    const src = img.getAttribute('src') ?? '';
    if (/^(https:|data:)/i.test(src)) return;
    const name = (src.split('/').pop() || 'image').replace(/[<>&"']/g, '');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><rect width="100%" height="100%" fill="#8f8e88" fill-opacity="0.18"/><text x="50%" y="50%" fill="#8f8e88" font-family="system-ui,sans-serif" font-size="28" text-anchor="middle" dominant-baseline="middle">Image to upload: ${name}</text></svg>`;
    img.setAttribute('src', 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg));
    img.removeAttribute('srcset');
  });
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
  const texts: Text[] = [];
  while (walker.nextNode()) texts.push(walker.currentNode as Text);
  for (const t of texts) {
    const v = t.nodeValue ?? '';
    PLACEHOLDER.lastIndex = 0;
    if (!PLACEHOLDER.test(v)) continue;
    const frag = doc.createDocumentFragment();
    let last = 0;
    v.replace(PLACEHOLDER, (match, offset: number) => {
      if (offset > last) frag.appendChild(doc.createTextNode(v.slice(last, offset)));
      const mark = doc.createElement('mark');
      mark.className = 'ph';
      mark.textContent = match;
      frag.appendChild(mark);
      last = offset + match.length;
      return match;
    });
    if (last < v.length) frag.appendChild(doc.createTextNode(v.slice(last)));
    t.parentNode?.replaceChild(frag, t);
  }
  return doc.body.innerHTML;
}

function srcDoc(body: string, t: Tokens): string {
  const css = `
:root{color-scheme:${t.dark ? 'dark' : 'light'}}
*{box-sizing:border-box}
body{margin:0;background:${t.surface};color:${t.ink};font:16px/1.65 system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;-webkit-font-smoothing:antialiased}
main{max-width:740px;margin:0 auto;padding:32px 24px 72px}
h1{font-size:1.9rem;line-height:1.25;margin:0 0 .6em;letter-spacing:-.01em}
h2{font-size:1.4rem;line-height:1.3;margin:2em 0 .6em}
h3{font-size:1.15rem;line-height:1.35;margin:1.6em 0 .5em}
h4{font-size:1rem;margin:1.4em 0 .4em}
p,li,dd{color:${t['ink-2']}}
strong{color:${t.ink}}
a{color:${t['accent-text']};text-underline-offset:2px}
ul,ol{padding-left:1.4em}
li{margin:.3em 0}
img{display:block;max-width:100%;height:auto;background:${t['surface-2']};border-radius:8px;color:${t['ink-3']};font-size:.85rem}
figure{margin:1.6em 0}
figcaption{font-size:.85rem;color:${t['ink-3']};margin-top:.5em}
table{border-collapse:collapse;width:100%;margin:1.2em 0;font-size:.92rem;display:block;overflow-x:auto}
th,td{border:1px solid ${t.line};padding:.5em .7em;text-align:left;vertical-align:top}
th{background:${t['surface-2']};color:${t.ink}}
blockquote{margin:1.4em 0;padding:.3em 1.1em;border-left:3px solid ${t.line};color:${t['ink-2']}}
nav,aside,.toc,.author-box,.snapshot{background:${t['surface-2']};border-radius:10px;padding:12px 18px;margin:1.4em 0}
nav ul,nav ol{margin:.4em 0}
code{font-family:ui-monospace,"SF Mono",Menlo,monospace;font-size:.88em;background:${t['surface-2']};padding:.1em .35em;border-radius:4px}
pre{background:${t['surface-2']};padding:12px;border-radius:8px;overflow:auto}
pre code{background:none;padding:0}
hr{border:0;border-top:1px solid ${t.line};margin:2em 0}
details{border:1px solid ${t.line};border-radius:8px;padding:.6em 1em;margin:.6em 0}
summary{cursor:pointer;font-weight:600;color:${t.ink}}
.byline,time{font-size:.9rem;color:${t['ink-3']}}
mark.ph{background:${t['warning-soft']};color:${t['warning-text']};border-radius:4px;padding:0 .25em;font-weight:600}
`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src https: data:"><style>${css}</style></head><body><main>${body}</main></body></html>`;
}

function DownloadFor({ file, fallback }: { file: ReportFile | null; fallback: { name: string; text: string; mime: string } }) {
  const { org } = useOrgCtx();
  if (file)
    return (
      <a href={fileUrl(org.id, file.id, true)} download={file.fileName} className={buttonClass('secondary', 'sm')}>
        <Download className="size-3.5" aria-hidden />
        Download
      </a>
    );
  return (
    <button type="button" onClick={() => downloadText(fallback.name, fallback.text, fallback.mime)} className={buttonClass('secondary', 'sm')}>
      <Download className="size-3.5" aria-hidden />
      Download
    </button>
  );
}

export function ArticleViewer({ html, markdown, meta, files, slug }: { html: string; markdown: string; meta: P; files: ReportFile[]; slug: string }) {
  const tokens = useThemeTokens();
  const body = useMemo(() => prepareBody(html), [html]);
  const doc = useMemo(() => srcDoc(body, tokens), [body, tokens]);
  const placeholders = useMemo(() => findPlaceholders(`${html}\n${JSON.stringify(meta)}`), [html, meta]);
  const metaText = useMemo(() => JSON.stringify(meta, null, 2), [meta]);
  const fileFor = (field: string) => files.find((f) => f.field === field) ?? null;
  const [tab, setTab] = useState('preview');

  return (
    <div>
      {placeholders.length > 0 && (
        <Callout tone="warning" title={`${placeholders.reduce((s, p) => s + p.count, 0)} placeholders to fill in before publishing`} className="mb-4">
          <span className="mb-1.5 block">The writer leaves a placeholder wherever a fact was not verified or not on file. Replace each one (the preview highlights them).</span>
          <span className="flex flex-wrap gap-1.5">
            {placeholders.slice(0, 12).map((p) => (
              <Badge key={p.token} tone="warning">
                {p.token} {p.count > 1 && <span className="tabular">×{p.count}</span>}
              </Badge>
            ))}
          </span>
        </Callout>
      )}
      <Tabs value={tab} onValueChange={setTab}>
        <TabList>
          <Tab value="preview">
            <Eye className="size-4" aria-hidden /> Preview
          </Tab>
          <Tab value="html">
            <FileCode className="size-4" aria-hidden /> HTML
          </Tab>
          {markdown && (
            <Tab value="markdown">
              <FileText className="size-4" aria-hidden /> Markdown
            </Tab>
          )}
          {has(meta) && (
            <Tab value="meta">
              <FileJson className="size-4" aria-hidden /> Meta
            </Tab>
          )}
        </TabList>
        <TabPanel value="preview">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[13px] text-ink-3">Rendered in a locked-down frame: images appear once you upload them under the planned file names.</p>
            <div className="flex gap-2">
              <CopyButton text={html} label="Copy HTML" />
              <DownloadFor file={fileFor('html')} fallback={{ name: `${slug}.html`, text: html, mime: 'text/html' }} />
            </div>
          </div>
          <iframe title="Article preview" sandbox="" srcDoc={doc} className="h-[72vh] min-h-[480px] w-full rounded-xl border border-line bg-surface" />
        </TabPanel>
        <TabPanel value="html">
          <div className="mb-3 flex justify-end gap-2">
            <DownloadFor file={fileFor('html')} fallback={{ name: `${slug}.html`, text: html, mime: 'text/html' }} />
          </div>
          <CodeBlock text={html} maxHeight="max-h-[70vh]" />
        </TabPanel>
        {markdown && (
          <TabPanel value="markdown">
            <div className="mb-3 flex justify-end gap-2">
              <DownloadFor file={fileFor('markdown')} fallback={{ name: `${slug}.md`, text: markdown, mime: 'text/markdown' }} />
            </div>
            <CodeBlock text={markdown} maxHeight="max-h-[70vh]" />
          </TabPanel>
        )}
        {has(meta) && (
          <TabPanel value="meta">
            <div className="mb-3 flex justify-end gap-2">
              <CopyButton text={metaText} label="Copy meta.json" />
              <DownloadFor file={fileFor('meta')} fallback={{ name: `${slug}.meta.json`, text: metaText, mime: 'application/json' }} />
            </div>
            <MetaPanel meta={meta} />
          </TabPanel>
        )}
      </Tabs>
    </div>
  );
}

const lengthHint = (len: number | null, min: number, max: number) => {
  if (len == null) return null;
  const ok = len >= min && len <= max;
  return (
    <span className={ok ? 'text-good-text' : 'text-warning-text'}>
      {len} characters {ok ? '' : `(aim for ${min}-${max})`}
    </span>
  );
};

/** meta.json laid out for a person: what goes where when publishing. */
export function MetaPanel({ meta }: { meta: P }) {
  const headings = objs(meta.headings);
  const internal = objs(meta.internal_links);
  const external = objs(meta.external_links);
  const images = objs(meta.images);
  const schema = objs(meta.schema_blocks);
  const og = obj(meta.open_graph);
  const author = obj(meta.author);
  const checklist = strs(meta.publish_checklist);
  const notes = strs(meta.eeat_notes);

  return (
    <div className="space-y-6">
      {notes.length > 0 && (
        <Callout tone="warning" title="Experience and trust (E-E-A-T)">
          <Bullets items={notes} />
        </Callout>
      )}
      <KeyValue
        items={[
          { label: 'Title tag', value: <>{str(meta.title) || '–'} <span className="block text-xs">{lengthHint(num(meta.title_length) ?? (str(meta.title).length || null), 30, 60)}</span></> },
          { label: 'Main heading (H1)', value: str(meta.h1) || '–' },
          { label: 'Meta description', value: <>{str(meta.meta_description) || '–'} <span className="block text-xs">{lengthHint(num(meta.meta_description_length) ?? (str(meta.meta_description).length || null), 120, 160)}</span></> },
          { label: 'URL slug', value: <code className="text-[13px]">{str(meta.slug) || '–'}</code> },
          ...(str(meta.suggested_url) ? [{ label: 'Suggested URL', value: <ExternalLink href={str(meta.suggested_url)} /> }] : []),
          { label: 'Primary keyword', value: str(meta.primary_keyword) || '–' },
          { label: 'Page type', value: str(meta.page_type) || '–' },
          ...(str(author.name) ? [{ label: 'Author', value: <>{str(author.name)} {author.placeholder === true && <Badge tone="warning" className="ml-1">placeholder</Badge>}</> }] : []),
          ...(str(meta.updated) ? [{ label: 'Updated', value: str(meta.updated) }] : []),
        ]}
      />
      <Facts
        cols="sm:grid-cols-4"
        items={[
          { label: 'Words', value: num(meta.word_count)?.toLocaleString() ?? null },
          { label: 'Content score', value: num(meta.content_score) != null ? `${num(meta.content_score)}/100` : null },
          { label: 'Internal links', value: internal.length || null },
          { label: 'Sources cited', value: external.length || null },
        ]}
      />
      {checklist.length > 0 && (
        <div>
          <SectionTitle>Publishing checklist</SectionTitle>
          <ol className="space-y-1.5">
            {checklist.map((c, i) => (
              <li key={i} className="flex gap-2.5 text-sm text-ink-2">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-surface-2 text-xs font-medium tabular text-ink-2">{i + 1}</span>
                <span>{c}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
      {headings.length > 0 && (
        <div>
          <SectionTitle>Outline</SectionTitle>
          <ul className="space-y-1 text-sm">
            {headings.map((h, i) => (
              <li key={i} className="text-ink-2" style={{ paddingLeft: `${Math.max(0, (num(h.level) ?? 2) - 2) * 16}px` }}>
                <span className="mr-2 font-mono text-xs text-ink-3">H{num(h.level) ?? 2}</span>
                {str(h.text)}
              </li>
            ))}
          </ul>
        </div>
      )}
      {internal.length > 0 && (
        <div>
          <SectionTitle>Internal links in the article</SectionTitle>
          <ul className="space-y-1.5 text-sm">
            {internal.map((l, i) => (
              <li key={i} className="min-w-0">
                <span className="text-ink">{str(l.text)}</span> <span className="text-ink-3">→</span> <ExternalLink href={str(l.url)} className="text-[13px]" />
              </li>
            ))}
          </ul>
        </div>
      )}
      {images.length > 0 && (
        <div>
          <SectionTitle>Image plan</SectionTitle>
          <div className="grid gap-3 md:grid-cols-3">
            {images.map((im, i) => (
              <div key={i} className="rounded-lg border border-line p-3 text-[13px]">
                <div className="mb-1.5 flex items-center gap-2">
                  <Badge tone="accent">{str(im.purpose) || `Image ${i + 1}`}</Badge>
                  {num(im.width) != null && (
                    <span className="text-xs tabular text-ink-3">
                      {num(im.width)}×{num(im.height)} · ≤{num(im.max_kb)} KB
                    </span>
                  )}
                </div>
                <p className="font-mono text-xs break-all text-ink">{str(im.filename)}</p>
                <p className="mt-1.5 text-ink-2">
                  <span className="text-ink-3">Alt:</span> {str(im.alt_text)}
                </p>
                {str(im.subject) && <p className="mt-1 text-ink-3">{str(im.subject)}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
      {has(og) && (
        <div>
          <SectionTitle>Social sharing (Open Graph)</SectionTitle>
          <KeyValue items={Object.entries(og).map(([k, v]) => ({ label: <code className="text-xs">{k}</code>, value: str(v) }))} />
        </div>
      )}
      {schema.length > 0 && (
        <div>
          <SectionTitle>Structured data (JSON-LD)</SectionTitle>
          <div className="space-y-2">
            {schema.map((s, i) => (
              <Disclosure key={i} title={str(s.type) || `Block ${i + 1}`} meta="paste into the page head">
                <CodeBlock text={`<script type="application/ld+json">\n${JSON.stringify(s.json ?? s, null, 2)}\n</script>`} />
              </Disclosure>
            ))}
          </div>
        </div>
      )}
      {external.length > 0 && (
        <Disclosure title="Sources cited in the article" meta={`${external.length}`}>
          <ul className="space-y-1 text-[13px]">
            {external.map((l, i) => (
              <li key={i}>
                <ExternalLink href={str(l.url)} /> {str(l.text) && str(l.text) !== 'source' && <span className="text-ink-3">· {str(l.text)}</span>}
              </li>
            ))}
          </ul>
        </Disclosure>
      )}
      {arr(meta.secondary_keywords).length > 0 && (
        <div>
          <SectionTitle>Secondary keywords used</SectionTitle>
          <Chips items={strs(meta.secondary_keywords)} />
        </div>
      )}
      <JsonViewer value={meta} title="meta.json" />
      {placeholdersInMeta(meta) && (
        <p className="flex items-center gap-1.5 text-xs text-warning-text">
          <AlertTriangle className="size-3.5" aria-hidden /> The schema and meta also carry placeholders: replace them before publishing.
        </p>
      )}
    </div>
  );
}

const placeholdersInMeta = (meta: P) => findPlaceholders(JSON.stringify(meta)).length > 0;
