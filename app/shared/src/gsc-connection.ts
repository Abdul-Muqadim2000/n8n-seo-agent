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

// ---------------- Google Analytics 4: the same rule (2026-10-28) ----------------
// A client chose their GA4 property on Verification & Google; the panel said Connected, while Recommendations ("Connect Google Analytics
// 4"), the Pipeline and the Search page read only the weekly report, which still said "GA4 off" (devaicon.com: the property was saved in the
// app and never reached the engine). The same three answers as Search Console, newest first:
//   - the latest weekly tracking report (the engine read GA4, or could not),
//   - the app's live check (the panel asking Google, or a save whose property Google confirmed for this domain),
//   - the engine's site row, before any report exists (its stored property id).

/** The app's own live check of GA4 for the website's chosen property (null: never checked, or no answer from Google). */
export interface Ga4LiveCheck {
  at: string;
  connected: boolean;
  propertyId: string | null;
}

export interface Ga4ConnectionInput {
  /** `error`: why the report could not read GA4 ("no property id given or detected" means it had none to read) */
  report?: { receivedAt: string; connected: boolean; propertyId: string | null; error?: string | null } | null;
  tracking?: { ga4PropertyId: string | null; lastRunAt: string | null; ga4LiveCheck?: Ga4LiveCheck | null } | null;
}

export interface Ga4ConnectionState {
  connected: boolean;
  propertyId: string | null;
  source: 'report' | 'live_check' | 'engine' | 'none';
  /** connected, but no report has read GA4 yet: the figures arrive with the next tracking run */
  awaitingReport: boolean;
}

export function ga4ConnectionState({ report, tracking }: Ga4ConnectionInput): Ga4ConnectionState {
  const live = tracking?.ga4LiveCheck ?? null;
  const candidates: { source: Ga4ConnectionState['source']; at: number; connected: boolean; propertyId: string | null }[] = [];
  if (report) candidates.push({ source: 'report', at: time(report.receivedAt), connected: report.connected, propertyId: report.propertyId });
  else if (tracking) candidates.push({ source: 'engine', at: time(tracking.lastRunAt), connected: !!tracking.ga4PropertyId, propertyId: tracking.ga4PropertyId });
  // the app's check reads Google's property list; the weekly report reads the figures. A report that tried the very property the engine holds
  // and failed with a real error (not "no property") is the operational truth until the next report, whenever the panel is opened again.
  const reportTriedIt = !!report && !report.connected && !!report.error && !/no property id/i.test(report.error) && !!live?.propertyId && live.propertyId === tracking?.ga4PropertyId;
  if (live && !reportTriedIt) candidates.push({ source: 'live_check', at: time(live.at), connected: live.connected, propertyId: live.propertyId });
  if (!candidates.length) return { connected: false, propertyId: null, source: 'none', awaitingReport: false };
  const pick = candidates.reduce((a, b) => (b.at > a.at || (b.at === a.at && b.source === 'live_check') ? b : a));
  return { connected: pick.connected, propertyId: pick.propertyId ?? report?.propertyId ?? null, source: pick.source, awaitingReport: pick.connected && !report?.connected };
}
