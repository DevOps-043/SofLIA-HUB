import { useState, useEffect } from 'react';

export type ThemeMode = 'system' | 'light' | 'dark';

export function useTheme() {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('sofLia_theme') as ThemeMode) || 'system';
    }
    return 'system';
  });

  const setTheme = (newTheme: ThemeMode) => {
    setThemeState(newTheme);
    if (typeof window !== 'undefined') {
      localStorage.setItem('sofLia_theme', newTheme);
      if (window.computerUse?.setTheme) {
        window.computerUse.setTheme(newTheme).catch((err) => {
          console.error('Error writing theme to backend config:', err);
        });
      }
    }
  };

  useEffect(() => {
    const loadThemeFromBackend = async () => {
      try {
        if (window.computerUse?.getTheme) {
          const storedTheme = await window.computerUse.getTheme();
          if (storedTheme === 'system' || storedTheme === 'light' || storedTheme === 'dark') {
            setThemeState(storedTheme);
            localStorage.setItem('sofLia_theme', storedTheme);
          }
        }
      } catch (err) {
        console.error('Error loading theme from backend config:', err);
      }
    };
    loadThemeFromBackend();
  }, []);

  useEffect(() => {
    const root = window.document.documentElement;

    const applyTheme = (themeValue: ThemeMode) => {
      root.classList.remove('light', 'dark');

      if (themeValue === 'system') {
        const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light';
        root.classList.add(systemTheme);
      } else {
        root.classList.add(themeValue);
      }
    };

    applyTheme(theme);

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemChange = () => {
      if (theme === 'system') {
        applyTheme('system');
      }
    };

    mediaQuery.addEventListener('change', handleSystemChange);
    return () => mediaQuery.removeEventListener('change', handleSystemChange);
  }, [theme]);

  return { theme, setTheme };
}
