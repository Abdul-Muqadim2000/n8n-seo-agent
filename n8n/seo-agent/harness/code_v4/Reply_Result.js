// The answer to the web app: the class, a one-line summary, the out-of-office return date, a referred contact, the suggested answer and the
// link check (says_linked is "won" only when our crawler found the link). Header rules first: a reply the app already knows is automatic
// (it sends auto_submitted) is out_of_office without asking the model. D14: every sentence of the suggested answer that claims something
// about the business the facts on file do not carry (accredited, certified, partner, ISO, years, clients, %, prices …) is wrapped in
// [Owner: confirm — …] and the reply needs the owner (CL.check, one list for every draft).
// ---- claims kit (D14, 2026-10-11; inlined by build_monitors.py): statements about the business that only the owner can vouch for. With no
// facts on file the Reply Reader's suggested answer invented "we're not directly accredited by the Ministry, but we work with accredited
// providers" (live 2026-10-11). A sentence that claims an accreditation, certification, partnership, licence, registration, approval, award,
// membership, founding year, location, age, size, client count, percentage or price is kept only when the facts on file carry the same word
// stem (or the same number); otherwise it is wrapped in [Owner: confirm — …] and the answer needs the owner. One list for every draft
// (CL.CLAIM_RE; L2 reuses it for the outreach sequences). Regex only, no model.
const CL = (() => {
  const CLAIM_RE = /\b(?:accredit\w*|certif\w*|iso[ -]?\d{4,5}|partner\w*|authori[sz]ed|licen[cs]ed|registered|approved|award\w*|member(?:s|ship)? of|founded|since \d{4}|headquarter\w*|based in|offices? in|\d[\d,.]*\+? ?(?:years?|yrs|clients?|customers?|projects?|companies|countries|employees|staff|users|installations?|implementations?)|\d[\d,.]*\s?%|(?:aed|usd|eur|gbp|sar|inr|\$|€|£)\s?\d[\d,.]*|\d[\d,.]*\s?(?:aed|usd|eur|gbp|sar|dirhams?|dollars?)|pric(?:e|es|ed|ing)|fees?|free of charge|no charge|discount\w*)\b/gi;
  const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9%$€£]+/g, ' ').replace(/\s+/g, ' ').trim();
  // the piece of a claim that the facts must carry: its number, else the first word's stem (7 letters: "accredited" → "accredi", "authorised" / "authorized" → "authori")
  const keyOf = (m) => { const x = norm(m); const num = x.match(/\d[\d,.]*/); if (num) return num[0].replace(/[,.]+$/, '');
    const w = x.split(' ')[0]; const st = w.replace(/(ations?|ation|ings?|ed|es|s|ship|ships)$/, ''); return (st.length >= 5 ? st : w).slice(0, 7); };
  // L2 (2026-10-11): a claim is only ours when the sentence speaks about us -- "the date it was approved" on their own list says nothing
  // about our business. The outreach draft gate passes { ours: true, brand }, so a sentence about the prospect's page is left alone; the
  // Reply Reader checks every sentence (its whole answer is about us).
  const OURS_RE = /\b(we|we.?re|we.?ve|our|ours|us|i|i.?m|i.?ve|my)\b/i;
  // text: a draft; facts: what we know (any string); opts.skip: a string that is never a claim (the signature); opts.ours / opts.brand:
  // see above. Returns the text with every unsupported claim sentence wrapped and the list of what was wrapped.
  function check(text, facts, opts = {}) {
    const t = String(text || ''); if (!t.trim()) return { text: t, flags: [] };
    const F = norm(facts); const body = opts.skip ? t.split(String(opts.skip)).join(' ') : t;
    const flags = []; let out = t;
    for (const s0 of body.split(/(?<=[.!?])\s+|\n+/)) { const s = s0.trim(); if (s.length < 4 || /^\[[^\]]*\]$/.test(s)) continue;
      if (opts.ours && !(OURS_RE.test(s) || (opts.brand && s.toLowerCase().includes(String(opts.brand).toLowerCase())))) continue;
      let plain = s.replace(/\[[^\]]*\]/g, ' ').replace(/https?:\/\/\S+/g, ' ');   // a word in a URL is not a claim (our own slug says "accredited-service-providers")
      if (opts.ours) plain = plain.replace(/["\u201c\u201d][^"\u201c\u201d]{3,200}["\u201c\u201d]/g, ' ');   // L2: words inside quotation marks are THEIR words (a pitch quotes their page title), never our claim
      const bad = [...plain.matchAll(CLAIM_RE)].map(m => m[0]).filter(m => { const k = keyOf(m); return k && !F.includes(k); });
      if (!bad.length) continue;
      flags.push({ claim: bad[0], sentence: s.slice(0, 200) });
      if (out.includes(s)) out = out.replace(s, '[Owner: confirm — ' + s + ']'); }
    return { text: out, flags };
  }
  return { CLAIM_RE, keyOf, check };
})();

const r = $('Reply Classify Input').first().json; let o = {}; try { o = $('Reply Reader').first().json || {}; } catch (e) {}
const parse = (raw) => { if (raw && typeof raw === 'object') return raw; const s = String(raw || '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, ''); try { return JSON.parse(s); } catch (e) { const a = s.indexOf('{'), b = s.lastIndexOf('}'); try { return JSON.parse(s.slice(a, b + 1)); } catch (e2) { return null; } } };
const CLASSES = ['says_linked', 'interested', 'question', 'wants_payment', 'link_swap', 'not_now', 'declined', 'unsubscribe', 'wrong_person', 'out_of_office', 'other'];
const j = parse(o.output) || {};
let cls = CLASSES.includes(j.class) ? j.class : 'other';
if (!j.class && /\b(unsubscribe|remove me|stop (e-?mailing|contacting)|do not (e-?mail|contact)|don't (e-?mail|contact|write))\b/i.test(r.reply_text)) cls = 'unsubscribe';   // the model failed: never miss an opt-out
if (r.link_found) cls = 'says_linked';
const date = /^\d{4}-\d{2}-\d{2}$/.test(String(j.return_date || '')) ? j.return_date : '';
const claims = CL.check(['unsubscribe', 'declined', 'out_of_office'].includes(cls) ? '' : String(j.suggested_reply || '').slice(0, 2000), r.facts || '', { skip: r.signer || '' });
return [{ json: { ok: true, class: cls, summary: String(j.summary || '').slice(0, 300), return_date: date, referral_email: /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(String(j.referral_email || '')) ? String(j.referral_email).toLowerCase() : '',
  referral_name: String(j.referral_name || '').slice(0, 120), needs_you: (j.needs_you !== false || claims.flags.length > 0) && !['unsubscribe', 'out_of_office'].includes(cls), suggested_reply: claims.text.slice(0, 2400),
  unverified: claims.flags.map(f => f.claim + ' — ' + f.sentence),
  link_found: !!r.link_found, link: r.link, checks: r.checks, model_error: o.error ? String(o.error.message || o.error).slice(0, 200) : '' } }];
