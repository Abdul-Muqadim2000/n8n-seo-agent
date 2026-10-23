// W2-E3 (2026-10-23, docs/ai-visibility-2026-10-23/fixes/F2.md "Deploy safety"): the never-deploy step of the image's release (release.mjs),
// the same rule deploy/gcp/deploy_engine.py applies in its step 5b (never_deploy_pass). The manifest's `never_deploy` list names workflows that
// must never run on a deployed instance: the test callback receiver (an unauthenticated webhook) and the test runner (it starts paid runs).
//   * an id on never_deploy AND on the publish set (publish / publish_when_imap) fails the release before anything is touched;
//   * every listed workflow the instance has ACTIVE is unpublished (`n8n unpublish:workflow --id=`; the web process reads it when it restarts,
//     as it reads every other publish of the release step) and named; an inactive or absent one is left as it is;
//   * nothing is ever deleted, and no workflow that is not on the list is touched.
// release.mjs has no dry run (it is the apply step); `node never_deploy.mjs --self-test` proves the rule against a fake CLI.

/** -> { done: [ids unpublished], failures: [sentences] }. `n8n(...args)` runs the n8n CLI and returns its stdout. */
export function neverDeployPass({ manifest, n8n, log }) {
  const say = log || (() => {});
  const never = [...new Set((manifest && manifest.never_deploy) || [])].map((s) => String(s).trim()).filter(Boolean);
  const publish = new Set([...((manifest && manifest.publish) || []), ...((manifest && manifest.publish_when_imap) || [])]);
  const clash = never.filter((id) => publish.has(id)).sort();
  if (clash.length) return { done: [], failures: ['deploy_manifest.json lists ' + clash.join(', ') + ' both in never_deploy and in the publish set'] };
  if (!never.length) return { done: [], failures: [] };
  let active;
  try { active = new Set(String(n8n('list:workflow', '--active=true', '--onlyId') || '').split(/\s+/).map((s) => s.trim()).filter(Boolean)); }
  catch (e) { return { done: [], failures: ['never-deploy: could not list the active workflows: ' + String((e && (e.stderr || e.message)) || e).split('\n').filter(Boolean).pop()] }; }
  const done = [], failures = [];
  for (const id of never) {
    if (!active.has(id)) { say('never-deploy ' + id + ': not active, left as it is'); continue; }
    try { n8n('unpublish:workflow', '--id=' + id); done.push(id); say('never-deploy ' + id + ' was ACTIVE: unpublished (not deleted)'); }
    catch (e) { failures.push('never-deploy ' + id + ': unpublish failed: ' + String((e && (e.stderr || e.message)) || e).split('\n').filter(Boolean).pop()); }
  }
  say('never-deploy: ' + done.length + ' active workflow(s) unpublished' + (failures.length ? '; FAILED: ' + failures.join('; ') : ''));
  return { done, failures };
}

// ---- self-test (no instance, no CLI): `node never_deploy.mjs --self-test` ----
if (process.argv.includes('--self-test')) {
  const fake = (active, failOn) => { const calls = []; const fn = (...a) => { calls.push(a.join(' ')); if (a[0] === 'list:workflow') return active.join('\n') + '\n';
    if (a[0] === 'unpublish:workflow' && failOn && a[1] === '--id=' + failOn) { const e = new Error('boom'); e.stderr = 'Error unpublishing workflow(s)'; throw e; } return ''; }; fn.calls = calls; return fn; };
  const M = { publish: ['SEOagentAIVisib1'], publish_when_imap: ['SEOagentConsole1'], never_deploy: ['SEOagentCallback', 'SEOagentTestRun1'] };
  const out = []; let ok = true; const t = (name, cond) => { out.push((cond ? 'ok   ' : 'FAIL ') + name); if (!cond) ok = false; };
  let f = fake(['SEOagentAIVisib1', 'SEOagentCallback']); let r = neverDeployPass({ manifest: M, n8n: f });
  t('an ACTIVE listed workflow is unpublished, the inactive one is left, nothing else is touched', r.done.join() === 'SEOagentCallback' && !r.failures.length && f.calls.filter((c) => c.startsWith('unpublish')).join('|') === 'unpublish:workflow --id=SEOagentCallback');
  f = fake(['SEOagentAIVisib1']); r = neverDeployPass({ manifest: M, n8n: f });
  t('none active: nothing unpublished, no failure', !r.done.length && !r.failures.length && !f.calls.some((c) => c.startsWith('unpublish')));
  f = fake([]); r = neverDeployPass({ manifest: { ...M, publish: ['SEOagentCallback'] }, n8n: f });
  t('an id on both lists fails before anything is touched', r.failures.length === 1 && /both in never_deploy and in the publish set/.test(r.failures[0]) && f.calls.length === 0);
  f = fake(['SEOagentTestRun1'], 'SEOagentTestRun1'); r = neverDeployPass({ manifest: M, n8n: f });
  t('a failed unpublish is a failure with the reason', r.failures.length === 1 && /unpublish failed: Error unpublishing/.test(r.failures[0]));
  t('the CLI is never asked to delete', ![...f.calls].some((c) => /delete|remove/.test(c)));
  const fl = () => { throw Object.assign(new Error('x'), { stderr: 'no database' }); }; r = neverDeployPass({ manifest: M, n8n: fl });
  t('a list that cannot be read is a failure, never "nothing active"', r.failures.length === 1 && /could not list/.test(r.failures[0]));
  console.log(out.join('\n')); console.log(ok ? 'never_deploy self-test: all passed' : 'never_deploy self-test: FAILED'); process.exit(ok ? 0 : 1);
}
