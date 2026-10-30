// W07-A (2026-10-31, docs/page-quality-2026-10-29/WAVE06.md "Open resilience item"): the page reader refused reads in this run. Fed by every
// reader fallback node of the workflow (one item per read); with no refusal it answers `skip` and nothing below runs. Otherwise it names the
// reader and its error ONCE: the alert's identity (OA.keyOf: workflow, node, the stable "HTTP 402 InsufficientBalanceError" part) is the same
// for every step of the run and every run of the next 30 minutes, so the first step that meets the refusal alerts and the others only count
// on the row (OA.DEDUPE_MINUTES). The details (which step, how many reads, what the fallback recovered) ride in `detail`.
/*__OPS_ALERT__*/
/*__READER__*/
const S = (v) => String(v == null ? '' : v).trim();
const items = $input.all().map(i => (i && i.json) || {});
const marks = RD.refusedIn(items);
if (!marks.length) return [{ json: { skip: true, reason: 'the page reader answered every read of this step' } }];
const first = marks[0].refused || {};
const keyless = marks.filter(m => m.via === 'reader_keyless').length;
const direct = marks.filter(m => m.via === 'direct').length;
const unread = marks.filter(m => m.via === 'none').length;
const head = 'The page reader refused reads: HTTP ' + (first.status || '?') + (first.name ? ' ' + first.name : '');
const what = first.status === 402 ? 'the reader account is out of balance: recharge it, or put a funded key in SEO_JINA_API_KEY (credential SEOcredJinaReade)'
  : first.status === 401 || first.status === 403 ? 'the reader key was refused: check SEO_JINA_API_KEY (credential SEOcredJinaReade)'
  : 'the reader is limiting this key: check its plan and how many runs read pages at once';
const detail = 'Step "' + S(marks[0].path || marks[0].node) + '": ' + marks.length + ' of ' + items.length + ' read(s) refused'
  + (first.message ? ' ("' + S(first.message).slice(0, 140) + '")' : '') + '; the fallback read ' + keyless + ' through the reader without the key and '
  + direct + ' directly, ' + unread + ' could not be read. What to do: ' + what + '.';
const alert = { workflow: '__WORKFLOW__', node: 'Page reader (Jina Reader)', message: head,
  subject: '[critical] ' + head + ' (' + '__WORKFLOW__' + ')', execution_id: S($execution.id), execution_url: '', mode: 'reader' };
return [{ json: { alert, alert_key: OA.keyOf(alert), detail, refused: marks.length, unread, keyless, direct, step: S(marks[0].path || marks[0].node) } }];
