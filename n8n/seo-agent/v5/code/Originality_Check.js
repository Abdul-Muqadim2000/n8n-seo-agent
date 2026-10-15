/*__SHINGLE__*/
/*__SITE_MODEL__*/
// Originality check (FIX_PLAN G5, 2026-10-13). Runs between *Content QA* and *Needs Revision?*, so a draft that repeats someone else's
// words -- or our own page's -- never reaches the customer: the quality check fails, the editor is sent in with the passage named, and the
// report says against which page and by how much.
// It compares the finished draft with the texts this run already fetched, so it costs nothing and calls nothing:
//   * the competitor pages the brief was written from (*Analyze Competitor Pages*, up to 9,000 characters each);
//   * the site's own pages this run read (*Collect Client Pages*: the existing page on the topic, the homepage, one related page -- the
//     inventory page that matches the keyword is read as the "existing" page, P2-5);
//   * the rest of the page inventory (D11 / SM.pages) by title and slug only -- no text of them is in hand, and fetching a whole site to
//     check one draft would cost more than it is worth. A near-identical target is reported as a duplicate target, not as overlap.
// Measure: the share of the draft's 8-word windows that a single page also carries (SHG). The page being improved is the exception: a
// rewrite is supposed to keep that page's text, so its overlap is reported and never counted as a failure.
const item = $input.first();
const d = item.json || {};
const qa = { ...(d.content_qa || {}) };
const warnings = Array.isArray(qa.warnings) ? [...qa.warnings] : [];

