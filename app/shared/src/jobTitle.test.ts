import { describe, expect, it } from 'vitest';
import { isPlaceholderJobTitle, PROFILE_CHECKS, profileReadiness, realJobTitle } from './profile';
import { buildN8nPayload, jobTitleOut } from './payload';
import { profileFields, profileInput } from './schemas';

// F-29 (prod review 2026-11-12): an author job title of "User" printed on every byline, in the Person schema and in outreach signatures,
// while the profile check said 100%.
describe('placeholder job titles', () => {
  it('reads "User", role names, "N/A", dashes and form labels as no job title', () => {
    for (const t of ['User', ' user ', 'ADMIN', 'Owner', 'Member', 'N/A', 'n.a.', '-', '--', '...', 'Job title', 'TBD', 'test']) expect(isPlaceholderJobTitle(t)).toBe(true);
  });
  it('keeps real titles, including ones that contain those words', () => {
    for (const t of ['Founder', 'Head of Finance', 'Business Owner', 'Founder and Owner', 'User Research Lead', 'IT Administrator', 'Managing Partner']) {
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
  it('never sends a placeholder; an emptied title next to a name clears the stored one; without a name nothing changes', () => {
    expect(jobTitleOut('Head of Tax', 'Sara Khan')).toBe('Head of Tax');
    expect(jobTitleOut('User', 'Sara Khan')).toBe('-');
    expect(jobTitleOut('User', '')).toBe('-');
    expect(jobTitleOut('', 'Sara Khan')).toBe('-');
    expect(jobTitleOut('', '')).toBe('');
  });
  it('the profile run body carries the cleared title', () => {
    const input = profileInput.parse({ mode: 'profile', siteId: '7a1c2d3e-4f50-4a61-8b72-93a4b5c6d7e8', author: { name: 'Sara Khan', jobTitle: '' }, reviewer: { name: '', jobTitle: '' } });
    const body = buildN8nPayload(input, null, { callbackUrl: 'http://localhost/hook', email: '' }) as { author: { job_title: string }; reviewer: { job_title: string } };
    expect(body.author.job_title).toBe('-');
    expect(body.reviewer.job_title).toBe('');
  });
});
