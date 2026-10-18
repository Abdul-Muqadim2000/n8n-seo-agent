// Release step of the engine image (`seo-release`): what apply_env.py does on the local Docker stack, for a remote instance.
// Runs against the same database as the web process, before the host starts the new release (Heroku release phase, Render / Railway
// pre-deploy command, Fly release_command, a Kubernetes Job). The web process picks the published workflows up when it restarts.
//
//   SEO_CREDENTIALS_B64        optional: base64 of the JSON `python3 n8n/seo-agent/sync_credentials.py --out FILE` writes; imported
//                              under their fixed ids (SEOcred…), so the workflows find them. Unset: credentials are left as they are.
//   SEO_ALERT_WEBHOOK_URL      optional: substituted for the placeholder at import time, never stored in the image or the repo (R29)
//   SEO_PUBLISH_CONSOLE_ALERTS true to publish Console Alerts too (it needs the IMAP credential)
//   SEO_HOLD_WORKFLOWS         optional: comma-separated workflow ids imported but left unpublished
//   SEO_DEPLOY_FORCE_MONDAY    true to release inside the Monday window anyway (R94: a restart then throws away the weekly runs that
//                              are due; the Schedule Catch-up workflow starts them again)
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = '/opt/seo';
const PLACEHOLDER = '__SEO_ALERT_WEBHOOK_URL__';
const env = process.env;
const truthy = (v) => /^(1|true|yes|on)$/i.test(String(v ?? '').trim());
const log = (...a) => console.log('[seo-release]', ...a);

// R94: Monday 07:00-12:00 in the schedules' time zone (the weekly crons run 07:00-11:00, plus an hour for a run in progress)
function inMondayWindow(now = new Date(), tz = env.GENERIC_TIMEZONE || 'America/New_York') {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short', hour: 'numeric', hourCycle: 'h23' }).formatToParts(now).map((p) => [p.type, p.value]),
  );
  const hour = Number(parts.hour);
  return parts.weekday === 'Mon' && hour >= 7 && hour < 12;
}

function n8n(...args) {
  return execFileSync('n8n', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 }).trim();
}
const lastLine = (s) => s.split('\n').filter(Boolean).pop() ?? '';

if (inMondayWindow() && !truthy(env.SEO_DEPLOY_FORCE_MONDAY)) {
  console.error(
    '[seo-release] R94: refusing to release now: Monday 07:00-12:00 (' + (env.GENERIC_TIMEZONE || 'America/New_York') + ') is when the weekly ' +
      'schedules fire, and a release restarts n8n, which throws away a run that is due. Release after 12:00, or set SEO_DEPLOY_FORCE_MONDAY=true.',
  );
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(join(ROOT, 'deploy_manifest.json'), 'utf8'));
const tmp = mkdtempSync('/tmp/seo-release-');
let failed = 0;
try {
  // 1. credentials
  if (env.SEO_CREDENTIALS_B64) {
    const file = join(tmp, 'credentials.json');
    const json = Buffer.from(env.SEO_CREDENTIALS_B64, 'base64').toString('utf8');
    const ids = JSON.parse(json).map((c) => c.id);
    writeFileSync(file, json, { mode: 0o600 });
    log('credentials:', lastLine(n8n('import:credentials', '--input=' + file)), '(' + ids.join(', ') + ')');
    rmSync(file, { force: true });
  } else {
    log('credentials: SEO_CREDENTIALS_B64 is not set, left as they are');
  }

  // 2. workflows: each file is an array of one workflow (the shape apply_env.py imports); merged into one array, one CLI start
  const hook = (env.SEO_ALERT_WEBHOOK_URL ?? '').trim();
  let substituted = 0;
  const all = [];
  for (const f of manifest.workflows) {
    let text = readFileSync(join(ROOT, 'workflows', f), 'utf8');
    if (hook && text.includes(PLACEHOLDER)) {
      text = text.split(PLACEHOLDER).join(JSON.stringify(hook).slice(1, -1));
      substituted++;
    }
    const parsed = JSON.parse(text);
    all.push(...(Array.isArray(parsed) ? parsed : [parsed]));
  }
  const bundle = join(tmp, 'workflows.json');
  writeFileSync(bundle, JSON.stringify(all), { mode: 0o600 });
  const imported = lastLine(n8n('import:workflow', '--input=' + bundle));
  log('workflows:', imported, '(' + manifest.workflows.length + ' files)');
  if (!/imported (\d+) workflow/.test(imported) || Number(imported.match(/imported (\d+)/)[1]) !== all.length) {
    throw new Error('expected ' + all.length + ' workflows to be imported, n8n said: ' + imported);
  }
  log('alert webhook:', hook ? 'substituted in ' + substituted + ' workflow(s)' : 'SEO_ALERT_WEBHOOK_URL is empty, the webhook channel stays unconfigured');

  // 3. publish
  const hold = new Set(String(env.SEO_HOLD_WORKFLOWS ?? '').split(',').map((s) => s.trim()).filter(Boolean));
  const ids = [...manifest.publish, ...(truthy(env.SEO_PUBLISH_CONSOLE_ALERTS) ? manifest.publish_when_imap : [])].filter((id) => !hold.has(id));
  for (const id of ids) {
    try {
      n8n('publish:workflow', '--id=' + id);
      log('published', id);
    } catch (e) {
      failed++;
      console.error('[seo-release] could not publish', id + ':', lastLine(String(e.stderr || e.stdout || e.message)));
    }
  }
  if (hold.size) log('held back:', [...hold].join(', '));
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
if (failed) {
  console.error('[seo-release]', failed, 'workflow(s) not published: the release fails so the old one keeps running');
  process.exit(1);
}
log('done');
