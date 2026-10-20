// The deploy guard of the engine image's release step (release.mjs), F-ENG 2026-10-20. It replaces the old Monday 07:00-12:00 refusal: the
// weekly crons are gone and each website's jobs are started by the Cycle Dispatcher from a durable table. The RULE is not written here - it
// is CYC.deployWindow, read out of the generated dispatcher this image carries (workflows/SEO_Agent_Cycle_Dispatcher.json, node
// 'Cycle Plan', where the build inlined the cycle kit), so the release step, apply_env.py / deploy_engine.py (deploy_guard.py, its Python
// twin) and the harness (CY12, on harness/deploy_window_cases.json) answer one question one way:
//   REFUSE while a dispatcher job is STARTING (between its claim and its run's ledger row) or a website's cycle or "Coming up" preview is
//   due in the next 15 minutes (or became due in the last 10); REPORT, never refuse, a RUNNING job - a restart kills it, the dispatcher sees
//   the dead run at its next sweep and starts it again (one of its three attempts).
// The tables are read through the running instance's public API (it runs inside the n8n image, where Python may be absent): seo_cycle_jobs
// (only `starting` / `running` rows) and seo_cycles, paged with `nextCursor`, bounded. A table that does not exist yet is empty; anything
// else that cannot be read refuses (a guard that cannot see is not a guard) unless forced. Nothing here prints a key.
import { readFileSync } from 'node:fs';

const MAX_PAGES = 40;   // 40 x 250 rows, as deploy_guard.py: more is "could not be read", never "nothing"

// the kits exactly as the build inlined them into the Cycle Plan node: the catch-up's time rule (CU, which CYC needs) and CYC
export function kitFromSource(src) {
  const take = (name) => {
    const a = src.indexOf('const ' + name + ' = (() => {');
    const b = a < 0 ? -1 : src.indexOf('\n})();', a);
    if (a < 0 || b < 0) throw new Error(name + ' is not inlined in the Cycle Plan node');
    return src.slice(a, b + 6);
  };
  // eslint-disable-next-line no-new-func
  return new Function(take('CU') + '\n' + take('CYC') + '\nreturn { CU, CYC };')();
}

export function kitFromWorkflow(file) {
  const parsed = JSON.parse(readFileSync(file, 'utf8'));
  const wf = Array.isArray(parsed) ? parsed[0] : parsed;
  const node = ((wf && wf.nodes) || []).find((n) => n.name === 'Cycle Plan');
  if (!node) throw new Error('the dispatcher workflow ' + file + ' has no Cycle Plan node');
  return kitFromSource(String(node.parameters.jsCode || ''));
}

// api(method, path) -> Promise<{ status, body }> against the running instance's /api/v1
export async function readTables(api) {
  const ids = {};
  let cursor = null, n = 0;
  do {
    const r = await api('GET', '/data-tables?limit=100' + (cursor ? '&cursor=' + encodeURIComponent(String(cursor)) : ''));
    if (r.status !== 200 || !r.body || typeof r.body !== 'object') return { error: 'n8n answered ' + r.status + ' to the Data Table list' + (n ? ' (page ' + (n + 1) + ')' : '') };
    for (const t of r.body.data || []) ids[t.name] = t.id;
    cursor = r.body.nextCursor; n++;
  } while (cursor && n <= MAX_PAGES);
  const rows = async (name, filter) => {
    const id = ids[name];
    if (!id) return { rows: [] };
    const q = filter ? '&filter=' + encodeURIComponent(JSON.stringify(filter)) : '';
    const out = [];
    let cur = null;
    for (let pages = 0; ; ) {
      const r = await api('GET', '/data-tables/' + id + '/rows?limit=250' + q + (cur ? '&cursor=' + encodeURIComponent(String(cur)) : ''));
      if (r.status !== 200 || !r.body || typeof r.body !== 'object') return { error: 'n8n answered ' + r.status + ' reading ' + name };
      out.push(...(r.body.data || []));
      cur = r.body.nextCursor; pages++;
      if (!cur) return { rows: out };
      if (pages >= MAX_PAGES) return { error: name + ' has more than ' + MAX_PAGES * 250 + ' rows to read' };
    }
  };
  const open = { type: 'or', filters: [{ columnName: 'status', condition: 'eq', value: 'starting' }, { columnName: 'status', condition: 'eq', value: 'running' }] };
  const jobs = await rows('seo_cycle_jobs', open);
  if (jobs.error) return { error: jobs.error };
  const cycles = await rows('seo_cycles', null);
  if (cycles.error) return { error: cycles.error };
  return { jobs: jobs.rows, cycles: cycles.rows };
}

// -> null when the release may go ahead, else the refusal text. `force`: the name of the setting that forced it ('' = not forced).
export async function deployGuard({ api, CYC, force = '', now = Date.now(), say = console.log }) {
  let t;
  try { t = api ? await readTables(api) : { error: 'no API of the running instance to ask (set SEO_DEPLOY_GUARD_URL)' }; }
  catch (e) { t = { error: "n8n's public API could not be reached (" + String((e && e.message) || e).slice(0, 160) + ')' }; }
  const bang = '!'.repeat(100);
  if (t.error) {
    if (force) {
      say(bang + '\nDEPLOY GUARD OVERRIDDEN (' + force + '): the cycle tables could not be read (' + t.error + "), so nobody knows whether a website's job is "
        + 'starting. Releasing anyway: a start this interrupts is failed by the Cycle Dispatcher and started again (it costs one attempt).\n' + bang);
      return null;
    }
    return 'Deploy guard: refusing - the cycle tables could not be read (' + t.error + "), so a job that is starting cannot be ruled out. Set SEO_DEPLOY_GUARD_URL "
      + "(the running engine's /api/v1) and SEO_DEPLOY_GUARD_API_KEY (or N8N_API_KEY); on a FIRST release, with no engine running yet, set SEO_DEPLOY_FORCE=true.";
  }
  const w = CYC.deployWindow({ jobs: t.jobs, cycles: t.cycles, now });
  if (w.note) say('deploy guard: ' + w.note);
  if (!w.busy) {
    say('deploy guard: ok - ' + w.reason + (w.ignored_stale.length ? ' (' + w.ignored_stale.length + ' stale open row(s) ignored)' : ''));
    return null;
  }
  if (force) {
    say(bang + '\nDEPLOY GUARD OVERRIDDEN (' + force + '): ' + w.reason + '. Releasing anyway: a start this restart interrupts is failed by the Cycle Dispatcher and '
      + 'started again at its next sweep (one attempt of three), and a due cycle starts up to 5 minutes late.\n' + bang);
    return null;
  }
  return 'Deploy guard: refusing now - ' + w.reason + '. A release restarts or re-publishes the workflows: a start in flight could not be confirmed and a due start '
    + 'would run late. This clears within minutes; try again shortly, or set SEO_DEPLOY_FORCE=true (the dispatcher retries what the release interrupts, at the cost of one attempt).';
}
