import { afterEach, describe, expect, it, vi } from 'vitest';
import { observeSystemTheme, readThemePreference, resolveTheme } from './theme.js';

afterEach(() => vi.unstubAllGlobals());
describe('theme preferences', () => {
  it('defaults to system and preserves existing explicit choices', () => {
    for (const [saved, expected] of [[null, 'system'], ['invalid', 'system'], ['system', 'system'], ['dark', 'dark'], ['light', 'light']]) {
      vi.stubGlobal('localStorage', { getItem: () => saved });
      expect(readThemePreference()).toBe(expected);
    }
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('blocked'); } });
    expect(readThemePreference()).toBe('system');
  });
  it('follows the browser preference while keeping manual overrides', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });
  it('receives live system changes and removes its listener on cleanup', () => {
    const media = new EventTarget();
    const matchMedia = vi.fn(() => media);
    vi.stubGlobal('window', { matchMedia });
    const onChange = vi.fn();
    const stop = observeSystemTheme(onChange);
    expect(matchMedia).toHaveBeenCalledWith('(prefers-color-scheme: dark)');
    media.dispatchEvent(Object.assign(new Event('change'), { matches: true }));
    media.dispatchEvent(Object.assign(new Event('change'), { matches: false }));
    expect(onChange.mock.calls).toEqual([[true], [false]]);
    stop();
    media.dispatchEvent(Object.assign(new Event('change'), { matches: true }));
    expect(onChange).toHaveBeenCalledTimes(2);
  });
});
