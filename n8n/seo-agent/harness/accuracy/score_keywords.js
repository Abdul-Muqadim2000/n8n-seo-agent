// KW-ACC (2026-10-21): the keyword business-fit scorer: runs the labelled set in keywords.json through the real generated code and
// scores the decision (in / out) and the reason class against the human label. Offline: no network, no paid API.
//
// Two paths, because the same keyword must get the same answer on every path:
//   kit : the generated fit-gate kit (code_v4/_fit_gate.js, the shim of the code every keyword node inlines: Rank Keywords, Ladder Pool /
//          Ladder Plan, Cadence Plan, Growth Plan, Keyword Check). Context per site as the callers build it (own domain, declared
//          competitors, rivals on the results page, brand names AI uses, the services / business as protected words and topics) plus,
//          when a case carries its real results page (`serp`), the page's top domains and questions (ctx.serp / ctx.career), as the Keyword
//          Check, the ladder head and the cadence pass them.
//   full: the full report's generated *Analyze Keywords* node (its gate wrapper included): every case keyword is a rival's keyword at
//          position 4 that this site does not rank for, and the decision is whether the node lists it in `site_keywords.refused`.
//          This path reads no results page per keyword, so a case whose label needs one is judged here without it.
//
// Scored per path: precision and recall for "out" (refusals) and for "in", reason-class agreement over correct refusals, and the
// list of disagreements (`failures`: kind decision | reason | no_reason). Used by scenario KWACC (scenarios_kw_accuracy.js), which
// ratchets on KEYWORDS_BASELINE.md (its first sections are the doc of this set).
//
// Report mode (prints every case with its decision):
//   docker run --rm -v "$PWD/n8n/seo-agent/harness":/src:ro --entrypoint sh n8nio/n8n:2.41.4 -c \
//     'cp -r /src /tmp/h && cd /tmp/h && CODE_DIR=/tmp/h/code_v4 OUT_DIR=/tmp/h/out node accuracy/score_keywords.js'
const fs = require('fs');
const path = require('path');
const SET = JSON.parse(fs.readFileSync(path.join(__dirname, 'keywords.json'), 'utf8'));

// the gate's reason words -> the label classes. The gate has no class of its own for a place: "uae" is refused as 'too broad' with a
// detail naming place words, so place_only agrees with too_broad (KEYWORDS_BASELINE.md).
const CLASS_OF = { 'other brand': 'other_brand', 'own brand': 'navigational', navigational: 'navigational', portal: 'navigational', government: 'government',
  'job search': 'career', 'off topic': 'off_topic', 'too broad': 'too_broad', empty: 'empty' };
const AGREES = { place_only: ['place_only', 'too_broad'] };
const agrees = (expect, got) => (AGREES[expect] || [expect]).includes(got);

const kitCtx = (site, c) => {
  const s = c.serp || null;
  const ctx = { own_domain: site.own_domain, competitors: site.competitors || [], serp_domains: [...(site.serp_domains || [])], brands: site.brands || {},
    protect: [...(site.services || []), String(site.business || '').slice(0, 400)],
    topics: [...(site.services || []), String(site.business || '').slice(0, 600)], topic_label: 'what this website sells' };
  if (s) {
    ctx.serp = s.top_domains || [];
    ctx.serp_domains = [...new Set([...ctx.serp_domains, ...(s.top_domains || []).filter(d => d !== site.own_domain)])];
    ctx.career = { pages: (s.top_domains || []).map(d => ({ domain: d, url: '', title: '' })), paa: s.paa || [], related: [] };
  }
  return ctx;
};

async function kitPath(H, site, cases) {
  const out = await H.run('_fit_gate', cases.map(c => ({ json: { keyword: c.keyword, intent: c.intent || '', ctx: kitCtx(site, c) } })));
  return cases.map((c, i) => { const g = out[i].json; return { ok: g.ok !== false, reason: g.reason || '', detail: g.detail || '' }; });
}

// the ranked-keywords row DataForSEO Labs returns, as FG1 builds it
const rankedRow = (k, v) => ({ se_type: 'google', keyword_data: { keyword: k, keyword_info: { search_volume: v, cpc: 2.5, competition_level: 'HIGH' }, keyword_properties: { keyword_difficulty: 12 }, search_intent_info: { main_intent: '' } },
  ranked_serp_element: { serp_item: { type: 'organic', rank_group: 4, rank_absolute: 4, url: 'https://rival.example/p', etv: 10 } } });
