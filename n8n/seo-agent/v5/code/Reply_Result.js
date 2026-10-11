// The answer to the web app: the class, a one-line summary, the out-of-office return date, a referred contact, the suggested answer and the
// link check (says_linked is "won" only when our crawler found the link). Header rules first: a reply the app already knows is automatic
// (it sends auto_submitted) is out_of_office without asking the model. D14: every sentence of the suggested answer that claims something
// about the business the facts on file do not carry (accredited, certified, partner, ISO, years, clients, %, prices …) is wrapped in
// [Owner: confirm — …] and the reply needs the owner (CL.check, one list for every draft).
/*__CLAIMS__*/
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
