import { describe, expect, it, vi, afterEach } from 'vitest';
import { accentTokens, DEFAULT_ACCENT, normalizeAccent, readGuestAccent, saveGuestAccent } from './accent.js';

afterEach(() => vi.unstubAllGlobals());

describe('accent preferences', () => {
  it('normalizes hex values and rejects invalid saved input', () => {
    expect(normalizeAccent(' #AbC ')).toBe('#aabbcc');
    expect(normalizeAccent('#8B5CF6')).toBe('#8b5cf6');
    expect(normalizeAccent('url(example)')).toBeNull();
    expect(accentTokens('invalid')['--color-primary']).toBe(DEFAULT_ACCENT);
  });

  it('keeps button text readable for light and dark custom colors', () => {
    expect(accentTokens('#ffffff')['--color-on-primary']).toBe('#000000');
    expect(accentTokens('#000000')['--color-on-primary']).toBe('#ffffff');
    expect(accentTokens('#8b5cf6')['--color-primary-12']).toBe('rgba(139, 92, 246, 0.12)');
  });

  it('restores guest colors from a cookie and scopes persistence to the site', () => {
    const doc = { cookie: 'other=value; tsmb_accent=#8b5cf6' };
    vi.stubGlobal('document', doc);
    vi.stubGlobal('location', { protocol: 'https:' });
    expect(readGuestAccent()).toBe('#8b5cf6');
    saveGuestAccent('#0891b2');
    expect(doc.cookie).toBe('tsmb_accent=#0891b2; Path=/; Max-Age=31536000; SameSite=Lax; Secure');
    doc.cookie = 'tsmb_accent=invalid';
    expect(readGuestAccent()).toBe(DEFAULT_ACCENT);
  });
});
