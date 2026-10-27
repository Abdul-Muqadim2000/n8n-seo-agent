/*__OUTBOUND__*/
/*__SOURCES__*/
/*__PAGE_FIX__*/
// H1 (2026-10-27): the sources the Editor may cite this round. A page found by *Page Source Candidates* and fetched by *Fetch Page
// Sources* is kept only when it answers (the link check's own rule, OB.classify: a 404, a dead domain, a "not found" page, a bot wall
// or a server error is not a source) AND its text states what the task needs: the figure itself (SRC.hasFigure, the figure check's own
// matcher) or, for a claim, at least 60% of its key words. Each kept page carries the passage that states it, so the Editor quotes it
// and Content QA checks the figure against the same text (it reads `page_fix.sources`). The list grows over the rounds; every task is
// marked searched so it is not searched again. Every route of this round ends here (no task, no page found, pages fetched), so the item
// the Editor receives is always the one *Page Candidates* prepared, with the sources added.
const base = $('Page Candidates').first().json || {};
const st = { ...(base.page_fix || {}) };
const round = Number(st.round) || 1;
let tasks = []; try { tasks = $('Page Source Plan').all().map(i => i.json || {}).filter(t => !t.skip && Number(t.round) === round); } catch (e) { tasks = []; }
let cands = []; if (tasks.length) { try { cands = $('Page Source Candidates').all().map(i => i.json || {}).filter(c => !c.skip && Number(c.round) === round); } catch (e) { cands = []; } }
let resps = []; if (cands.length) { try { resps = $('Fetch Page Sources').all().map(i => i.json || {}); } catch (e) { resps = []; } }
const textOf = (r) => String(r.body ?? r.data ?? '').replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<noscript[\s\S]*?<\/noscript>/gi, ' ')
  .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&rsquo;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();
const have = new Set((st.sources || []).map(v => PF.keyOf(v.url)));
const found = [], tried = [];
cands.forEach((c, i) => {
  const r = resps[i]; const t = tasks.find(x => x.id === c.task_id) || {};
  if (!r) { tried.push({ url: c.url, state: 'not fetched' }); return; }
  const cl = OB.classify(r); if (cl.state !== 'ok') { tried.push({ url: c.url, state: cl.reason }); return; }
  const text = textOf(r); const low = text.toLowerCase();
  let ok = false, at = -1;
  if (t.figure) { const f = SRC.valueOf(t.figure); ok = !!f && SRC.hasFigure(f, text); const digits = String(t.figure).replace(/[^\d.,]/g, '').replace(/[.,]+$/, ''); at = digits ? text.indexOf(digits.slice(0, 6)) : -1; }
  else { const must = (t.must || []).slice(0, 6); const hit = must.filter(w => low.includes(String(w).toLowerCase())); ok = must.length >= 2 && hit.length / must.length >= 0.6; at = hit.length ? low.indexOf(String(hit[0]).toLowerCase()) : -1; }
  if (!ok) { tried.push({ url: c.url, state: t.figure ? 'does not state ' + t.figure : 'does not cover the claim' }); return; }
  const k = PF.keyOf(c.url); if (have.has(k)) return; have.add(k);
  found.push({ id: 'v' + (have.size), url: c.url, host: c.host || PF.hostOf(c.url), tier: c.tier || SRC.tier(c.url), task: t.query || '', kind: t.kind || '', figure: t.figure || '',
    evidence: PF.clean(text.slice(Math.max(0, at - 160), Math.max(0, at) + 260)), text: text.slice(0, 12000), round });
});
const sources = (st.sources || []).concat(found);
const searched = (st.searched || []).concat(tasks.map(t => t.key));
const source_round = { round, tasks: tasks.length, pages_read: cands.length, verified: found.length, not_used: tried.slice(0, 12),
  basis: !tasks.length ? 'nothing on the page needed a source that was not searched before'
    : found.length + ' of ' + cands.length + ' page(s) found by ' + tasks.length + ' search(es) answer and state what the page needs; only those may be cited' };
return [{ json: { ...base, page_fix: { ...st, sources, searched, source_round } } }];
