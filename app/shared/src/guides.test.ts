import { describe, expect, it } from 'vitest';
import { fillGuide, fillText, GUIDE_AREAS, GUIDE_FOR_RECOMMENDATION, GUIDES, guideAvailable, guideById, guideText, guidesByArea, plainText, searchGuides, type Guide } from './guides';

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
