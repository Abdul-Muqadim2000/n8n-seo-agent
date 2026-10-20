// ---- is the website ready for its first written page? ONE rule for the ladder start, the Content Cadence and the app (P1, 2026-10-20) ----
// Rehearsal 2026-10-20 (docs/REHEARSAL_2026-10-20.md §4 item 1): a new client launched a ladder with no author profile and no business facts;
// the first page was written at once (Claude about $1.02, about 62 credits) and Content QA rightly refused it: "11 bracketed field(s) in the
// byline, the author box and the Person schema still need your details" and claims "nothing on file supports". The owner's decision: the
// first page waits until the author profile and the business facts are filled in. Inlined by the build (its marker is READINESS in a block comment) into
// *Ladder Plan* (main workflow) and *Cadence Plan* (Content Cadence); mirrored word for word in app/shared/src/readiness.ts.
//   * author profile ready = what Content QA needs to put NO bracket in the byline, the author box or the Person schema (Content_QA.js
//     PROFILE_PH, Blog_Package.js): the author's name (without it 11 fields are brackets) and a bio (without it the author box keeps one),
//     plus the author's job title, the role the byline and the Person schema name (the owner's minimum: a name and a role).
//   * business facts ready = facts on file of a reasonable length (FACTS_MIN characters, whitespace collapsed): what the page may claim
//     about the business, so its own terms, scope and credentials are not marked [Confirm: ...].
//   of({ profile, facts }) -> { ready, profile_ready, facts_ready, missing: [{ key, label }], missing_text, reason, basis }
const READY = (() => {
  const S = (v) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
  const FACTS_MIN = 30;
  const PROFILE_FIELDS = [
    { key: 'author_name', label: "your author's name" },
    { key: 'author_job_title', label: "your author's job title" },
    { key: 'author_bio', label: 'a short author bio' },
  ];
  const FACTS = { key: 'business_facts', label: 'your business facts' };
  const REASON = 'waiting for your author profile and business facts';
  const listText = (a) => a.length <= 1 ? (a[0] || '') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
  const of = (o) => {
    const x = o || {}; const p = (x.profile && typeof x.profile === 'object') ? x.profile : {};
    const missingProfile = PROFILE_FIELDS.filter(f => !S(p[f.key]));
    const facts = S(x.facts);
    const facts_ready = facts.length >= FACTS_MIN;
    const missing = [...missingProfile.map(f => ({ key: f.key, label: f.label })), ...(facts_ready ? [] : [{ key: FACTS.key, label: FACTS.label }])];
    const missing_text = listText(missing.map(m => m.label));
    return { ready: !missing.length, profile_ready: !missingProfile.length, facts_ready, facts_chars: facts.length, facts_min: FACTS_MIN, missing, missing_text,
      reason: missing.length ? REASON + ' (add ' + missing_text + ')' : '',
      basis: 'the author profile needs a name, a job title and a bio (the fields the byline, the author box and the Person schema print); the business facts need at least ' + FACTS_MIN + ' characters' };
  };
  return { of, FACTS_MIN, PROFILE_FIELDS, REASON };
})();
