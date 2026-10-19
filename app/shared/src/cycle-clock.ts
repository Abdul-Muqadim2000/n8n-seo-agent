// The per-website cycle's clock, mirrored from the engine's kit (n8n/seo-agent/v5/code/_cycle.js: `nextAfter`, `chainFrom`,
// `periodKey`; the DST rule is the catch-up kit's `zonedToUtc` / `offset`), so the app can say when a website's coming cycles run before
// the engine has written its row, check the row it reads, and answer a weekday change at once. Pure: no clock of its own; the wall time
// in the website's zone is turned into UTC each time (7 x 24 h is never added to an instant), so a DST change never moves a cycle.

import { CYCLE_LOCAL_TIME, PREVIEW_HOURS_BEFORE, type CycleRow } from './cycles';

/** A cycle is never due fewer than this many local days after the last one started (cycle 0 to cycle 1, a changed weekday). */
export const CYCLE_SPACING_DAYS = 3;
/** The engine's own zone, used when a website has none (GENERIC_TIMEZONE). */
export const ENGINE_TIMEZONE = 'America/New_York';
/** A cycle due more than this long ago that has not opened is a missed cycle (the delivery report, the Pipeline). */
export const CYCLE_OVERDUE_HOURS = 24;
export const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

/** An IANA zone the platform knows (the engine's Normalize Input applies the same test). */
export const isValidTimezone = (tz: unknown): tz is string => {
  const t = String(tz ?? '').trim();
  if (!t || t.length > 64 || !/^[A-Za-z][A-Za-z0-9_+\-]*(\/[A-Za-z0-9_+\-]+)*$/.test(t)) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: t }).format(0);
    return true;
  } catch {
    return false;
  }
};

const fmtCache = new Map<string, Intl.DateTimeFormat>();
const zoneFmt = (tz: string) => {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    fmtCache.set(tz, f);
  }
  return f;
};
const zoneParts = (tz: string, t: number) => {
  const o: Record<string, string> = {};
  for (const p of zoneFmt(tz).formatToParts(new Date(t))) o[p.type] = p.value;
  return { y: +o.year, mo: +o.month, d: +o.day, h: +o.hour % 24, mi: +o.minute, s: +o.second };
};
/** the zone's offset from UTC at instant `t`, in ms (the catch-up kit's `offset`) */
export const zoneOffset = (tz: string, t: number): number => {
  const p = zoneParts(tz, t);
  return Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s) - Math.floor(t / 1000) * 1000;
};
/** a wall-clock time in a zone -> the UTC instant (the catch-up kit's `zonedToUtc`) */
export const zonedToUtc = (tz: string, y: number, mo: number, d: number, h: number, mi: number): number => {
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  let t = guess - zoneOffset(tz, guess);
  const o2 = zoneOffset(tz, t);
  if (guess - o2 !== t) t = guess - o2;
  return t;
};
const pad2 = (n: number) => String(n).padStart(2, '0');
/** the local date (YYYY-MM-DD), weekday (0 Sunday) and day of the month of instant `t` in the zone */
export const localDateOf = (tz: string, t: number): { date: string; weekday: number; day: number } => {
  const d = new Date(t + zoneOffset(tz, t));
  return { date: `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`, weekday: d.getUTCDay(), day: d.getUTCDate() };
};
const ymdOf = (date: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(date ?? ''));
  return m ? { y: +m[1], mo: +m[2], d: +m[3] } : null;
};
export const addLocalDays = (date: string, n: number): string => {
  const p = ymdOf(date);
  if (!p) return '';
  const d = new Date(Date.UTC(p.y, p.mo - 1, p.d + n));
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
};
export const weekdayOfDate = (date: string): number => {
  const p = ymdOf(date);
  return p ? new Date(Date.UTC(p.y, p.mo - 1, p.d)).getUTCDay() : -1;
};
const onOrAfterWeekday = (date: string, wd: number) => addLocalDays(date, (wd - weekdayOfDate(date) + 7) % 7);
const hhmmOf = (v: unknown) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(v ?? '').trim());
  return m && +m[1] < 24 && +m[2] < 60 ? { h: +m[1], mi: +m[2], text: `${pad2(+m[1])}:${m[2]}` } : null;
};
/** the UTC instant (ms) a cycle on local `date` is due at `localTime` in the zone */
export const cycleDueAt = (tz: string, date: string, localTime: string = CYCLE_LOCAL_TIME): number => {
  const p = ymdOf(date);
  const t = hhmmOf(localTime) ?? hhmmOf(CYCLE_LOCAL_TIME)!;
  return p ? zonedToUtc(tz, p.y, p.mo, p.d, t.h, t.mi) : NaN;
};
/** the monthly period a local date falls in: from `monthlyDay` of month M to `monthlyDay` of M+1, named 'YYYY-MM' by M */
export const monthlyPeriodKey = (date: string, monthlyDay: number): string => {
  const p = ymdOf(date);
  if (!p) return '';
  let y = p.y;
  let mo = p.mo;
  if (p.d < monthlyDay) {
    mo -= 1;
    if (mo < 1) {
      mo = 12;
      y -= 1;
    }
  }
  return `${y}-${pad2(mo)}`;
};
/** The cycle date a cycle key names ('' when it is not a cycle key). */
export const cycleDateOf = (key: string): string => /^cyc:.+:(\d{4}-\d{2}-\d{2})$/.exec(String(key ?? ''))?.[1] ?? '';
/** The website's id in a cycle key ('' when it is not one). */
export const cycleSiteOf = (key: string): string => /^cyc:(.+):\d{4}-\d{2}-\d{2}$/.exec(String(key ?? ''))?.[1] ?? '';
/** §14.2: the request id of a cycle job's callbacks, `cyc_<site_id without site_>_<YYYYMMDD>_<job>` */
export const cycleRequestId = (siteId: string, date: string, job: string): string => `cyc_${String(siteId).replace(/^site_/, '')}_${String(date).replace(/-/g, '')}_${job}`;
/** a callback's request id is a cycle job's (the Cycle Dispatcher's), never an app run's */
export const isCycleRequestId = (id: unknown): boolean => /^cyc_[a-z0-9-]+_\d{8}_[a-z_]+$/i.test(String(id ?? ''));

