import { describe, expect, it } from 'vitest';
import { AUTOPILOT_SCREEN_GUIDES, fillGuide, fillText, GUIDE_AREAS, GUIDE_FOR_NEEDS_YOU_KIND, GUIDE_FOR_RECOMMENDATION, GUIDES, guideAvailable, guideById, guideForNeedsYou, guideForRecommendation, guideText, guidesByArea, plainText, searchGuides, type Guide } from './guides';
import { CYCLE_SPACING_DAYS } from './cycle-clock';
import { AUTOPILOT_LEVELS, CHANCE_WORDS, CYCLE_LOCAL_TIME, NUDGE_AFTER_PAGES, PREVIEW_HOURS_BEFORE, PROPOSAL_WAIT_HOURS, QUEUED_RECHECK_DAYS, REJECT_LIMIT, REJECT_WINDOW } from './cycles';
import type { NeedsYouItem } from './data';

const all = GUIDES as unknown as Guide[];
const texts = (g: Guide): string[] => [
  g.title,
  g.why,
  g.done ?? '',
  ...g.steps.flatMap((s) => [s.title, s.body, s.note ?? '', s.warn ?? '', ...(s.copy ?? []).flatMap((c) => [c.value, c.hint ?? '']), ...(s.choices ?? []).flatMap((c) => [c.body, c.note ?? ''])]),
  ...(g.trouble ?? []).flatMap((t) => [t.q, t.a]),
];

