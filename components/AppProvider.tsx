import { ReactNode, useEffect, useState } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { AppContext, type AppConfig, type AppContextType, type Theme } from '@/contexts/AppContext';

interface AppProviderProps {
  children: ReactNode;
  /** Application storage key */
  storageKey: string;
  /** Default app configuration */
  defaultConfig: AppConfig;
  /** Optional list of preset relays to display in the RelaySelector */
  presetRelays?: { name: string; url: string }[];
}

export function AppProvider(props: AppProviderProps) {
  const {
    children,
    storageKey,
    defaultConfig,
    presetRelays,
  } = props;

  // For SSR safety, initially use the default config
  const [isClient, setIsClient] = useState(false);
  
  useEffect(() => {
    setIsClient(true);
  }, []);

  // App configuration state with localStorage persistence (only used on client)
  const [config, setConfig] = useLocalStorage<AppConfig>(storageKey, defaultConfig);

  // Generic config updater with callback pattern
  const updateConfig = (updater: (currentConfig: AppConfig) => AppConfig) => {
    if (isClient) {
      setConfig(updater);
    }
  };

  // Use the current config (from localStorage on client, defaultConfig on server)
  const currentConfig = isClient ? config : defaultConfig;

  const appContextValue: AppContextType = {
    config: currentConfig,
    updateConfig,
    presetRelays,
  };

  return (
    <AppContext.Provider value={appContextValue}>
      {isClient && <ThemeApplier theme={currentConfig.theme} />}
      {children}
    </AppContext.Provider>
  );
}

/**
 * Separate component to handle theme application (client-side only)
 */
function ThemeApplier({ theme }: { theme: Theme }) {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const root = window.document.documentElement;

    root.classList.remove('light', 'dark');

    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)')
        .matches
        ? 'dark'
        : 'light';

      root.classList.add(systemTheme);
      return;
    }

    root.classList.add(theme);
  }, [theme]);

  // Handle system theme changes when theme is set to "system"
  useEffect(() => {
    if (typeof window === 'undefined' || theme !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = () => {
      const root = window.document.documentElement;
      root.classList.remove('light', 'dark');
      
      const systemTheme = mediaQuery.matches ? 'dark' : 'light';
      root.classList.add(systemTheme);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  return null;
}