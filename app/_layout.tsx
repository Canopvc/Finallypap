import { useEffect, useState } from "react";
import { Slot, useRouter, useSegments } from "expo-router";
import { supabase } from "../lib/supabase";
import { View, ActivityIndicator, useColorScheme, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Provider as PaperProvider } from 'react-native-paper';
import { getAppTheme } from "../lib/theme";

export default function RootLayout() {
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const segments = useSegments();
  const scheme = useColorScheme();

  useEffect(() => {
    let isMounted = true;

    const redirectBySession = (session: any) => {
      if (!isMounted) return;
      const root = segments[0];

      if (session) {
        // Already authenticated: allow tabs and workout/*
        if (root !== '(tabs)' && root !== 'workout') {
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

  const theme = getAppTheme(scheme);

  useEffect(() => {
    // Match the OS/background to our theme to avoid white flashes/gaps
    SystemUI.setBackgroundColorAsync(theme.colors.background).catch(() => {});
  }, [theme.colors.background]);

  if (isLoading) {
    return (
      <PaperProvider theme={theme}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.background }}>
          <ActivityIndicator size="large" />
        </View>
      </PaperProvider>
    );
  }

  return (
    <PaperProvider theme={theme}>
      <SafeAreaProvider>
        <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} backgroundColor={theme.colors.background} />
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['bottom']}>
          <KeyboardAvoidingView 
            style={{ flex: 1, backgroundColor: theme.colors.background }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
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