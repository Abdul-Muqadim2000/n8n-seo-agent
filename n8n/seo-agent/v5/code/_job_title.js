// ---- JOBT: a placeholder author job title is no job title (F-29, production review 2026-11-12; build section 189) ----
// An author job title of "User" was accepted and printed on every byline ("Name, User"), in the Person schema and in the author box. The
// web app now refuses such a title; profile rows stored before that still carry it, so every engine node that PRINTS a job title reads it
// through JOBT.real: a placeholder is '' (the line is left out), never printed. The placeholders are only these words, whole, case and
// spacing aside: "User", "N/A", "-", "none", "test", "job title", "title" ("Owner", "Administrator", "Tester" are real titles). The content
// readiness rule (_readiness.js, word for word app/shared/src/readiness.ts) is not changed. Inlined by build_v4.py / build_monitors.py
// (marker JOB_TITLE in a block comment). Pure.
const JOBT = (() => {
  const LIST = ['user', 'n/a', '-', 'none', 'test', 'job title', 'title'];
  const SET = new Set(LIST);
  const norm = (v) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().toLowerCase();
  /** true for a job title that is not one; an empty title is missing, not a placeholder */
  const isPlaceholder = (v) => SET.has(norm(v));
  /** the job title to print: '' for a placeholder, else the title with its spacing collapsed */
  const real = (v) => (isPlaceholder(v) ? '' : String(v == null ? '' : v).replace(/\s+/g, ' ').trim());
  return { isPlaceholder, real, LIST };
})();