/** What the app knows of a website's cycle: the engine's seo_cycles row when there is one, else the app's own anchor. */
export interface CycleIntent {
  /** when the website's tracking started (cycle 0 is due then) */
  anchorAt: string;
  tz: string;
  /** 0-6 (Sunday 0) in the zone; null = the anchor's weekday */
  weekday?: number | null;
  localTime?: string;
  monthlyDay?: number | null;
  /** when the last cycle opened ('' = none yet: cycle 0 is next) */
  lastCycleAt?: string;
  lastMonthlyKey?: string;
  /** the engine's own next due time, preferred when it is after the last cycle */
  nextDueAt?: string;
}

export interface CycleOccurrence {
  /** the local date of the cycle */
  date: string;
  /** when it is due (ISO UTC) */
  at: string;
  /** cycle 0, at setup */
  cycle0: boolean;
  /** the website's monthly cycle (the monthly extras run in it) */
  monthly: boolean;
  /** when its "Coming up" plan is made (ISO UTC), '' for cycle 0 */
  previewAt: string;
}

export interface ReadIntent {
  tz: string;
  anchor: number;
  anchorDate: string;
  weekday: number;
  localTime: string;
  monthlyDay: number;
  last: number;
  lastMonthlyKey: string;
}

/** The intent with its defaults filled in (the engine's `read`), or null when it has no anchor. An unknown zone reads as the engine's. */
export function readCycleIntent(c: CycleIntent): ReadIntent | null {
  const tz = isValidTimezone(c.tz) ? String(c.tz).trim() : ENGINE_TIMEZONE;
  const anchor = Date.parse(String(c.anchorAt ?? ''));
  if (!Number.isFinite(anchor) || anchor <= 0) return null;
  const A = localDateOf(tz, anchor);
  const wd = Number(c.weekday);
  const weekday = c.weekday !== null && c.weekday !== undefined && Number.isInteger(wd) && wd >= 0 && wd <= 6 ? wd : A.weekday;
  const localTime = (hhmmOf(c.localTime) ?? hhmmOf(CYCLE_LOCAL_TIME)!).text;
  const md = Number(c.monthlyDay);
  const monthlyDay = c.monthlyDay != null && Number.isInteger(md) && md >= 1 && md <= 28 ? md : Math.min(28, A.day);
  const lastT = Date.parse(String(c.lastCycleAt ?? ''));
  return { tz, anchor, anchorDate: A.date, weekday, localTime, monthlyDay, last: Number.isFinite(lastT) && lastT > 0 ? lastT : 0, lastMonthlyKey: String(c.lastMonthlyKey ?? '') };
}

/** The next cycle after the last one started: the first chosen weekday at least CYCLE_SPACING_DAYS local days later (the engine's `nextAfter`). */
export function nextCycleAfter(o: { tz: string; weekday: number; localTime?: string; last: number }): { date: string; at: number } {
  const date = onOrAfterWeekday(addLocalDays(localDateOf(o.tz, o.last).date, CYCLE_SPACING_DAYS), o.weekday);
  return { date, at: cycleDueAt(o.tz, date, o.localTime) };
}

/**
 * The website's coming cycles: the first one may be due now (due and not opened yet), never more than one overdue (the engine runs
 * the most recent missed cycle once). Mirrors the engine's chain: cycle 0 at the anchor, then the first chosen weekday at least 3 days
 * later, then every 7 local days. Each with its due time, whether it is the monthly cycle and when its "Coming up" plan is made.
 */
