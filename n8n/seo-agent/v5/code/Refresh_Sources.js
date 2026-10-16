// B3-8 (2026-10-16): the live page's cited sources as they read TODAY, for Content QA's figure check (§2b / §9c). Reached either from
// *Fetch Refresh Sources* (a refresh with sources to re-read) or straight from the IF (nothing to re-read: the plan's one skip item).
// It hands on *Parse Critique*'s item untouched — Content QA reads its draft and the critique from `$input` — and carries the re-read
// texts as `refresh_sources`, which Content QA reads by name on every QA round.
const CONFIG = { text_cap: 40000, live_cap: 30000 };
const S = (v) => String(v == null ? '' : v);
let plan = [];
try { plan = $('Refresh Source Plan').all().map(i => i.json || {}); } catch (e) { plan = []; }
const p0 = plan[0] || {};
let fetched = [];
if (plan.length && !p0.skip) { try { fetched = $('Fetch Refresh Sources').all().map(i => i.json || {}); } catch (e) { fetched = []; } }
const clean = (t) => S(t).replace(/^(Title|URL Source|Published Time|Markdown Content):.*$/gm, '').replace(/!\[[^\]]*\]\([^)]*\)/g, ' ').trim();
const BLOCKED = /just a moment|access denied|captcha|attention required|enable javascript/i;
const sources = (p0.skip ? [] : plan).map((p, i) => {
  const r = fetched[i] || {};
  const text = r.error ? '' : clean(r.page_text != null ? r.page_text : (r.data != null ? r.data : r.body));
  const err = r.error ? S(r.error.message || r.error).slice(0, 160)
    : !text ? 'no answer from the reader'
      : text.length < 200 ? 'the page came back almost empty'
        : BLOCKED.test(text.slice(0, 600)) ? 'the site refused the reader (bot wall)' : '';
  return { url: S(p.url), host: S(p.host), tier: S(p.tier), ok: !err, error: err, chars: text.length, cut: text.length > CONFIG.text_cap, text: err ? '' : text.slice(0, CONFIG.text_cap) };
});
// the live page's markdown with its links, for the §9c check (the same Jina answer the plan read)
let live = '';
if (p0.live_read) {
  try {
    const reqs = $('Client Page Requests').all().map(i => i.json || {}); const reads = $('Read Client Pages').all().map(i => i.json || {});
    let idx = reqs.findIndex(r => r && r.kind === 'existing' && S(r.url).replace(/\/+$/, '').toLowerCase() === S(p0.page_url).replace(/\/+$/, '').toLowerCase());
    if (idx < 0) idx = reqs.findIndex(r => r && r.kind === 'existing');
    live = idx >= 0 && reads[idx] ? clean(reads[idx].page_text || reads[idx].data).slice(0, CONFIG.live_cap) : '';
  } catch (e) { live = ''; }
}
const refresh_sources = { refresh: !!p0.refresh, page_url: S(p0.page_url), live_read: !!p0.live_read, cited: Number(p0.cited) || sources.length,
  reason: p0.skip ? S(p0.reason) : '', sources, live_markdown: live };
let base = {};
try { base = $('Parse Critique').first().json || {}; } catch (e) { base = {}; }
return [{ json: { ...base, refresh_sources } }];
