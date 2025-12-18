import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Appearance, AppState, ColorSchemeName } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const THEME_PREFERENCE_KEY = '@theme_preference';

type ThemeMode = 'light' | 'dark' | 'automatic';

interface ThemeContextType {
  themeMode: ThemeMode;
  colorScheme: ColorSchemeName;
  setThemeMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeMode, setThemeModeState] = useState<ThemeMode>('automatic');
  const [colorScheme, setColorScheme] = useState<ColorSchemeName>(() => {
    return Appearance.getColorScheme() || 'light';
  });
  
  const appState = useRef(AppState.currentState);
  const schemeRef = useRef(colorScheme);

  // Carrega preferência salva
  useEffect(() => {
    const loadThemePreference = async () => {
      try {
        const saved = await AsyncStorage.getItem(THEME_PREFERENCE_KEY);
        if (saved && (saved === 'light' || saved === 'dark' || saved === 'automatic')) {
          setThemeModeState(saved as ThemeMode);
          console.log('[ThemeContext] Loaded saved preference:', saved);
        }
      } catch (error) {
        console.error('[ThemeContext] Error loading theme preference:', error);
      }
    };
    loadThemePreference();
  }, []);

  // Salva preferência quando muda
  useEffect(() => {
    const saveThemePreference = async () => {
      try {
        await AsyncStorage.setItem(THEME_PREFERENCE_KEY, themeMode);
        console.log('[ThemeContext] Saved theme preference:', themeMode);
      } catch (error) {
        console.error('[ThemeContext] Error saving theme preference:', error);
      }
    };
    saveThemePreference();
  }, [themeMode]);

  // Atualiza ref quando colorScheme muda
  useEffect(() => {
    schemeRef.current = colorScheme;
  }, [colorScheme]);

  // Função para obter scheme atual do sistema
  const getSystemScheme = (): ColorSchemeName => {
    try {
      const systemScheme = Appearance.getColorScheme();
      return systemScheme || 'light';
    } catch (error) {
      console.error('[ThemeContext] Error getting system scheme:', error);
      return 'light';
    }
  };

  // Calcula o scheme final baseado no modo
  const calculateFinalScheme = (): ColorSchemeName => {
    if (themeMode === 'automatic') {
      return getSystemScheme();
    }
    return themeMode;
  };

  // Listener para mudanças de tema do sistema (apenas se modo automático)
  useEffect(() => {
    if (themeMode !== 'automatic') {
      // Se não está em modo automático, usa o valor fixo
      const finalScheme = calculateFinalScheme();
      if (schemeRef.current !== finalScheme) {
        console.log('[ThemeContext] Theme mode is manual, setting to:', finalScheme);
        setColorScheme(finalScheme);
      }
      return;
    }

    console.log('[ThemeContext] Setting up Appearance listener (automatic mode)');
    
    const subscription = Appearance.addChangeListener(({ colorScheme: newScheme }) => {
      const finalScheme = newScheme || 'light';
      console.log('[ThemeContext] Appearance changed to:', finalScheme);
      if (schemeRef.current !== finalScheme) {
        setColorScheme(finalScheme);
      }
    });

    // Inicializa com o valor atual
    const currentScheme = getSystemScheme();
    if (schemeRef.current !== currentScheme) {
      setColorScheme(currentScheme);
    }

    return () => {
      console.log('[ThemeContext] Removing Appearance listener');
      subscription.remove();
    };
  }, [themeMode]);

  // AppState listener para re-verificar quando app volta ao foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active' &&
        themeMode === 'automatic'
      ) {
        const currentScheme = getSystemScheme();
        console.log('[ThemeContext] App became active, checking scheme:', currentScheme);
        if (schemeRef.current !== currentScheme) {
          setColorScheme(currentScheme);
        }
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [themeMode]);

  // Polling agressivo para Expo Go (apenas em modo automático)
  useEffect(() => {
    if (themeMode !== 'automatic') {
      return;
    }

    let intervalId: NodeJS.Timeout | null = null;
    
    const startPolling = () => {
      intervalId = setInterval(() => {
        if (AppState.currentState === 'active') {
          const currentScheme = getSystemScheme();
          if (schemeRef.current !== currentScheme) {
            console.log('[ThemeContext] ⚡ Polling detected change:', schemeRef.current, '->', currentScheme);
            setColorScheme(currentScheme);
          }
        }
      }, 500);
    };

    startPolling();
    console.log('[ThemeContext] Started polling (automatic mode)');

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [themeMode]);

  // Atualiza colorScheme quando themeMode muda
  useEffect(() => {
    const finalScheme = calculateFinalScheme();
    if (schemeRef.current !== finalScheme) {
      console.log('[ThemeContext] Theme mode changed, updating scheme to:', finalScheme);
      setColorScheme(finalScheme);
    }
  }, [themeMode]);

  const setThemeMode = (mode: ThemeMode) => {
    console.log('[ThemeContext] Setting theme mode to:', mode);
    setThemeModeState(mode);
  };

  return (
    <ThemeContext.Provider value={{ themeMode, colorScheme, setThemeMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useThemeContext() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useThemeContext must be used within a ThemeProvider');
  }
  return context;
}