export function upcomingCycles(c: CycleIntent, now: number, count = 5): CycleOccurrence[] {
  const r = readCycleIntent(c);
  if (!r || count <= 0) return [];
  let date: string;
  let at: number;
  let zero = false;
  const engineNext = Date.parse(String(c.nextDueAt ?? ''));
  if (!r.last) {
    date = r.anchorDate;
    at = r.anchor;
    zero = true;
  } else {
    const n = nextCycleAfter({ tz: r.tz, weekday: r.weekday, localTime: r.localTime, last: r.last });
    // the engine's own figure wins while it agrees with the stored intent's chain (a weekday change is recomputed at its next sweep)
    const useEngine = Number.isFinite(engineNext) && engineNext > r.last && localDateOf(r.tz, engineNext).weekday === r.weekday;
    at = useEngine ? engineNext : n.at;
    date = useEngine ? localDateOf(r.tz, engineNext).date : n.date;
  }
  const nextOf = (d: string, z: boolean) => (z ? onOrAfterWeekday(addLocalDays(d, CYCLE_SPACING_DAYS), r.weekday) : addLocalDays(d, 7));
  for (let guard = 0; guard < 5000; guard++) {
    const nd = nextOf(date, zero);
    const nat = cycleDueAt(r.tz, nd, r.localTime);
    if (nat > now) break;
    date = nd;
    at = nat;
    zero = false;
  }
  const out: CycleOccurrence[] = [];
  let lmk = r.lastMonthlyKey;
  for (let i = 0; i < count; i++) {
    const pk = monthlyPeriodKey(date, r.monthlyDay);
    const monthly = zero || pk !== lmk;
    if (monthly) lmk = pk;
    out.push({ date, at: new Date(at).toISOString(), cycle0: zero, monthly, previewAt: zero ? '' : new Date(at - PREVIEW_HOURS_BEFORE * 3_600_000).toISOString() });
    const nd = nextOf(date, zero);
    at = cycleDueAt(r.tz, nd, r.localTime);
    date = nd;
    zero = false;
  }
  return out;
}

/** Every cycle due time in [from, to) of a website (for the calendar and the delivery report), from its intent. */
export function cyclesBetween(c: CycleIntent, from: number, to: number, max = 60): CycleOccurrence[] {
  const r = readCycleIntent(c);
  if (!r) return [];
  // walk the chain from cycle 0 (the anchor); the stored weekday applies from cycle 1 on, as in the engine
  const out: CycleOccurrence[] = [];
  let date = r.anchorDate;
  let at = r.anchor;
  let zero = true;
  let lmk = '';
  for (let guard = 0; guard < 5000 && out.length < max && at < to; guard++) {
    const pk = monthlyPeriodKey(date, r.monthlyDay);
    const monthly = zero || pk !== lmk;
    if (monthly) lmk = pk;
    if (at >= from) out.push({ date, at: new Date(at).toISOString(), cycle0: zero, monthly, previewAt: zero ? '' : new Date(at - PREVIEW_HOURS_BEFORE * 3_600_000).toISOString() });
    const nd = zero ? onOrAfterWeekday(addLocalDays(date, CYCLE_SPACING_DAYS), r.weekday) : addLocalDays(date, 7);
    at = cycleDueAt(r.tz, nd, r.localTime);
    date = nd;
    zero = false;
  }
  return out;
}

/** The engine's seo_cycles row as the app's intent. */
export const intentOfRow = (row: Partial<CycleRow>): CycleIntent => ({
  anchorAt: String(row.anchor_at ?? ''),
  tz: String(row.tz ?? ''),
  weekday: row.cycle_weekday === undefined || row.cycle_weekday === null || String(row.cycle_weekday) === '' ? null : Number(row.cycle_weekday),
  localTime: String(row.local_time ?? ''),
  monthlyDay: row.monthly_day === undefined || row.monthly_day === null || String(row.monthly_day) === '' ? null : Number(row.monthly_day),
  lastCycleAt: String(row.last_cycle_at ?? ''),
  lastMonthlyKey: String(row.last_monthly_key ?? ''),
  nextDueAt: String(row.next_due_at ?? ''),
});

/** Whether the engine's row says a cycle is overdue by more than CYCLE_OVERDUE_HOURS (a missed cycle). Paused or off cycles never are. */
export const cycleOverdue = (row: Partial<CycleRow>, now: number): boolean => {
  if (String(row.status || 'active') !== 'active') return false;
  const due = Date.parse(String(row.next_due_at ?? ''));
  return Number.isFinite(due) && now - due > CYCLE_OVERDUE_HOURS * 3_600_000;
};
