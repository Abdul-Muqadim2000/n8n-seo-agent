/*__PAGE_FIX__*/
// H1 (2026-10-27, docs/content-quality-2026-10-27/R1 §3.6, §6 rec. 7): real sources instead of guessed URLs. Production (exec 949): the
// Critic asked for Microsoft Learn and Ministry of Finance links, the Editor had no search, guessed two addresses (both 404) and left
// "[Confirm: link the Microsoft Learn pages ...]" (exec 2575). Before an editing round, the claims and figures that need a source become
// research tasks: a figure its cited source does not state, a number with no source, the reviewer's unsupported claims (first round
// only), a writer's note about a third party's product (taken out of the page by *Page Fix*), a dead link with no live replacement, and a
// reviewer's "cite <official source>" fix. Each task is one free search on the stack's own SearXNG (as the Backlink Monitor and the Link
// Builder use it); *Verified Sources* keeps only pages that answer 200 and state the figure / the terms. A task searched in an earlier
// round is not searched again. At most MAX tasks a round.
const d = $input.first().json || {};
const st = d.page_fix || {};
const qa = ((st.best || {}).content_qa) || d.content_qa || {};
let critique = null; try { critique = ($('Parse Critique').first().json || {}).critique || null; } catch (e) { critique = null; }
const MAX = 6;
const round = Number(st.round) || 1;
const md = String(d.output || '');
const searched = new Set((st.searched || []).map(String));
const STOP = new Set('the a an and or of for to in on with by at from about this that these those your our its it is are be how what which why when who you we they their them than then into more most can will does do not but any all one also very only such been has have had was were per as if so'.split(' '));
const terms = (t) => [...new Set(PF.plain(t).toLowerCase().replace(/\[[^\]]*\]/g, ' ').split(/[^\p{L}\p{N}%.&-]+/u).map(w => w.replace(/^[.-]+|[.-]+$/g, '')).filter(w => w.length > 2 && !STOP.has(w) && !/^\d+$/.test(w)))];
const tasks = [];
const add = (kind, text, figure) => {
  const T = terms(text).slice(0, 9); if (T.length < 2) return;
  const query = (T.join(' ') + (figure && !T.join(' ').includes(String(figure).toLowerCase()) ? ' ' + String(figure) : '')).trim();
  const key = query.toLowerCase(); if (searched.has(key) || tasks.some(t => t.key === key)) return;
  tasks.push({ id: 't' + round + '_' + (tasks.length + 1), kind, key, query, must: T.slice(0, 6), figure: figure ? String(figure) : '', context: PF.plain(text).slice(0, 240), round });
};
const sentenceOf = (needle) => { const i = md.indexOf(String(needle)); if (i < 0) return String(needle); const [a, b] = PF.span(md, i, String(needle).length); return md.slice(a, b); };
for (const f of (qa.unverified_figures || [])) add('figure', f.context || sentenceOf(f.figure), f.figure);
for (const s of (qa.unverified_statistics || [])) add('statistic', sentenceOf(s), '');
for (const r of (st.removed || []).filter(r => r && r.kind === 'research' && r.research)) add('research', r.research, '');
for (const x of (((qa.link_check || {}).dead_fixed) || []).filter(x => !x.replaced_with)) add('dead_link', (x.anchor || '') + ' ' + String(x.url || '').replace(/^https?:\/\/[^\/]+/, '').replace(/[\/_.-]+/g, ' '), '');
if ((Number(st.edits) || 0) === 0 && critique) for (const p of (critique.problems || [])) {
  const fx = String((p && p.fix) || '') + ' ' + String((p && p.issue) || '');
  const named = fx.match(/\b(Microsoft Learn|Ministry of Finance|Federal Tax Authority|tax\.gov\.ae|mof\.gov\.ae|OECD|World Bank|IMF|European Commission|Eurostat|ISO|NIST|Gartner|Forrester|IDC|McKinsey|Deloitte|PwC|KPMG|Statista)\b/i);
  if (named && /\b(cite|link|source|reference)\b/i.test(fx)) add('citation', named[1] + ' ' + String(p.location || p.issue || ''), '');
}
// the reviewer's unsupported claims last (first round only): the figures, the numbers, the notes and the citations come first
if ((Number(st.edits) || 0) === 0 && critique) for (const c of (critique.unsupported_claims || []).slice(0, 4)) add('claim', String(c), '');
const plan = tasks.slice(0, MAX);
if (!plan.length) return [{ json: { skip: true, round, reason: 'nothing on the page needs a source that was not searched before' } }];
return plan.map(t => ({ json: { ...t, url: 'http://searxng:8080/search?format=json&safesearch=1&q=' + encodeURIComponent(t.query) } }));
