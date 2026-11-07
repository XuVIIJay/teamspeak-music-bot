export type Theme = 'dark' | 'light';
export type ThemePreference = Theme | 'system';

export function readThemePreference(): ThemePreference {
  try {
    const saved = localStorage.getItem('theme');
    return saved === 'dark' || saved === 'light' ? saved : 'system';
  } catch {
    return 'system';
  }
}

export function resolveTheme(preference: ThemePreference, systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches): Theme {
  return preference === 'system' ? (systemDark ? 'dark' : 'light') : preference;
}

export function applyDocumentTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#222222' : '#ffffff');
}

export function observeSystemTheme(onChange: (dark: boolean) => void) {
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const listener = (event: MediaQueryListEvent) => onChange(event.matches);
  media.addEventListener('change', listener);
  return () => media.removeEventListener('change', listener);
}
