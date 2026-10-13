// harness shim (written by build_v4.py section 52): the subject-line A/B rule — { variants: [{ variant, subject, sent, replied }] }
// -> the counts per variant, whether they may be read at all, and the one line the app shows
// ---- subject-line A/B (L7, LINK_BUILDER_SPEC.md §2): two subjects a batch, the reply rate per variant, and silence until there is
// enough to read. The writer gives every batch two subjects; each drafted sequence carries one of them (A, B, A, B … across the batch),
// so the two go out in equal numbers. Nothing is sent that a person has not approved: this only decides which subject a draft carries.
// **No verdict under MIN_SENDS first e-mails per variant** — at 12 sends a 2-point difference in reply rate is noise, so the counts are
// shown and the line reads "not enough sends yet". Mirrored in app/shared/src/outreach.ts (`subjectAbStats`, `subjectVariantFor`):
// the two must change together.
const AB = (() => {
  const MIN_SENDS = 30;            // per variant, before anything may be called ahead (first e-mails only; follow-ups ride the same thread)
  const MIN_GAP_POINTS = 2;        // reply rates closer than this are read as "no difference"
  const VARIANTS = ['A', 'B'];
  /** which variant the nth draft of a batch carries (A, B, A, B …) */
  const variantFor = (i) => VARIANTS[Math.abs(Math.round(Number(i) || 0)) % VARIANTS.length];
  const rate = (replied, sent) => (sent > 0 ? Math.round((1000 * replied) / sent) / 10 : null);
  /** o: { variants: [{ variant, subject, sent, replied }] } -> the counts per variant, whether they may be read, and one honest line */
  function read(o) {
    const given = ((o || {}).variants || []).filter(x => x && VARIANTS.includes(String(x.variant || '').toUpperCase()));
    const rows = VARIANTS.map(v => {
      const hit = given.find(x => String(x.variant).toUpperCase() === v) || {};
      const sent = Math.max(0, Math.round(Number(hit.sent) || 0));
      const replied = Math.min(sent, Math.max(0, Math.round(Number(hit.replied) || 0)));
      return { variant: v, subject: String(hit.subject || '').slice(0, 140), sent, replied, reply_rate: rate(replied, sent), enough: sent >= MIN_SENDS };
    });
    const live = rows.filter(r => r.sent > 0);
    const enough = live.length >= 2 && live.every(r => r.enough);
    const counts = rows.map(r => r.variant + ': ' + r.replied + ' replies from ' + r.sent + ' e-mail' + (r.sent === 1 ? '' : 's')).join(' · ');
    if (!live.length) return { rows, enough: false, leader: '', verdict: 'nothing_sent', min_sends: MIN_SENDS, note: 'No first e-mails have gone out yet, so there is nothing to compare.', counts };
    if (!enough) {
      const short = rows.filter(r => r.sent < MIN_SENDS).map(r => r.variant + ' (' + r.sent + ' of ' + MIN_SENDS + ')').join(', ');
      return { rows, enough: false, leader: '', verdict: 'not_enough', min_sends: MIN_SENDS,
        note: 'Not enough sends yet to call a subject better: ' + MIN_SENDS + ' first e-mails per variant are needed, and ' + short + ' ' + (short.includes(',') ? 'are' : 'is') + ' short. ' + counts + '.', counts };
    }
    const sorted = [...live].sort((a, b) => b.reply_rate - a.reply_rate);
    const gap = Math.round((sorted[0].reply_rate - sorted[sorted.length - 1].reply_rate) * 10) / 10;
    if (gap < MIN_GAP_POINTS) return { rows, enough: true, leader: '', verdict: 'no_difference', min_sends: MIN_SENDS, gap,
      note: 'Both subjects reply about equally well (' + counts + '): keep either.', counts };
    return { rows, enough: true, leader: sorted[0].variant, verdict: 'ahead', min_sends: MIN_SENDS, gap,
      note: 'Subject ' + sorted[0].variant + ' is ahead by ' + gap + ' points (' + counts + '). One test on this many e-mails is a hint, not a rule.', counts };
  }
  // the second subject a draft may carry: different from the first, short, nothing left in brackets, none of the words we never use
  const BAD_SUBJECT = /(backlink|dofollow|do-follow|link exchange|link swap|guest post|sponsored post|\bSEO\b)/i;
  const MAX_SUBJECT = 70;
  function altOk(alt, first) {
    const a = String(alt || '').replace(/\s+/g, ' ').trim(); const f = String(first || '').replace(/\s+/g, ' ').trim();
    if (!a) return 'no second subject was written';
    if (a.length > MAX_SUBJECT) return 'the second subject is ' + a.length + ' characters (at most ' + MAX_SUBJECT + ')';
    if (/[[\]{}]|\(confirm/i.test(a)) return 'the second subject still has something to fill in';
    if (BAD_SUBJECT.test(a)) return 'the second subject uses a word we never use';
    if (a.toLowerCase() === f.toLowerCase()) return 'the second subject is the same as the first';
    return '';
  }
  return { read, variantFor, altOk, VARIANTS, MIN_SENDS, MIN_GAP_POINTS, MAX_SUBJECT };
})();

return $input.all().map(i => { const j = i.json || {};
  return { json: { ...AB.read(j), alt_why: j.alt === undefined ? null : AB.altOk(j.alt, j.first), variant_for: [0, 1, 2, 3].map(AB.variantFor) } }; });
