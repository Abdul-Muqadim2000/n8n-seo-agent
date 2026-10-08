import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

export type ThemeChoice = 'system' | 'light' | 'dark';

const ThemeCtx = createContext<{ theme: ThemeChoice; setTheme: (t: ThemeChoice) => void }>({ theme: 'system', setTheme: () => {} });

function read(): ThemeChoice {
  try {
    const t = localStorage.getItem('theme');
    return t === 'light' || t === 'dark' ? t : 'system';
  } catch {
    return 'system';
  }
}

/** Browser UI colour (<meta name="theme-color">, index.html + public/theme-init.js): brand blue on light, the dark page colour on dark. */
const THEME_COLOR = { light: '#2E4BFF', dark: '#0A0F1F' } as const;

/** An explicit pick sets both media variants of theme-color; "system" puts each variant back to its own scheme. */
function applyThemeColor(theme: ThemeChoice) {
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((m) => {
    const scheme = theme !== 'system' ? theme : /dark/.test(m.media) ? 'dark' : 'light';
    m.content = THEME_COLOR[scheme];
  });
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, set] = useState<ThemeChoice>(read);
  useEffect(() => {
    const el = document.documentElement;
    if (theme === 'system') el.removeAttribute('data-theme');
    else el.setAttribute('data-theme', theme);
    applyThemeColor(theme);
  }, [theme]);
  const setTheme = useCallback((t: ThemeChoice) => {
    set(t);
    try {
      if (t === 'system') localStorage.removeItem('theme');
      else localStorage.setItem('theme', t);
    } catch {
      /* private mode: the choice lasts for this tab */
    }
  }, []);
  return <ThemeCtx.Provider value={{ theme, setTheme }}>{children}</ThemeCtx.Provider>;
}

export const useTheme = () => useContext(ThemeCtx);
