// Send new / updated pages and key pages Bing has not crawled to Bing (SubmitUrlBatch, within the site's daily quota).
// B9-1 (2026-10-15, benchmark area 9): what this reaches is BING — the index behind Bing itself and Microsoft Copilot, whose
// citations Bing Webmaster Tools reports in AI Performance (blogs.bing.com/webmaster/2026/2/Introducing-AI-Performance-in-Bing-Webmaster-Tools-Public-Preview).
// It is NOT documented to reach ChatGPT: OpenAI's own crawler page says OAI-SearchBot "is used to surface websites in search
// results in ChatGPT's search features" and never mentions Bing (developers.openai.com/api/docs/bots). A submission is a
// notification, not indexing; nothing downstream may call a submitted page an indexed one.
const plans = $('Growth Plan').all().map(i => i.json).filter(p => !p.nothing_to_do);
// R94 (2026-10-16): a test run never submits. `dry_run: true` on the Manual Run (the Schedule Catch-up passes it only in a test) keeps
// SubmitUrlBatch unsent and hands on what WOULD have been sent, so the report can say so and no page is recorded as submitted.
const DRY_RUN = (() => { try { let t = $('Manual Run').first().json || {}; if (t.body && typeof t.body === 'object') t = { ...t, ...t.body };
  return t.dry_run === true || /^(true|1|yes|on)$/i.test(String(t.dry_run ?? '')); } catch (e) { return false; } })();
let reqs = [], res = []; try { reqs = $('Bing Growth Requests').all().map(i => i.json); res = $('Fetch Bing Growth').all().map(i => i.json); } catch (e) {}
// B9-3 (2026-10-15): a page robots.txt forbids Bingbot to crawl is not worth a submission slot — and telling the owner it was
// "sent to Bing" would be a promise the rules on their own server refuse. The verdict is the one *Robots Verdicts (Growth)* read.
const robots = (() => { try { return $('Robots Verdicts (Growth)').all().map(i => i.json).filter(x => x && !x.skip); } catch (e) { return []; } })();
const keyOf = (u) => { const m = String(u || '').trim().match(/^https?:\/\/(?:www\.)?([^\/?#]+)([^?#]*)/i); if (!m) return ''; return m[1].toLowerCase() + ((m[2] || '/').replace(/\/+$/, '') || '/'); };
const jsonOf = (r) => { if (!r) return {}; if (r.d !== undefined || r.ErrorCode !== undefined) return r; const b = r.body ?? r.data; if (b && typeof b === 'object') return b; try { return JSON.parse(b || '{}'); } catch (e) { return {}; } };
const dateOf = (v) => { const m = String(v || '').match(/Date\((-?\d+)/); if (!m) return ''; const t = Number(m[1]); return t > 946684800000 ? new Date(t).toISOString() : ''; };   // "/Date(…)/"; year 1 = never
const out = [];
for (const p of plans) {
  const mine = reqs.map((q, i) => ({ q, r: jsonOf(res[i]) })).filter(x => x.q && x.q.site_id === p.site_id);
  if (!mine.length) continue;
  const quota = mine.find(x => x.q.kind === 'quota'); const daily = Number(((quota && quota.r.d) || {}).DailyQuota);
  // a page Bing has never crawled goes again: the ones checked this run, and a page submitted long enough ago that a second
  // submission is not noise (B9-2: the follow-up asks about every one of them, but only the old ones are re-sent)
  const never = mine.filter(x => x.q.kind === 'info' && x.r && x.r.d && !dateOf(x.r.d.LastCrawledDate)
    && (x.q.why === 'checked this week' || Number(x.q.submitted_days || 0) >= 30)).map(x => x.q.page);
  const rb = robots.find(x => x.site_id === p.site_id) || null;
  const blockedFor = (u) => { const vd = rb && rb.verdicts ? rb.verdicts[keyOf(u)] : null; return vd && vd.checked && !vd.bing_ok ? (vd.rule || 'robots.txt') : ''; };
  const all = [...new Set([...p.submit.map(s => s.url), ...never])];
  const refused = all.filter(u => blockedFor(u)).map(u => ({ url: u, reason: 'robots.txt blocks Bingbot (' + blockedFor(u) + ')' }));
  const urls = all.filter(u => !blockedFor(u));
  const cap = Number.isFinite(daily) ? Math.max(0, daily) : 10;
  if (!urls.length || !cap) { if (refused.length) out.push({ json: { site_id: p.site_id, site_url: mine[0].q.site_url, skip: true, refused } }); continue; }
  if (DRY_RUN) { out.push({ json: { site_id: p.site_id, site_url: mine[0].q.site_url, skip: true, dry_run: true, would_submit: urls.slice(0, Math.min(cap, 500)), refused } }); continue; }
  out.push({ json: { site_id: p.site_id, site_url: mine[0].q.site_url, url: 'https://ssl.bing.com/webmaster/api.svc/json/SubmitUrlBatch', urls: urls.slice(0, Math.min(cap, 500)), quota: Number.isFinite(daily) ? daily : null, refused,
    body: { siteUrl: mine[0].q.site_url, urlList: urls.slice(0, Math.min(cap, 500)) } } });
}
return out.length ? out : [{ json: { skip: true } }];
