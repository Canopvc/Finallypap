import { useEffect, useState, useMemo } from "react";
import { Slot, useRouter, useSegments } from "expo-router";
import { supabase } from "../lib/supabase";
import { View, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Provider as PaperProvider } from 'react-native-paper';
import { getAppTheme } from "../lib/theme";
import { ThemeProvider, useThemeContext } from "../contexts/ThemeContext";
import "../lib/i18n";

function RootLayoutContent() {
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const segments = useSegments();
  const { colorScheme } = useThemeContext();

  useEffect(() => {
    let isMounted = true;

    const redirectBySession = (session: any) => {
      if (!isMounted) return;
      const root = segments[0];

      if (session) {
        // Already authenticated: allow tabs and workout/*
        if (root !== '(tabs)' && root !== 'workout' && root !== 'calorie_tracker') {
          router.replace('/(tabs)');
        }
      } else {
        // Not authenticated: allow only auth screens
        if (root !== 'login' && root !== 'register') {
          router.replace('/login');
        }
      }
    };

    // Initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      redirectBySession(session);
      if (isMounted) setIsLoading(false);
    });

    // Subscribe to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      redirectBySession(session);
    });

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
    };
  }, [segments, router]);

  const theme = useMemo(() => {
    const appTheme = getAppTheme(colorScheme);
    return appTheme;
  }, [colorScheme]);

  useEffect(() => {
    // Match the OS/background to our theme to avoid white flashes/gaps
    SystemUI.setBackgroundColorAsync(theme.colors.background).catch((error) => {
      console.warn('[Theme] Failed to set SystemUI background:', error);
    });

    // Log para debug
    console.log('[Theme] SystemUI background set to:', theme.colors.background);
  }, [theme.colors.background]);

  if (isLoading) {
    return (
      <PaperProvider key={colorScheme} theme={theme}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.background }}>
          <ActivityIndicator size="large" />
        </View>
      </PaperProvider>
    );
  }

  return (
    <PaperProvider key={colorScheme} theme={theme}>
      <SafeAreaProvider>
        <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} backgroundColor={theme.colors.background} />
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['bottom']}>
          <KeyboardAvoidingView
            style={{ flex: 1, backgroundColor: theme.colors.background }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
            enabled={Platform.OS === 'ios'}
          >
            <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
              <Slot />
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </SafeAreaProvider>
    </PaperProvider>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <RootLayoutContent />
    </ThemeProvider>
  );
}