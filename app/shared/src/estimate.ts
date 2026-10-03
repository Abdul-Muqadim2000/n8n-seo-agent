import { MODES, type ModeId } from './constants';

// Estimated cost (USD, Claude + DataForSEO) and time of one run, from its form values. The server checks the company's monthly
// budget with it before calling n8n; the forms show the same numbers. Unset fields count with their schema defaults.

type V = Record<string, unknown>;
const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const pages = (v: V) => Math.min(3, Math.max(1, num(v.pagesNow, 1)));

export function estimateRunCost(mode: ModeId, v: V): number {
  switch (mode) {
    case 'keyword':
      return v.receiveContent === false ? 0.4 : 1.2;
    case 'ladder':
      return 0.6 + pages(v) * 1.2;
    case 'audit':
      return v.reportType === 'full' ? 0.9 : 0.1;
    case 'discover':
      // strategy + the follow-ups it starts: keyword report on the best keyword (~$0.30), a page, an audit
      return 0.4 + (v.receiveReport !== false ? 0.3 : 0) + (v.receiveContent === true ? 1.2 : 0) + (v.fullReport === true ? 0.9 : v.siteAudit === true ? 0.1 : 0);
    case 'track':
      // the first report only: blog posts and monitors run weekly inside n8n (Usage shows their monthly estimate)
      return MODES.track.costUsd;
    default:
      return MODES[mode].costUsd;
  }
}

export function estimateRunMinutes(mode: ModeId, v: V): number {
  if (mode === 'ladder') return MODES.ladder.etaMinutes + pages(v) * 10;
  if (mode === 'audit' && v.reportType === 'full') return 30;
  if (mode === 'keyword' && v.receiveContent === false) return 5;
  return MODES[mode].etaMinutes;
}
