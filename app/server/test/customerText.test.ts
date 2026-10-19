import { describe, expect, it, vi } from 'vitest';

// D-12 (re-rating 2026-10-17): the MCP server introduced itself as "Dev SEO, Rerate 1017 Trading" (`serverInfo.title` from
// SEO_BRAND, the engine's report brand in n8n/.env, default "Dev SEO"). What the app says about itself uses the product's name.

describe('D-12: the app names itself, whatever the engine brand is', () => {
  it('config.brand is the product name even with SEO_BRAND=Dev SEO', async () => {
    vi.resetModules();
    process.env.SEO_BRAND = 'Dev SEO';
    const { config } = await import('../src/config');
    expect(config.brand).toBe('Alaventra');
    delete process.env.SEO_BRAND;
    vi.resetModules();
  });
});
