// D7 (paid run 2026-10-21): the titles Ladder Title Requests asked for, read from the client's own pages. One item out:
// { page_titles: { asked, read: [{ url, title, h1, why }], failed: [{ url, reason }], skip_reason } }. A page that did not answer 200 with
// HTML is `failed` with its reason - never a title, never "no page" - and Ladder Plan says how many could not be read.
const reqs = (() => { try { return $('Ladder Title Requests').all().map(i => i.json).filter(r => r && r.title_check); } catch (e) { return []; } })();
const first = (() => { try { return $('Ladder Title Requests').first().json || {}; } catch (e) { return {}; } })();
const answers = (() => { try { return $('Read Ladder Titles').all().map(i => i.json); } catch (e) { return []; } })();
const out = { asked: reqs.length, read: [], failed: [], untitled: Number(first.untitled) || 0, cap: Number(first.cap) || 0, skip_reason: reqs.length ? '' : String(first.skip_reason || '') };
const dec = (s) => String(s || '').replace(/<[^>]*>/g, ' ').replace(/&amp;/gi, '&').replace(/&#0?39;|&apos;/gi, "'").replace(/&quot;/gi, '"').replace(/&nbsp;/gi, ' ')
  .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&#(\d+);/g, (m, n) => String.fromCharCode(Number(n))).replace(/\s+/g, ' ').trim();
reqs.forEach((q, i) => {
  const a = answers[i] || {};
  const code = Number(a.statusCode || a.status || 0);
  const body = String(a.body ?? a.data ?? '');
  if (a.error) { out.failed.push({ url: q.url, reason: String((a.error && a.error.message) || a.error).slice(0, 120) }); return; }
  if (code && (code < 200 || code >= 300)) { out.failed.push({ url: q.url, reason: 'answered ' + code }); return; }
  const head = body.slice(0, 400000);
  const title = dec((head.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i) || [])[1]).slice(0, 200);
  const h1 = dec((head.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i) || [])[1]).slice(0, 200);
  if (!title && !h1) { out.failed.push({ url: q.url, reason: body ? 'no title or H1 in the page' : 'empty answer' }); return; }
  out.read.push({ url: q.url, title, h1, why: q.why || '' });
});
return [{ json: { page_titles: out } }];
