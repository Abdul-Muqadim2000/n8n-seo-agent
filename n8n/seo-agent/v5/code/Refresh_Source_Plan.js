/*__SOURCES__*/
// B3-8 (2026-10-16, benchmark area 3 row B3-8, with area 4's refresh path): a refresh re-checks the facts.
// The cadence's decay path (and every run that improves a live page through `existing_page_url`) rewrites a page on top of its live
// version. Content QA's figure check (§9b) looks a figure up only in a source the run READ, and the run never read the sources the live
// page itself cites — so every figure the page carried over with its old citation went through unchecked ("the source was never
// fetched: nothing to look the figure up in"). C3 at 10 asks for every claim to be re-checked at refresh.
// This node finds the external sources the live page cites NEXT TO A FIGURE (a link with no figure in its sentence vouches for nothing
// the check could test) and hands them to *Fetch Refresh Sources* (Jina Reader, the reader the competitor pages use). Not a refresh, or
// the live page was not read, or it cites nothing next to a figure: one `{ skip: true }` item, so the IF routes around the fetch.
const CONFIG = { max_sources: 8 };
const prev = $('Parse Brief').first().json || {};
const S = (v) => String(v == null ? '' : v);
const bare = (h) => S(h).toLowerCase().replace(/^www\./, '');
const domain = bare(prev.domain);
const exp = (prev.existing_page && prev.existing_page.url) ? S(prev.existing_page.url) : S(prev.existing_page_url);
const skip = (reason, extra) => [{ json: { skip: true, url: '', refresh: !!exp, page_url: exp, reason, ...(extra || {}) } }];
if (!exp) return skip('not a refresh: no live page is being improved in this run');

// the live page's own Jina answer (links kept) — the request list and the reads are aligned by position, as Collect Client Pages reads them
let reqs = [], reads = [];
try { reqs = $('Client Page Requests').all().map(i => i.json || {}); } catch (e) { reqs = []; }
try { reads = $('Read Client Pages').all().map(i => i.json || {}); } catch (e) { reads = []; }
const keyOf = (u) => SRC.key(u);
let idx = reqs.findIndex(r => r && r.kind === 'existing' && keyOf(r.url) === keyOf(exp));
if (idx < 0) idx = reqs.findIndex(r => r && r.kind === 'existing');
const raw = idx >= 0 && reads[idx] && !reads[idx].error ? S(reads[idx].page_text || reads[idx].data) : '';
if (raw.replace(/\s+/g, ' ').trim().length < 200) return skip('the live page could not be read in this run, so its cited sources are unknown', { live_read: false });

// external links that sit in a sentence carrying a figure (the same sentence rule as §9b: a full stop between digits is a decimal point)
const isBreak = (t, i) => { const c = t[i]; if (c === '\n' || c === '|' || c === '!' || c === '?') return true; if (c !== '.') return false; return !(/\d/.test(t[i - 1] || '') && /\d/.test(t[i + 1] || '')); };
const bounds = (t, at, len) => { let a = at, b = at + len; while (a > 0 && !isBreak(t, a - 1)) a--; while (b < t.length && !isBreak(t, b)) b++; return [a, b]; };
const SOCIAL = /(^|\.)(linkedin\.com|twitter\.com|x\.com|facebook\.com|instagram\.com|youtube\.com|youtu\.be|tiktok\.com|wa\.me|whatsapp\.com|t\.me|pinterest\.com)$/i;
const seen = new Set(); const picked = []; let cited = 0;
for (const m of raw.matchAll(/(!?)\[[^\[\]]*\]\((https?:\/\/[^)\s]+)\)/g)) {
  if (m[1]) continue;   // an image is not a citation
  const url = SRC.clean(m[2]); const h = SRC.host(url);
  if (SRC.isRedirect(url)) continue;   // FU-SV: an opaque search-engine redirect is not a source we can re-read (Content QA unlinks it)
  if (!h || (domain && (h === domain || h.endsWith('.' + domain))) || SOCIAL.test(h)) continue;
  const [a, b] = bounds(raw, m.index, m[0].length);
  const body = raw.slice(a, b).replace(/\[[^\[\]]*\]\([^)]*\)/g, (x) => ' '.repeat(x.length));
  if (!SRC.figures(body).some(f => !f.year)) continue;   // nothing in this sentence the check could test
  const k = keyOf(url); if (!k || seen.has(k)) continue; seen.add(k); cited++;
  if (picked.length < CONFIG.max_sources) picked.push({ url, host: h, tier: SRC.tier(url) });
}
if (!picked.length) return skip('the live page cites no external source next to a figure', { live_read: true, cited: 0 });
return picked.map((p, i) => ({ json: { skip: false, url: p.url, host: p.host, tier: p.tier, index: i, refresh: true, page_url: exp, live_read: true, cited } }));
