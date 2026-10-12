// ---- a check-in that is a test (D25c, 2026-10-12; the builders inline this file where a node asks for the CHECKIN_TEST kit) ----
// October's Search Console check-in was still the 2026-10-02 test row ("October check-in (test)"), so the reminder stopped asking the owner
// and the Monday report showed a test as the month's answer. A check-in is a test when the person said so (the form's "test" answer or the
// API's is_test), when it was written by a test caller (source "test"), or when its own note marks it as one. A test check-in is recorded
// like any other, but it never satisfies the month: CK.isTest(row) keeps it out of the monthly check, so the reminder keeps asking.
const CK = (() => {
  const S = (v) => String(v == null ? '' : v).trim();
  const yes = (v) => /^(y|yes|true|1|on)$/i.test(S(v));
  // the note marks it as a test: "(test)", "test check-in / submission / entry / row / run / data", or a note that starts with "test"
  const MARK = /\(\s*test[^)]*\)|\btest\s+(check-?in|submission|entry|row|run|data)\b|^test\b[\s:,-]/i;
  const isTest = (row) => {
    const r = row || {};
    return yes(r.is_test) || S(r.source).toLowerCase() === 'test' || MARK.test(S(r.notes));
  };
  // why a stored row counts as a test (for the report and the harness)
  const testReason = (row) => {
    const r = row || {};
    if (yes(r.is_test)) return 'marked as a test when it was submitted';
    if (S(r.source).toLowerCase() === 'test') return 'written by a test caller (source "test")';
    if (MARK.test(S(r.notes))) return 'its note marks it as a test';
    return '';
  };
  return { isTest, testReason, yes, MARK };
})();