// KW-GATE (2026-10-21): the node lists a bounded number of kept keywords, so with more cases kept than it lists a kept case was "not
// reached"; the cases go through in chunks small enough that every kept keyword is listed
async function fullPath(H, site, cases) {
  const out = [];
  for (let i = 0; i < cases.length; i += 25) out.push(...await fullChunk(H, site, cases.slice(i, i + 25)));
  return out;
}
async function fullChunk(H, site, cases) {
  const V = require('../fixtures_v5');
  const rivals = (site.serp_domains || []).length ? site.serp_domains : ['rivalco.com'];
  H.mock('Competitor Analysis', { domain: site.own_domain, competitors: site.competitors || [], business: site.business, services: site.services, extra_findings: [], extra_works: [] });
  H.mock('Restore Site Model', { site_model: { domain: site.own_domain, services: site.services, business_facts: site.business } });
  H.mock('KW Targets', [{ domain: site.own_domain, is_you: true }, ...rivals.map(d => ({ domain: d, is_you: false }))]);
  H.mock('Ranked Keywords', [V.task({ target: site.own_domain, items: [] }), V.task({ target: rivals[0], items: cases.map((c, i) => rankedRow(c.keyword, 1000 - i)) }),
    ...rivals.slice(1).map(d => V.task({ target: d, items: [] }))]);
  H.mock('Fallback Queries', []);
  const learned = Object.keys(site.brands || {}).length ? [{ key: 'ai_brands:' + site.own_domain, value: JSON.stringify(site.brands) }] : [];
  if (learned.length) H.mock('Load Site Cache', learned); else delete H.store['Load Site Cache'];
  const res = await H.run('Analyze Keywords', V.task({ items: [] }));
  const sk = res[0].json.site_keywords || {};
  const low = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
  const refused = new Map((sk.refused || []).map(r => [low(r.keyword), r]));
  const shown = JSON.stringify(sk).toLowerCase();
  return cases.map(c => { const r = refused.get(low(c.keyword));
    if (r) return { ok: false, reason: r.reason || '', detail: r.detail || '' };
    // not refused: the node must still have seen it (listed somewhere), or the decision is not the gate's and the scorer says so
    return { ok: true, reason: '', detail: '', reached: shown.includes(JSON.stringify(low(c.keyword)).slice(1, -1)) }; });
}

const pct = (n, d) => (d === 0 ? null : Math.round((n / d) * 1000) / 10);
function score(cases, decisions) {
  const s = { cases: cases.length, out_tp: 0, out_fp: 0, out_fn: 0, in_tp: 0, in_fp: 0, in_fn: 0, reason_agree: 0, reason_checked: 0, failures: [], unreached: [], rows: [] };
  cases.forEach((c, i) => {
    const d = decisions[i]; const gotOut = !d.ok; const got = gotOut ? (CLASS_OF[d.reason] || d.reason || 'none') : 'in_topic';
    s.rows.push({ id: c.id, site: c.site, keyword: c.keyword, label: c.label, expect: c.expect, got, detail: d.detail });
    if (d.ok && d.reached === false) s.unreached.push(c.id + ' ' + c.keyword);
    if (c.label === 'out' && gotOut) s.out_tp++;
    if (c.label === 'in' && gotOut) { s.out_fp++; s.in_fn++; s.failures.push({ id: c.id, site: c.site, keyword: c.keyword, label: c.label, expect: c.expect, got, kind: 'decision', why: d.detail }); }
    if (c.label === 'out' && !gotOut) { s.out_fn++; s.in_fp++; s.failures.push({ id: c.id, site: c.site, keyword: c.keyword, label: c.label, expect: c.expect, got, kind: 'decision', why: 'kept as a target' }); }
    if (c.label === 'in' && !gotOut) s.in_tp++;
    if (c.label === 'out' && gotOut) {
      if (!d.reason || !String(d.detail || '').trim()) s.failures.push({ id: c.id, site: c.site, keyword: c.keyword, label: c.label, expect: c.expect, got, kind: 'no_reason', why: 'refused without a reason the client can read' });
      s.reason_checked++;
      if (agrees(c.expect, got)) s.reason_agree++; else s.failures.push({ id: c.id, site: c.site, keyword: c.keyword, label: c.label, expect: c.expect, got, kind: 'reason', why: d.detail });
    }
  });
  return { ...s, out_precision: pct(s.out_tp, s.out_tp + s.out_fp), out_recall: pct(s.out_tp, s.out_tp + s.out_fn),
    in_precision: pct(s.in_tp, s.in_tp + s.in_fp), in_recall: pct(s.in_tp, s.in_tp + s.in_fn), reason_agreement: pct(s.reason_agree, s.reason_checked) };
}

async function scoreKeywords(H, log) {
  const res = {};
  for (const [name, fn] of [['kit', kitPath], ['full', fullPath]]) {
    const cases = [], decisions = [];
    for (const site of SET.sites) {
      const sc = SET.cases.filter(c => c.site === site.site);
      cases.push(...sc); decisions.push(...await fn(H, site, sc));
    }
    res[name] = score(cases, decisions);
    const r = res[name];
    if (log) log('   ' + name + ': ' + r.cases + ' cases | out precision ' + r.out_precision + '% recall ' + r.out_recall + '% | in precision ' + r.in_precision + '% recall ' + r.in_recall
      + '% | reason agreement ' + r.reason_agreement + '% (' + r.reason_agree + ' of ' + r.reason_checked + ') | ' + r.failures.length + ' disagreements' + (r.unreached.length ? ' | NOT REACHED ' + r.unreached.length : ''));
  }
  // the same keyword, two paths, two answers: printed, so a fix on one path is seen on the other
  const k = res.kit.rows, f = res.full.rows;
  res.path_disagreements = k.filter((r, i) => (r.got === 'in_topic') !== (f[i].got === 'in_topic')).map(r => r.id + ' ' + r.keyword);
  return res;
}

module.exports = { scoreKeywords, SET, CLASS_OF, agrees };

if (require.main === module) {
  (async () => {
    const H = require('../harness');
    const r = await scoreKeywords(H, console.log);
    for (const p of ['kit', 'full']) for (const row of r[p].rows) console.log(p.padEnd(5) + (row.label === (row.got === 'in_topic' ? 'in' : 'out') ? ' ok  ' : ' BAD ') + row.id + ' ' + row.keyword + ' | label ' + row.label + '/' + row.expect + ' | got ' + row.got + (row.detail ? ' (' + row.detail.slice(0, 120) + ')' : ''));
    console.log(JSON.stringify({ kit: r.kit.failures, full: r.full.failures, path_disagreements: r.path_disagreements }));
  })();
}
