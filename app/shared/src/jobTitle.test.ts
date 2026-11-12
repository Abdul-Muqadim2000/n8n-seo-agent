import { describe, expect, it } from 'vitest';
import { isPlaceholderJobTitle, PROFILE_CHECKS, profileReadiness, realJobTitle } from './profile';
import { buildN8nPayload, jobTitleOut } from './payload';
import { profileFields, profileInput } from './schemas';

// F-29 (prod review 2026-11-12): an author job title of "User" printed on every byline, in the Person schema and in outreach signatures,
// while the profile check said 100%.
describe('placeholder job titles', () => {
  it('reads "User", role names, "N/A", dashes and form labels as no job title', () => {
    for (const t of ['User', ' user ', 'ADMIN', 'Member', 'N/A', 'n.a.', '-', '--', '...', 'Job title', 'TBD', 'test', 'none']) expect(isPlaceholderJobTitle(t)).toBe(true);
  });
  it('keeps real titles, including ones that contain those words', () => {
    // review S7: "Owner", "Administrator" and "Tester" are real titles
    for (const t of ['Founder', 'Head of Finance', 'Owner', 'Administrator', 'Tester', 'Business Owner', 'Founder and Owner', 'User Research Lead', 'IT Administrator', 'Managing Partner']) {
      expect(isPlaceholderJobTitle(t)).toBe(false);
      expect(realJobTitle(t)).toBe(t);
    }
  });
  it('an empty title is missing, not a placeholder', () => {
    expect(isPlaceholderJobTitle('')).toBe(false);
    expect(realJobTitle('User')).toBe('');
  });
  it('the profile checklist counts a placeholder title as missing', () => {
    const check = PROFILE_CHECKS.find((c) => c.label === 'Author job title')!;
    expect(check.done({ author: { jobTitle: 'User' } })).toBe(false);
    expect(check.done({ author: { jobTitle: 'Head of Tax' } })).toBe(true);
    expect(profileReadiness({ author: { name: 'Sara Khan', jobTitle: 'User' } }).missing).toContain('Author job title');
  });
});

describe('the profile form and the engine body', () => {
  it('the form refuses a placeholder title with a message and accepts an empty one', () => {
    const r = profileFields.safeParse({ author: { name: 'Sara Khan', jobTitle: 'User' } });
    expect(r.success).toBe(false);
    expect(JSON.stringify(r.error?.issues)).toContain('Founder or Head of Finance');
    expect(profileFields.safeParse({ author: { name: 'Sara Khan', jobTitle: '' } }).success).toBe(true);
    expect(profileFields.safeParse({ reviewer: { name: 'Omar Ali', jobTitle: 'admin' } }).success).toBe(false);
  });
  it('never sends a placeholder; an emptied title clears the stored one only from the form (clearEmpty), never without a name', () => {
    expect(jobTitleOut('Head of Tax', 'Sara Khan')).toBe('Head of Tax');
    expect(jobTitleOut('User', 'Sara Khan')).toBe('-');
    expect(jobTitleOut('User', '')).toBe('-');
    expect(jobTitleOut('', 'Sara Khan')).toBe('');
    expect(jobTitleOut('', 'Sara Khan', true)).toBe('-');
    expect(jobTitleOut('', '', true)).toBe('');
  });
  it('the form clears an emptied title; an API caller that leaves the flag out keeps the stored one (review S8)', () => {
    const base = { mode: 'profile', siteId: '7a1c2d3e-4f50-4a61-8b72-93a4b5c6d7e8', author: { name: 'Sara Khan', jobTitle: '' }, reviewer: { name: '', jobTitle: '' } };
    const bodyOf = (v: Record<string, unknown>) => buildN8nPayload(profileInput.parse(v), null, { callbackUrl: 'http://localhost/hook', email: '' }) as { author: { job_title: string }; reviewer: { job_title: string } };
    expect(bodyOf({ ...base, clearEmptyTitles: true }).author.job_title).toBe('-');
    expect(bodyOf({ ...base, clearEmptyTitles: true }).reviewer.job_title).toBe('');
    expect(bodyOf(base).author.job_title).toBe('');
  });
});
