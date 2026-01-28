import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { ThemeProvider as EmotionThemeProvider } from '@emotion/react';
import { useSettingsStore, selectEffectiveTheme } from '../stores/settingsStore';
import { darkTheme, lightTheme, type Theme } from '../styles/theme';

interface ThemeContextValue {
  theme: 'dark' | 'light';
  themeObject: Theme;
  toggleTheme: () => void;
  setTheme: (theme: 'dark' | 'light' | 'system') => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const themeSetting = useSettingsStore((s) => s.theme);
  const setThemeSetting = useSettingsStore((s) => s.setTheme);

  // Get effective theme (resolving 'system')
  const effectiveTheme = useSettingsStore(selectEffectiveTheme);

  // Get the actual theme object
  const themeObject = useMemo(
    () => (effectiveTheme === 'light' ? lightTheme : darkTheme),
    [effectiveTheme]
  );

  // Toggle between dark and light
  const toggleTheme = () => {
    setThemeSetting(effectiveTheme === 'dark' ? 'light' : 'dark');
  };

  // Listen for system theme changes when using 'system' mode
  useEffect(() => {
    if (themeSetting !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      // Force re-render by triggering a state update
      // The selectEffectiveTheme selector will re-evaluate
      useSettingsStore.setState({});
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [themeSetting]);

  // Update document with theme class for CSS variables if needed
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', effectiveTheme);
    document.documentElement.style.colorScheme = effectiveTheme;
  }, [effectiveTheme]);

  const value = useMemo(
    () => ({
      theme: effectiveTheme,
      themeObject,
      toggleTheme,
      setTheme: setThemeSetting,
    }),
    [effectiveTheme, themeObject, setThemeSetting]
  );

  return (
    <ThemeContext.Provider value={value}>
      <EmotionThemeProvider theme={themeObject}>{children}</EmotionThemeProvider>
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

// Hook to get current theme object (for components that don't use Emotion's useTheme)
export function useThemeObject(): Theme {
  const context = useContext(ThemeContext);
  if (!context) {
    // Fallback to dark theme if not in provider
    return darkTheme;
  }
  return context.themeObject;
}