const S = (v) => String(v == null ? '' : v);
const bare = (u) => { const m = S(u).trim().match(/^https?:\/\/(?:[^@\/?#]*@)?([^\/?#:]+)/i); return m ? m[1].toLowerCase().replace(/^www\./, '') : ''; };
const keyOf = (u) => S(u).toLowerCase().replace(/[#?].*$/, '').replace(/\/+$/, '');
const THRESHOLD = (() => { const n = Number(d.originality_max_overlap_pct); return n > 0 && n <= 100 ? n : 15; })();

// ---- the draft, without the meta lines and the generated schema ----
const draftMd = S(d.output || d.page_markdown)
  .replace(/^(Title|Meta Description|Slug|Primary Keyword|Secondary Keywords|Production Brief):.*$/gim, '')
  .replace(/<script[\s\S]*?<\/script>/gi, '');
const draftShingles = SHG.shingles(draftMd);
const draftWords = SHG.words(draftMd).length;

// ---- the sources this run already has ----
const sources = [];
let competitors = [];
try { competitors = ($('Analyze Competitor Pages').first().json || {}).competitors || []; } catch (e) { competitors = []; }
if (!competitors.length && Array.isArray(d.competitors)) competitors = d.competitors;
const MIN_WORDS = 40;   // below this a page has no passage worth comparing; the 8-word window needs real sentences
for (const c of competitors) {
  const text = S(c && (c.content_full || c.content));
  if (text.split(/\s+/).filter(Boolean).length < MIN_WORDS) continue;
  sources.push({ kind: 'competitor', label: S(c.domain) || bare(c.url), url: S(c.url), rank: Number(c.rank) || null, text });
}
let clientPages = [];
try { clientPages = ($('Collect Client Pages').first().json || {}).client_pages || []; } catch (e) { clientPages = []; }
if (!clientPages.length && Array.isArray(d.client_pages)) clientPages = d.client_pages;
const improving = keyOf((d.existing_page && d.existing_page.url) || d.existing_page_url || '');
for (const p of clientPages) {
  const text = S(p && p.text);
  if (text.split(/\s+/).filter(Boolean).length < MIN_WORDS) continue;
  const isImproved = S(p.kind) === 'existing' || (!!improving && keyOf(p.url) === improving);
  sources.push({ kind: isImproved ? 'improved' : 'own', label: S(p.url) || S(p.kind), url: S(p.url), rank: null, text });
}

// ---- overlap per source ----
const sets = sources.map(s => SHG.setOf(s.text));
const commonSet = SHG.common(sets, 3);   // phrasing most of the pages use: reported, never counted as copying from one page
const measured = sources.map((s, i) => {
  const r = SHG.compare(draftShingles, null, { sourceSet: sets[i], passages: 2 });
  const commonHits = draftShingles.filter(sh => sets[i].has(sh) && commonSet.has(sh)).length;
  return { source: s.label, url: s.url, kind: s.kind, rank: s.rank, overlap_pct: r.overlap_pct, matched_windows: r.matched,
    common_windows: commonHits, longest_passage_words: r.longest_words, passages: r.passages };
}).sort((a, b) => b.overlap_pct - a.overlap_pct);

// ---- the rest of the inventory: a page aimed at the same search, checked by title and slug (no text of it in hand) ----
let MODEL = null;
try { MODEL = $('Site Model').first().json.site_model || null; } catch (e) {}
if (!MODEL && d.site_model && typeof d.site_model === 'object') MODEL = d.site_model;
const kwToks = new Set(SHG.words(d.keyword).filter(w => w.length > 2));
const readKeys = new Set(sources.map(s => keyOf(s.url)).filter(Boolean));
const duplicate_targets = [];
if (MODEL && kwToks.size) {
  for (const p of SM.pages(MODEL)) {
    const k = keyOf(p.url); if (!k || readKeys.has(k) || k === improving) continue;
    const toks = new Set(SHG.words(S(p.title) + ' ' + S(p.h1) + ' ' + S(p.url).replace(/[-_/]+/g, ' ')).filter(w => w.length > 2));
    if (!toks.size) continue;
    let hit = 0; for (const t of kwToks) if (toks.has(t)) hit++;
    const share = Math.round((hit / kwToks.size) * 100);
    if (share >= 75) duplicate_targets.push({ url: S(p.url), title: S(p.title), keyword_words_shared_pct: share });
    if (duplicate_targets.length >= 3) break;
  }
}

const worst = measured.filter(m => m.kind !== 'improved')[0] || null;
const failing = worst && worst.overlap_pct > THRESHOLD ? worst : null;
const improved = measured.find(m => m.kind === 'improved') || null;
const originality = {
  threshold_pct: THRESHOLD,
  window_words: SHG.N,
  draft_words: draftWords,
  draft_windows: draftShingles.length,
  pages_compared: measured.length,
  competitor_pages: sources.filter(s => s.kind === 'competitor').length,
  own_pages: sources.filter(s => s.kind !== 'competitor').length,
  inventory_pages_by_title: duplicate_targets.length,
  top_overlaps: measured.slice(0, 5),
  highest_pct: worst ? worst.overlap_pct : null,
  highest_source: worst ? worst.source : null,
  improved_page: improved ? { source: improved.source, overlap_pct: improved.overlap_pct } : null,
  duplicate_targets,
  passed: !failing,
  basis: measured.length
    ? 'the share of the draft\'s ' + SHG.N + '-word windows found on one page, measured against ' + measured.length + ' page(s) this run read ('
      + sources.filter(s => s.kind === 'competitor').length + ' competitor, ' + sources.filter(s => s.kind !== 'competitor').length + ' of this site)'
    : 'no page text was available in this run, so nothing could be compared'
};
if (!measured.length) originality.passed = null;   // unknown is not a pass: the report says it could not be checked

// ---- what the editor and the customer are told ----
if (failing) {
  const p = failing.passages[0];
  const who = failing.kind === 'competitor' ? 'the competitor page ' + failing.source : 'this site\'s own page ' + failing.source;
  warnings.push('Originality: ' + failing.overlap_pct + '% of this draft is word for word the same as ' + who
    + ' (limit ' + THRESHOLD + '%; longest identical run ' + failing.longest_passage_words + ' words'
    + (p ? ': "' + p.text + '"' : '') + ') — rewrite those passages in our own words and from our own angle'
    + (failing.kind === 'competitor' ? '; never reuse a competitor\'s sentences, lists or table rows.'
      : '; two pages of the same site with the same text compete with each other — either make this page clearly different or improve that page instead.'));
}
for (const m of measured.filter(x => x.kind !== 'improved' && x !== failing && x.overlap_pct > THRESHOLD * 0.67).slice(0, 2)) {
  warnings.push('Originality: ' + m.overlap_pct + '% of this draft also appears on ' + m.source + ' (under the ' + THRESHOLD + '% limit, worth a read before publishing)');
}
if (duplicate_targets.length) {
  warnings.push('This site already has a page aimed at the same search: ' + duplicate_targets.map(x => x.url).join(', ')
    + ' — improve that page instead of publishing a second one, or make clear in the brief how this page is different (its text could not be compared: it was not read in this run)');
}

qa.originality = originality;
qa.warnings = warnings;
if (failing) {
  qa.passed = false;
  qa.passed_copy = false;
  qa.editor_needed = true;
  // B3-3 (2026-10-15, benchmark area 3): *Content QA* finalises the delivery gate -- `quality`, `not_ready`, `quality_label`,
  // `publishable`, the reasons -- and this node runs AFTER it, so flipping `passed` alone left every one of them saying the opposite.
  // Proven on the node code: a draft 100% identical to a competitor page, failing on the last round, came out of here with
  // `publishable: true`, `not_ready: false` and `quality.label: "passed the quality check"`. Those fields are what the Word file's
  // status line, the `-DRAFT` file name, the package's "DID NOT PASS" banner, meta.json, the callback and the app all read, so a
  // plagiarised page was delivered labelled as having passed. A gate that fails has to refuse; it must never only be a label.
  const roundsLeft = Math.max(0, Number(qa.rounds_left) || 0);
  const whose = failing.kind === 'competitor' ? 'the competitor page ' : 'this site\'s own page ';
  const reason = 'it repeats ' + failing.overlap_pct + '% of ' + whose + failing.source + ' word for word (the limit is ' + THRESHOLD + '%)';
  qa.publishable = false;
  qa.not_ready = !roundsLeft;
  qa.quality_label = roundsLeft ? 'needs another editing round before it can be published'
    : 'did not pass the quality check — not ready to publish';
  qa.not_ready_reasons = !roundsLeft
    ? [reason, ...(Array.isArray(qa.not_ready_reasons) ? qa.not_ready_reasons : [])].filter((x, i, a) => x && a.indexOf(x) === i).slice(0, 6)
    : (Array.isArray(qa.not_ready_reasons) ? qa.not_ready_reasons : []);
  qa.quality = { ...(qa.quality && typeof qa.quality === 'object' ? qa.quality : {}),
    passed: false, publishable: false, not_ready: qa.not_ready, label: qa.quality_label, reasons: qa.not_ready_reasons,
    note: roundsLeft ? '' : 'The editor had ' + (Number(qa.max_rounds) || 1) + ' round(s) and the page still repeats another page word for word: it is delivered as a draft to finish by hand, not as a page to publish as it is.' };
}
return [{ json: { ...d, content_qa: qa } }];
