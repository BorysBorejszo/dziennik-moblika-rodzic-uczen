import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';

type Theme = 'light' | 'dark';

type ThemeContextType = {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light');

  // Load saved theme from AsyncStorage (if available) on mount
  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        // Try dynamic import — may not be installed in the project
        // @ts-ignore: dynamic optional dependency
        const AsyncStorageModule = await import('@react-native-async-storage/async-storage');
        const AsyncStorage = AsyncStorageModule.default ?? AsyncStorageModule;
        const saved = await AsyncStorage.getItem('@app:theme');
        if (mounted && (saved === 'light' || saved === 'dark')) {
          setTheme(saved as Theme);
        }
      } catch {
        // AsyncStorage not installed or failed — ignore and keep default
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  const persistTheme = async (t: Theme) => {
    try {
      // @ts-ignore: dynamic optional dependency
      const AsyncStorageModule = await import('@react-native-async-storage/async-storage');
      const AsyncStorage = AsyncStorageModule.default ?? AsyncStorageModule;
      await AsyncStorage.setItem('@app:theme', t);
    } catch {
      // ignore if AsyncStorage not installed
    }
  };

  // Accept either a Theme or an updater function like React's setState
  const setThemeAndPersist = (tOrUpdater: Theme | ((prev: Theme) => Theme)) => {
    setTheme((prev) => {
      const newT = typeof tOrUpdater === 'function' ? (tOrUpdater as (p: Theme) => Theme)(prev) : tOrUpdater;
      void persistTheme(newT);
      return newT;
    });
  };

  const toggleTheme = () => setThemeAndPersist((t) => (t === 'dark' ? 'light' : 'dark'));

  return (
    <ThemeContext.Provider value={{ theme, setTheme: setThemeAndPersist as (t: Theme) => void, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}

export default ThemeContext;