describe('the catalogue', () => {
  it('has a unique, url-safe id per guide', () => {
    const ids = all.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it('gives every guide a reason, a time and real steps', () => {
    for (const g of all) {
      expect(g.why.length, g.id).toBeGreaterThan(40);
      expect(g.minutes, g.id).toBeGreaterThan(0);
      expect(g.steps.length, g.id).toBeGreaterThanOrEqual(3);
      for (const s of g.steps) expect(s.body.length, `${g.id}/${s.title}`).toBeGreaterThan(20);
    }
  });

  it('files every guide under a known area, and every area has guides', () => {
    const areas = GUIDE_AREAS.map((a) => a.id);
    for (const g of all) expect(areas, g.id).toContain(g.area);
    for (const a of areas) expect(guidesByArea(a).length, a).toBeGreaterThan(0);
  });

  it('only points at guides that exist', () => {
    for (const g of all) for (const r of g.related ?? []) expect(guideById(r), `${g.id} to ${r}`).toBeDefined();
    for (const [rec, id] of Object.entries(GUIDE_FOR_RECOMMENDATION)) expect(guideById(id), `${rec} to ${id}`).toBeDefined();
  });

  it('declares every placeholder it uses, and uses every one it declares', () => {
    for (const g of all) {
      const used = new Set<string>();
      for (const t of texts(g)) for (const m of t.matchAll(/\{\{(\w+)\}\}/g)) used.add(m[1]);
      const declared = new Set((g.vars ?? []).map((v) => v.key));
      for (const u of used) expect(declared, `${g.id} uses {{${u}}}`).toContain(u);
      for (const d of declared) expect([...used], `${g.id} declares ${d}`).toContain(d);
    }
  });

  it('links only over https, and labels every link', () => {
    for (const g of all) {
      for (const s of g.steps) {
        for (const l of [s.link, ...(s.choices ?? []).map((c) => c.link)]) {
          if (!l) continue;
          expect(l.href, g.id).toMatch(/^https:\/\//);
          expect(l.label.length, g.id).toBeGreaterThan(3);
        }
      }
      for (const t of texts(g)) for (const m of t.matchAll(/\]\(([^)]+)\)/g)) expect(m[1], g.id).toMatch(/^https:\/\//);
    }
  });

  it('closes every inline marker', () => {
    for (const g of all) {
      for (const t of texts(g)) {
        expect((t.match(/\*\*/g) ?? []).length % 2, `${g.id}: ${t}`).toBe(0);
        expect((t.match(/`/g) ?? []).length % 2, `${g.id}: ${t}`).toBe(0);
      }
    }
  });

  it('keeps the house copy rules (no exclamation marks, no straight apostrophes in prose)', () => {
    for (const g of all) for (const t of texts(g)) expect(t, g.id).not.toMatch(/!/);
  });
});

describe('fillText', () => {
  const g = guideById('dns-txt-record')!;
  it("uses the caller's value", () => {
    expect(fillText('Add it to {{domain}}', g, { domain: 'techand.ai' })).toBe('Add it to techand.ai');
  });
  it('falls back to the declared example', () => {
    expect(fillText('Add it to {{domain}}', g, {})).toBe('Add it to your-domain.com');
    expect(fillText('Add it to {{domain}}', g, { domain: '  ' })).toBe('Add it to your-domain.com');
  });
  it('leaves an unknown placeholder alone', () => {
    expect(fillText('{{nope}}', g, {})).toBe('{{nope}}');
  });
});

describe('fillGuide', () => {
  const g = guideById('dns-txt-record')!;
  it('fills the steps, the copy values and the troubleshooting', () => {
    const f = fillGuide(g, { domain: 'techand.ai', dnsHost: 'techand.ai', dnsValue: 'seo-agent-verification=xyz' });
    const value = f.steps.flatMap((s) => s.copy ?? []).find((c) => c.label.startsWith('Value'));
    expect(value?.value).toBe('seo-agent-verification=xyz');
    expect(value?.example).toBeUndefined();
    expect(f.missing).toEqual([]);
    expect(JSON.stringify(f.trouble)).toContain('techand.ai');
  });
  it('marks a copy value that is still an example, and names what is missing', () => {
    const f = fillGuide(g, { domain: 'techand.ai' });
    const value = f.steps.flatMap((s) => s.copy ?? []).find((c) => c.label.startsWith('Value'));
    expect(value?.example).toBe(true);
    expect(f.missing).toEqual(['dnsHost', 'dnsValue']);
  });
  it('leaves a guide without placeholders untouched', () => {
    const plain = guideById('invite-team')!;
    expect(fillGuide(plain, {}).steps.map((s) => s.body)).toEqual(plain.steps.map((s) => s.body));
  });
});

describe('plainText', () => {
  it('drops the markers and keeps the link address', () => {
    expect(plainText('Click **Add user**, paste `abc` and open [DNS](https://dnschecker.org)')).toBe('Click Add user, paste abc and open DNS (https://dnschecker.org)');
  });
});

describe('guideText', () => {
  const text = guideText(guideById('dns-txt-record')!, { domain: 'techand.ai', dnsHost: 'techand.ai', dnsValue: 'seo-agent-verification=xyz' });
  it('numbers the steps and carries the values to paste', () => {
    expect(text).toContain('1. Find where your DNS is managed');
    expect(text).toContain('Value / content: seo-agent-verification=xyz');
    expect(text).toContain('Type: TXT');
  });
  it('is readable on its own: no markup, no unfilled placeholder', () => {
    expect(text).not.toMatch(/\*\*|\{\{/);
    expect(text).toContain('Where: Your domain registrar or DNS provider');
    expect(text).toContain('If it does not work');
  });
});

describe('searchGuides', () => {
  it('finds a guide by its title and by its keywords', () => {
    expect(searchGuides('dns').map((g) => g.id)).toContain('dns-txt-record');
    expect(searchGuides('app password').map((g) => g.id)).toContain('gmail-app-password');
    expect(searchGuides('cloudflare').map((g) => g.id)).toContain('dns-txt-record');
  });
  it('ranks a title match first', () => {
    expect(searchGuides('indexnow')[0].id).toBe('indexnow-key-file');
  });
  it('returns everything for an empty query and nothing for nonsense', () => {
    expect(searchGuides('  ').length).toBe(GUIDES.length);
    expect(searchGuides('zzzqqq')).toEqual([]);
  });
  it('needs every word, at the start of a word', () => {
    // "app" must not match "happens" / "appear", and a guide missing one of the words is out
    const ids = searchGuides('app password').map((g) => g.id);
    expect(ids).toContain('gmail-app-password');
    expect(ids).not.toContain('fix-pack');
    expect(ids).not.toContain('indexnow-key-file');
    expect(searchGuides('dns record').map((g) => g.id)).toContain('dns-txt-record');
    expect(searchGuides('search console links').map((g) => g.id)).toEqual(['search-console-links-export']);
  });
});

describe('D-9: only the ways this installation offers', () => {
  it('the Google sign-in guide is not offered without Google sign-in; DNS and the meta tag always are', () => {
    const off = { googleSignIn: false };
    expect(guideAvailable(guideById('search-console-owner'), off)).toBe(false);
    expect(guideAvailable(guideById('search-console-owner'), { googleSignIn: true })).toBe(true);
    // the DNS guide's "Next, or instead" on an installation with google: false (2026-10-17) offers the meta tag only
    expect((guideById('dns-txt-record')?.related ?? []).filter((id) => guideAvailable(guideById(id), off))).toEqual(['meta-tag']);
    expect((guideById('meta-tag')?.related ?? []).filter((id) => guideAvailable(guideById(id), off))).toEqual(['dns-txt-record']);
  });

  it('every guide that walks through "Verify with Google" says it needs Google sign-in', () => {
    for (const g of all) if (texts(g).some((t) => /Verify with Google/.test(t))) expect(g.requires, g.id).toBe('google_signin');
  });
});

describe('copy rules (no AI tells in customer text)', () => {
  // the owner's rule of 2026-10-19: no em or en dashes, no curly quotes, no ellipsis character, no stock phrases, no internal names
  const STOCK = /\b(delve|seamless(ly)?|leverage|unlock the power|game[- ]changer|in today's|elevate|supercharge|cutting[- ]edge|robust solution|it's important to note|whether you're)\b/i;
  const INTERNAL = /\b(seo_[a-z_]+|cycle_preview|n8n|dataforseo|chosen_by|autopilot_level|pages_per_week|Cadence_Plan|Data Table)\b/i;
  it('holds for every guide', () => {
    for (const g of all) {
      for (const t of [...texts(g), g.where ?? '', g.who ?? '']) {
        expect(t, g.id).not.toMatch(/[–—‘’“”…]/);
        expect(t, g.id).not.toMatch(STOCK);
      }
    }
  });
  it('the weekly autopilot guides never name an internal table, field or service', () => {
    for (const g of guidesByArea('autopilot')) for (const t of [...texts(g), g.where ?? '', g.who ?? '']) expect(t, g.id).not.toMatch(INTERNAL);
  });
});

describe('the weekly autopilot guides', () => {
  const ids = ['your-journey', 'choose-first-keyword', 'autopilot-levels', 'your-weekly-cycle', 'coming-up-plan', 'keyword-announcements', 'keyword-not-planned', 'page-not-ready', 'not-what-i-wanted'];
  it('exist, each with steps, how to tell it worked, what to do when it does not, related guides and search words', () => {
    for (const id of ids) {
      const g = guideById(id);
      expect(g, id).toBeDefined();
      expect(g!.area, id).toBe('autopilot');
      expect(g!.done, id).toBeTruthy();
      expect(g!.trouble?.length, id).toBeGreaterThan(0);
      expect(g!.related?.length, id).toBeGreaterThan(0);
      expect(g!.keywords?.length, id).toBeGreaterThan(0);
    }
  });

  it('take their numbers from the cycle contract, not from typed-in figures', () => {
    const t = (id: string) => guideText(guideById(id)!);
    expect(t('coming-up-plan')).toContain(`${PREVIEW_HOURS_BEFORE} hours before every weekly run`);
    expect(t('keyword-announcements')).toContain(`${PROPOSAL_WAIT_HOURS} hours after the announcement`);
    expect(t('autopilot-levels')).toContain(`${REJECT_LIMIT} of the last ${REJECT_WINDOW} pages`);
    expect(t('autopilot-levels')).toContain(`after ${NUDGE_AFTER_PAGES} pages published or approved`);
    expect(t('keyword-not-planned')).toContain(`more than ${QUEUED_RECHECK_DAYS} days`);
    expect(t('your-weekly-cycle')).toContain(`at least ${CYCLE_SPACING_DAYS} days after the last one started`);
    expect(t('your-weekly-cycle')).toContain(CYCLE_LOCAL_TIME);
    for (const l of AUTOPILOT_LEVELS) expect(t('autopilot-levels')).toContain(l.label);
    for (const w of new Set(Object.values(CHANCE_WORDS))) expect(t('choose-first-keyword')).toContain(w);
  });

  it("read as whole sentences with no values (the catalogue) and with the website's own values", () => {
    const vars = { domain: 'kf.example.com', weekday: 'Tuesday', timezone: 'Asia/Dubai', monthlyDate: 'day 20 of the month', level: 'level 2 (My keywords and keep my pages healthy)', pageCredits: 'about 51 credits', planCredits: 'about 16 credits', checkCredits: 'about 2 credits' };
    for (const id of ids) {
      expect(guideText(guideById(id)!), id).not.toMatch(/\{\{|\}\}/);
      expect(guideText(guideById(id)!, vars), id).not.toMatch(/\{\{|\}\}/);
    }
    expect(guideText(guideById('your-weekly-cycle')!, vars)).toContain('Tuesday, from 06:00 in Asia/Dubai');
    expect(guideText(guideById('your-journey')!, vars)).toContain('on or after day 20 of the month');
  });

  it('ask for the author profile and business facts before the first page (owner decision 2026-10-20)', () => {
    for (const id of ['your-journey', 'choose-first-keyword', 'page-not-ready']) {
      const t = guideText(guideById(id)!);
      expect(t, id).toMatch(/author profile/);
      expect(t, id).toMatch(/business facts/);
    }
    expect(guideText(guideById('your-journey')!)).toContain('a draft with blanks');
  });

  it('are found by the words a client would type', () => {
    expect(searchGuides('coming up')[0].id).toBe('coming-up-plan');
    expect(searchGuides('what happens when').map((g) => g.id)).toContain('your-journey');
    expect(searchGuides('autopilot level').map((g) => g.id)).toContain('autopilot-levels');
    expect(searchGuides('not ready').map((g) => g.id)).toContain('page-not-ready');
    expect(searchGuides('weekday').map((g) => g.id)).toContain('your-weekly-cycle');
  });
});

describe('every keyword-first ask has a guide', () => {
  // every kind the server builds (services/pipeline.ts, ladders.ts, autopilot.ts)
  const KINDS: NeedsYouItem['kind'][] = ['publish', 'approve', 'overlap', 'duplicate', 'failed', 'connection', 'pileup', 'keyword', 'proposal', 'recheck', 'level', 'profile', 'ai_panel'];
  it('each Needs-you kind maps to a guide that exists', () => {
    expect(Object.keys(GUIDE_FOR_NEEDS_YOU_KIND).sort()).toEqual([...KINDS].sort());
    for (const k of KINDS) expect(guideById(GUIDE_FOR_NEEDS_YOU_KIND[k]), k).toBeDefined();
  });
  it('refines the item by its id: a refused plan, a draft to fix, an announcement, Search Console', () => {
    const at = (id: string, kind: NeedsYouItem['kind'], severity: 'warning' | 'info' = 'info') => guideForNeedsYou({ id, kind, severity });
    expect(at('keyword:first', 'keyword', 'warning')).toBe('choose-first-keyword');
    // P1: the profile the first page waits for, only the facts, and the first page once both are on file
    expect([at('profile:author', 'profile', 'warning'), at('profile:facts', 'profile', 'warning'), at('profile:write-first', 'profile')]).toEqual(['business-profile', 'business-facts', 'coming-up-plan']);
    expect(at('keyword:next', 'keyword')).toBe('choose-first-keyword');
    expect(at('proposal:p1', 'proposal', 'warning')).toBe('keyword-announcements');
    expect(at('proposal:p2', 'proposal', 'info')).toBe('choose-first-keyword');
    expect(at('recheck:lad_1', 'recheck', 'warning')).toBe('keyword-not-planned');
    expect(at('level:dropped', 'level', 'warning')).toBe('autopilot-levels');
    expect(at('level:nudge', 'level')).toBe('autopilot-levels');
    expect(at('refused:rep1', 'failed')).toBe('keyword-not-planned');
    expect(at('fix:lad_1', 'failed', 'warning')).toBe('page-not-ready');
    expect(at('failed:run1', 'failed', 'warning')).toBe('your-journey');
    expect(at('publish:lad_1', 'publish')).toBe('publish-page');
    expect(at('connection:gsc', 'connection', 'warning')).toBe('search-console-access');
  });
  it('each new screen names a guide that exists in the weekly autopilot area', () => {
    for (const [screen, id] of Object.entries(AUTOPILOT_SCREEN_GUIDES)) {
      expect(guideById(id), screen).toBeDefined();
      expect(guideById(id)!.area, screen).toBe('autopilot');
    }
  });
  it('recommendations find their guide by id or by prefix', () => {
    expect(guideForRecommendation('keyword:first')).toBe('choose-first-keyword');
    expect(guideForRecommendation('keyword:research')).toBe('choose-first-keyword');
    expect(guideForRecommendation('content:fix:payroll software uae')).toBe('page-not-ready');
    expect(guideForRecommendation('content:publish:payroll software uae')).toBe('publish-page');
    expect(guideForRecommendation('setup:gsc')).toBe('search-console-access');
    expect(guideForRecommendation('tech:score-drop')).toBeUndefined();
  });
});
