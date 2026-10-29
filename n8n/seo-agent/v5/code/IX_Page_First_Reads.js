// Index coverage (fix wave 2, X2 / N7): our first read of each page, parsed right here so no page body is kept in the run's saved data. The
// fetch writes each answer as a file (on disk on the production instance); this node reads at most 3 MB of each (IX.CFG.page_read_bytes)
// and passes on only what it found: for a page that answered (no redirect), its full reading (IX.readFetch: status, noindex, canonical,
// words, title, a bot wall); for a redirect, the few headers the next hop needs (location, x-robots-tag, cf-mitigated) and at most 2,000
// characters of its body (a challenge page answering 3xx is still recognised). One item per page read, in the order asked.
/*__PAGE_WATCH__*/
/*__INDEX_KIT__*/
const S = (v) => String(v == null ? '' : v).trim();
const n0 = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const fq = (() => { try { return $('Page Fetch Requests').all().map(i => i.json).filter(q => q && !q.skip); } catch (e) { return []; } })();
let fetched = true; let f1 = []; try { f1 = $('Fetch Page (Index)').all().map(i => i.json); } catch (e) { f1 = []; fetched = false; }
if (!fetched || !fq.length) return [{ json: { skip: true, reason: 'no page read' } }];
const ins = (() => { try { return $input.all(); } catch (e) { return []; } })();
const helpers = (typeof this !== 'undefined' && this && this.helpers) ? this.helpers : null;
const KEEP = ['location', 'x-robots-tag', 'cf-mitigated', 'content-type'];
const out = [];
for (let i = 0; i < fq.length; i++) {
  const q = fq[i]; const r = f1[i] || {};
  const a = await IX.answerText(r, ins.length === f1.length ? ins[i] : null, i, helpers, IX.CFG.page_read_bytes);
  const st = n0(r.statusCode ?? r.status);
  const h = r.headers || {}; const headers = {};
  for (const k of Object.keys(h)) if (KEEP.includes(k.toLowerCase())) headers[k.toLowerCase()] = h[k];
  const first = st ? { statusCode: st, headers, data: st >= 300 && st < 400 ? S(a.text).slice(0, 2000) : '' } : { error: r.error || 'no answer' };
  const redirect = st >= 300 && st < 400;
  out.push({ json: { i, site_id: q.site_id, url: q.url, page_url: q.page_url || q.url, first, ...(redirect ? {} : { f: IX.readFetch(q.url, { ...r, data: a.text, body: undefined }, null) }) } });
}
return out;
