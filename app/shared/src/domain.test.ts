import { describe, expect, it } from 'vitest';
import { engineIdCollides, engineRowIsDomain, n8nSiteId, registrableDomain } from './domain';

// The engine stores a website under `site_` + its domain with every non-alphanumeric run as `-`, so two different domains can share an id.
// The app keeps the second one out and checks every engine row by its domain (server/src/services/engineSite.ts).

describe('engine site ids', () => {
  it('foo.co.uk and foo-co.uk share one engine id: a collision, both ways', () => {
    expect(n8nSiteId('foo.co.uk')).toBe(n8nSiteId('foo-co.uk'));
    expect(engineIdCollides('foo.co.uk', 'foo-co.uk')).toBe(true);
    expect(engineIdCollides('foo-co.uk', 'foo.co.uk')).toBe(true);
    expect(engineIdCollides('foo.co.uk', 'www.foo.co.uk')).toBe(false); // the same website is not a collision
    expect(engineIdCollides('foo.co.uk', 'bar.co.uk')).toBe(false);
    expect(engineIdCollides('', 'foo.co.uk')).toBe(false);
  });

  it('an engine row is the domain\'s only when its domain column names it (an empty domain proves nothing)', () => {
    expect(engineRowIsDomain('foo.co.uk', 'foo.co.uk')).toBe(true);
    expect(engineRowIsDomain('www.Foo.co.uk', 'foo.co.uk')).toBe(true);
    expect(engineRowIsDomain('foo-co.uk', 'foo.co.uk')).toBe(false);
    expect(engineRowIsDomain('', 'foo.co.uk')).toBe(false);
    expect(engineRowIsDomain(undefined, 'foo.co.uk')).toBe(false);
  });
});

describe('registrable domain (the engine rule)', () => {
  it('subdomains share their registrable domain; country codes with a common second level keep three labels', () => {
    expect(registrableDomain('blog.example.com')).toBe('example.com');
    expect(registrableDomain('shop.eu.example.com')).toBe('example.com');
    expect(registrableDomain('example.com')).toBe('example.com');
    expect(registrableDomain('www.example.com')).toBe('example.com');
    expect(registrableDomain('shop.example.co.uk')).toBe('example.co.uk');
    expect(registrableDomain('example.co.uk')).toBe('example.co.uk');
    expect(registrableDomain('a.example.com.au')).toBe('example.com.au');
  });

  it('on a hosting platform every subdomain is its own website', () => {
    expect(registrableDomain('mybakery.wixsite.com')).toBe('mybakery.wixsite.com');
    expect(registrableDomain('team.github.io')).toBe('team.github.io');
  });
});
