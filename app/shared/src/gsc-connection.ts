// Is Search Console connected for a website? Three places can answer, each with a time:
//   - the latest weekly tracking report (the engine read Search Console with the service account, or could not),
//   - the app's live check on Verification & Google (the same service account, asked when the panel opens or "Check again"),
//   - the engine's site row, before any report exists (its stored property).
// The newest answer wins. Before this, every screen but the panel read only the report, or the engine row when there was none: a
// website whose service account was added before its first report landed (or after a report that said "no access") was told to
// "Connect Google Search Console" on Overview, Recommendations and the Pipeline while the panel said Connected (2026-10-22, techand.ai).

/** The app's own live check of the service account's access (null: never checked, or the last check failed to get an answer). */
export interface GscLiveCheck {
  at: string;
  connected: boolean;
  property: string | null;
}

export interface GscConnectionInput {
  /** the latest weekly tracking report's reading (null: no report yet) */
  report?: { receivedAt: string; connected: boolean; property: string | null } | null;
  /** the engine's site row */
  tracking?: { gscProperty: string | null; lastRunAt: string | null; gscLiveCheck?: GscLiveCheck | null } | null;
}

export interface GscConnectionState {
  connected: boolean;
  property: string | null;
  /** where the answer came from */
  source: 'report' | 'live_check' | 'engine' | 'none';
  /** connected, but no report has read Search Console yet: the figures arrive with the next tracking run */
  awaitingReport: boolean;
}

const time = (iso: string | null | undefined): number => {
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(t) ? t : 0;
};

export function gscConnectionState({ report, tracking }: GscConnectionInput): GscConnectionState {
  const live = tracking?.gscLiveCheck ?? null;
  const candidates: { source: GscConnectionState['source']; at: number; connected: boolean; property: string | null }[] = [];
  if (report) candidates.push({ source: 'report', at: time(report.receivedAt), connected: report.connected, property: report.property });
  // the engine row is the report's own run: it only speaks when no report has arrived yet
  else if (tracking) candidates.push({ source: 'engine', at: time(tracking.lastRunAt), connected: !!tracking.gscProperty, property: tracking.gscProperty });
  if (live) candidates.push({ source: 'live_check', at: time(live.at), connected: live.connected, property: live.property });
  if (!candidates.length) return { connected: false, property: null, source: 'none', awaitingReport: false };
  // newest first; on a tie the live check wins (it is the one a person just looked at)
  const pick = candidates.reduce((a, b) => (b.at > a.at || (b.at === a.at && b.source === 'live_check') ? b : a));
  return { connected: pick.connected, property: pick.property ?? report?.property ?? null, source: pick.source, awaitingReport: pick.connected && !report?.connected };
}
