'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

/**
 * Gestion du theme clair / sombre.
 *
 * La classe `.dark` est posee sur <html> par un script inline (voir
 * `ThemeScript`) execute AVANT le premier rendu : c'est ce qui evite le flash
 * blanc au chargement d'une page en mode sombre.
 */

export type Theme = 'dark' | 'light' | 'system';

const STORAGE_KEY = 'lifeofm-theme';

interface ThemeValue {
  theme: Theme;
  resolved: 'dark' | 'light';
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeValue | null>(null);

function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function applyTheme(theme: Theme): 'dark' | 'light' {
  const resolved = theme === 'system' ? (systemPrefersDark() ? 'dark' : 'light') : theme;
  document.documentElement.classList.toggle('dark', resolved === 'dark');
  document.documentElement.style.colorScheme = resolved;
  return resolved;
}

export function ThemeProvider({ initialTheme = 'dark', children }: { initialTheme?: Theme; children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(initialTheme);
  const [resolved, setResolved] = useState<'dark' | 'light'>(initialTheme === 'light' ? 'light' : 'dark');

  useEffect(() => {
    setResolved(applyTheme(theme));
    window.localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  // En mode « systeme », on suit les changements de preference en direct.
  useEffect(() => {
    if (theme !== 'system') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setResolved(applyTheme('system'));
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [theme]);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    // Persistance cote serveur, sans bloquer l'interface.
    void fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ theme: next }),
    }).catch(() => undefined);
  }, []);

  return <ThemeContext.Provider value={{ theme, resolved, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme doit etre utilise a l\'interieur de <ThemeProvider>.');
  return context;
}

/**
 * Script anti-flash, injecte dans le <head>.
 * Il lit la preference stockee et applique la classe avant la peinture.
 */
export function ThemeScript({ serverTheme = 'dark' }: { serverTheme?: Theme }) {
  const code = `
(function(){
  try{
    var stored = localStorage.getItem('${STORAGE_KEY}') || '${serverTheme}';
    var dark = stored === 'dark' || (stored === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', dark);
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  }catch(e){
    document.documentElement.classList.add('dark');
  }
})();`;
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
