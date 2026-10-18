import { buildApp } from './app';
import { purgeExpiredFlows } from './auth/flows';
import { purgeExpiredSessions } from './auth/session';
import { purgeAudit } from './services/audit';
import { config } from './config';
import { runMigrations, sqlClient } from './db';
import { AUTO_START, runAutoStart } from './services/autoStart';
import { checkEngineFailures } from './services/engineFailures';
import { autoApproveTick, pollTick, senderTick } from './services/outreachJobs';
import { startCrawlerJobs } from './services/crawlers/jobs';
import { deliveryTick, retryTick } from './services/reportDelivery';
import { expireStaleRuns } from './services/runs';
import { startPortalJobs } from './services/portalHosts';
import { webhookTick } from './services/webhooks';
import { exportTick } from './services/exports';

async function main() {
  await runMigrations();
  const app = await buildApp();
  await app.listen({ port: config.port, host: config.host });
  app.log.info(
    { appUrl: config.appUrl, n8n: config.n8n.baseUrl, callbacks: config.callbackBaseUrl, google: config.google.enabled, smtp: config.mail.enabled, serviceAccount: config.serviceAccount.enabled },
    'SEO platform server ready',
  );
  const timer = setInterval(() => purgeExpiredSessions().catch((err) => app.log.warn({ err }, 'session purge failed')), 6 * 60 * 60 * 1000);
  // G1: expired sign-in challenges every 10 minutes; audit events past each company's retention once a day (and once at start)
  const flowTimer = setInterval(() => void purgeExpiredFlows().catch((err) => app.log.warn({ err: String(err) }, 'auth flow purge failed')), 10 * 60 * 1000);
  const auditPurge = () =>
    purgeAudit()
      .then((n) => n && app.log.info({ events: n }, 'audit events past their retention removed'))
      .catch((err) => app.log.warn({ err: String(err) }, 'audit retention purge failed'));
  const auditFirst = setTimeout(() => void auditPurge(), 60 * 1000);
  const auditTimer = setInterval(() => void auditPurge(), 24 * 60 * 60 * 1000);
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
  // B-R1: the scheduled report delivery. Every five minutes it asks which companies are due a daily / weekly / monthly summary and
  // retries the deliveries that failed; companies on "as each report arrives" are served by the callback itself, not by this timer.
  const delivery = () =>
    deliveryTick(app.log)
      .then((n) => n && app.log.info({ companies: n }, 'scheduled report summaries delivered'))
      .catch((err) => app.log.warn({ err: String(err) }, 'scheduled report delivery failed'))
      .then(() => retryTick(app.log).catch((err) => app.log.warn({ err: String(err) }, 'report delivery retry failed')));
  const deliveryTimer = setInterval(() => void delivery(), 5 * 60 * 1000);
  // G4: event webhooks — every minute the deliveries whose next attempt is due (1 / 5 / 30 / 120 / 720 minutes, then given up)
  const webhookTimer = setInterval(() => void webhookTick(app.log).catch((err) => app.log.warn({ err: String(err) }, 'webhook retry failed')), 60 * 1000);
  // G4: scheduled warehouse exports (S3-compatible storage, BigQuery), checked every five minutes
  const exportTimer = setInterval(() => void exportTick(app.log).catch((err) => app.log.warn({ err: String(err) }, 'export tick failed')), 5 * 60 * 1000);

  // v4.13 Link Builder: the sender (every minute), the inbox (every 3 minutes) and automatic approval (every 10 minutes); LINK_BUILDER_JOBS=false stops them
  const lbTimers = config.linkBuilderJobs
    ? [setInterval(() => void senderTick(app.log), 60 * 1000), setInterval(() => void pollTick(app.log), 3 * 60 * 1000), setInterval(() => void autoApproveTick(app.log), 10 * 60 * 1000)]
    : [];
  app.log.info({ linkBuilderJobs: config.linkBuilderJobs }, config.linkBuilderJobs ? 'link-building sender and inbox jobs on' : 'link-building jobs off (LINK_BUILDER_JOBS)');
  // gap #6: the crawler-log worker, retention and the daily IP-list refresh; CRAWLER_JOBS=false stops them
  const crawlerTimers = startCrawlerJobs(app.log);
  // G5: verified portal hosts re-checked (lapse after repeated failures); PORTAL_JOBS=false stops it
  const stopPortalJobs = startPortalJobs(app.log);
  const stop = async () => {
    for (const t of crawlerTimers) clearInterval(t);
    stopPortalJobs();
    for (const t of lbTimers) clearInterval(t);
    if (autoStartFirst) clearTimeout(autoStartFirst);
    if (autoStartTimer) clearInterval(autoStartTimer);
    clearInterval(deliveryTimer);
    clearInterval(webhookTimer);
    clearInterval(exportTimer);
    clearInterval(failureTimer);
    clearInterval(timer);
    clearInterval(flowTimer);
    clearInterval(auditTimer);
    clearTimeout(auditFirst);
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
