import { useEffect, useState } from 'react';
import type { ThemeChoice } from './portal-config.js';

const storageKey = 'platform.portal.theme';

function resolvedTheme(choice: ThemeChoice): 'light' | 'dark' {
  if (choice !== 'system') return choice;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function useTheme(defaultTheme: ThemeChoice) {
  const [theme, setTheme] = useState<ThemeChoice>(() => {
    const stored = window.localStorage.getItem(storageKey);
    return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : defaultTheme;
  });

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      document.documentElement.dataset.theme = resolvedTheme(theme);
      document.documentElement.style.colorScheme = resolvedTheme(theme);
    };
    apply();
    window.localStorage.setItem(storageKey, theme);
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);

  return { theme, setTheme };
}
