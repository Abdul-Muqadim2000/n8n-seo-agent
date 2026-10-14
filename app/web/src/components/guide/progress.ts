// Which steps of a guide this person has ticked off, kept in the browser so a guide picked up tomorrow opens where they stopped.
// Browser storage can throw (private windows, blocked site data), so every read and write is guarded and the panel works without it.

const KEY = (id: string) => `asc.guide.${id}`;

export function readDone(id: string): number[] {
  try {
    const raw = localStorage.getItem(KEY(id));
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? parsed.filter((n): n is number => Number.isInteger(n)) : [];
  } catch {
    return [];
  }
}

export function writeDone(id: string, done: number[]): void {
  try {
    if (done.length) localStorage.setItem(KEY(id), JSON.stringify([...new Set(done)].sort((a, b) => a - b)));
    else localStorage.removeItem(KEY(id));
  } catch {
    /* no storage: the ticks last as long as the panel is open */
  }
}

/** The step to open on: the first one not ticked off, or the first step once everything is done. */
export function firstOpenStep(done: number[], total: number): number {
  for (let i = 0; i < total; i++) if (!done.includes(i)) return i;
  return 0;
}
