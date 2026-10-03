import { buildApp } from './app';
import { purgeExpiredSessions } from './auth/session';
import { config } from './config';
import { runMigrations, sqlClient } from './db';
import { AUTO_START, runAutoStart } from './services/autoStart';
import { checkEngineFailures } from './services/engineFailures';
import { expireStaleRuns } from './services/runs';

async function main() {
  await runMigrations();
  const app = await buildApp();
  await app.listen({ port: config.port, host: config.host });
  app.log.info(
    { appUrl: config.appUrl, n8n: config.n8n.baseUrl, callbacks: config.callbackBaseUrl, google: config.google.enabled, smtp: config.mail.enabled, serviceAccount: config.serviceAccount.enabled },
    'SEO platform server ready',
  );
  const timer = setInterval(() => purgeExpiredSessions().catch((err) => app.log.warn({ err }, 'session purge failed')), 6 * 60 * 60 * 1000);
  const staleTimer = setInterval(
    () =>
      expireStaleRuns()
        .then((n) => n && app.log.warn({ runs: n }, 'runs without a result marked failed'))
        .catch((err) => app.log.warn({ err }, 'stale run check failed')),
    10 * 60 * 1000,
  );
  const failureTimer = setInterval(
    () =>
      checkEngineFailures()
        .then((n) => n && app.log.warn({ runs: n }, 'runs failed in n8n marked failed'))
        .catch((err) => app.log.warn({ err: String(err) }, 'n8n failure check failed')),
    90 * 1000,
  );
  // "Choose keywords for me": only with AUTO_START_LADDERS=true (it starts paid ladder runs on the owners' behalf)
  const autoStart = () =>
    runAutoStart(app.log)
      .then((n) => n && app.log.info({ ladders: n }, 'keyword ladders started automatically'))
      .catch((err) => app.log.warn({ err: String(err) }, 'automatic ladder start failed'));
  const autoStartFirst = config.autoStartLadders ? setTimeout(autoStart, AUTO_START.firstAfterMs) : null;
  const autoStartTimer = config.autoStartLadders ? setInterval(autoStart, AUTO_START.everyMs) : null;
  app.log.info({ autoStartLadders: config.autoStartLadders }, config.autoStartLadders ? 'automatic ladder starts on (every 6 hours)' : 'automatic ladder starts off (AUTO_START_LADDERS)');
  const stop = async () => {
    if (autoStartFirst) clearTimeout(autoStartFirst);
    if (autoStartTimer) clearInterval(autoStartTimer);
    clearInterval(failureTimer);
    clearInterval(timer);
    clearInterval(staleTimer);
    await app.close();
    await sqlClient.end({ timeout: 5 });
    process.exit(0);
  };
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
