// Comp Sitemap Hop Text (FX-L round 2, REVIEW_PERF_SAFETY N2): the 400 KB cap is enforced on the BODY, not only asked for with a Range header. The GET
// writes its answer to a binary file (responseFormat file: n8n keeps it on disk, not in the process), and this node reads it only when its
// size is known and at most REFUSE bytes; it keeps the first CAP bytes as text. A body over REFUSE is never read ("not read: over 2 MB"),
// a body between CAP and REFUSE is cut at CAP (truncated). The status and headers pass through for the hop check.
const CAP = 400000, REFUSE = 2000000;
const items = $input.all(); const out = [];
const sizeOf = (b) => { if (!b) return null; const n = Number(b.bytes); if (Number.isFinite(n) && n >= 0) return n;
  const m = String(b.fileSize || '').match(/([\d.]+)\s*(B|kB|KB|MB|GB)\b/i); if (!m) return null; return Math.round(Number(m[1]) * ({ B: 1, KB: 1e3, MB: 1e6, GB: 1e9 })[m[2].toUpperCase()]); };
for (let i = 0; i < items.length; i++) {
  const it = items[i] || {}; const j = it.json || {}; const b = it.binary && (it.binary.data || it.binary.body);
  let text = '', truncated = false, refused = false, bytes = null;
  if (b) {
    bytes = sizeOf(b);
    if (bytes == null || bytes > REFUSE) refused = true;   // an unknown size is never read into memory
    else { const buf = await this.helpers.getBinaryDataBuffer(i, it.binary.data ? 'data' : 'body'); bytes = buf.length; if (buf.length > REFUSE) refused = true; else { truncated = buf.length > CAP; text = buf.subarray(0, CAP).toString('utf8'); } }
  } else {
    const raw = String(j.body != null ? j.body : (j.data != null ? j.data : '')); bytes = raw.length;
    if (bytes > REFUSE) refused = true; else { truncated = bytes > CAP; text = raw.slice(0, CAP); }
  }
  const o = { statusCode: j.statusCode == null ? null : j.statusCode, headers: j.headers || {}, data: refused ? '' : text, bytes, truncated, refused };
  if (j.error || refused) o.error = j.error || 'the answer is over 2 MB (or of unknown size): not read';
  out.push({ json: o });
}
return out.length ? out : [{ json: { skip: true, reason: 'nothing was read' } }];
