import { Tabs } from 'expo-router';
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Platform, useColorScheme, Keyboard } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Provider as PaperProvider, MD3DarkTheme, MD3LightTheme } from 'react-native-paper';
import type { BottomTabNavigationOptions } from '@react-navigation/bottom-tabs';

export default function TabLayout() {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);
  const keyboardTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Usar keyboardDidShow e keyboardDidHide para Android
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const keyboardDidShowListener = Keyboard.addListener(
      showEvent,
      () => {
        // Limpar timeout anterior se existir
        if (keyboardTimeoutRef.current) {
          clearTimeout(keyboardTimeoutRef.current);
        }
        setKeyboardVisible(true);
      }
    );

    const keyboardDidHideListener = Keyboard.addListener(
      hideEvent,
      () => {
        // Limpar timeout anterior se existir
        if (keyboardTimeoutRef.current) {
          clearTimeout(keyboardTimeoutRef.current);
        }
        // Delay pequeno para garantir que o layout foi recalculado
        keyboardTimeoutRef.current = setTimeout(() => {
          setKeyboardVisible(false);
        }, 100);
      }
    );

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
      if (keyboardTimeoutRef.current) {
        clearTimeout(keyboardTimeoutRef.current);
      }
    };
  }, []);

  const theme = useMemo(() => (isDark ? {
    ...MD3DarkTheme,
    colors: {
      ...MD3DarkTheme.colors,
      primary: '#64aef3ff',
      background: '#0f172a',
      surface: '#1e293b',
      onSurface: '#f9fafb',
      onPrimary: '#000000',
      primaryContainer: '#2C8EC9',
      onPrimaryContainer: '#72c6faff',
    },
  } : {
    ...MD3LightTheme,
    colors: {
      ...MD3LightTheme.colors,
      primary: '#2C8EC9',
      background: '#f8fafc',
      surface: '#fff',
      onSurface: '#1e293b',
    },
  }), [isDark]);

  const screenOptions = useMemo<BottomTabNavigationOptions>(() => {
    // Estilo base para Android com posicionamento absoluto fixo
    const androidBaseStyle = {
      position: 'absolute' as const,
      bottom: 0,
      left: 0,
      right: 0,
      height: 60,
      paddingBottom: 8,
      paddingTop: 8,
      backgroundColor: isDark ? '#111827' : '#fff',
      borderTopWidth: 1,
      borderTopColor: isDark ? '#374151' : '#e5e7eb',
      elevation: 8,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -2 },
      shadowOpacity: 0.1,
      shadowRadius: 3,
    };

    // Estilo base para iOS
    const iosBaseStyle = {
      height: 85,
      paddingBottom: 30,
      paddingTop: 8,
      backgroundColor: isDark ? '#111827' : '#fff',
      borderTopWidth: 1,
      borderTopColor: isDark ? '#374151' : '#e5e7eb',
      elevation: 8,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -2 },
      shadowOpacity: 0.1,
      shadowRadius: 3,
    };

    const baseStyle = Platform.OS === 'android' ? androidBaseStyle : iosBaseStyle;

    // Quando teclado está aberto no Android, esconder completamente
    if (Platform.OS === 'android' && isKeyboardVisible) {
      return {
        headerShown: false,
        tabBarActiveTintColor: '#2C8EC9',
        tabBarInactiveTintColor: isDark ? '#9ca3af' : '#6b7280',
        tabBarStyle: {
          display: 'none',
        },
        tabBarItemStyle: { paddingVertical: 4 },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500' as const,
          marginBottom: 4,
        },
        tabBarHideOnKeyboard: true,
      };
    }

    // Estilo normal quando teclado está fechado
    return {
      headerShown: false,
      tabBarActiveTintColor: '#2C8EC9',
      tabBarInactiveTintColor: isDark ? '#9ca3af' : '#6b7280',
      tabBarStyle: baseStyle,
      tabBarItemStyle: { paddingVertical: 4 },
      tabBarLabelStyle: {
        fontSize: 12,
        fontWeight: '500' as const,
        marginBottom: Platform.OS === 'ios' ? 0 : 4,
      },
      tabBarHideOnKeyboard: true,
    };
  }, [isDark, isKeyboardVisible]);

  return (
    <PaperProvider theme={theme}>
      <Tabs screenOptions={screenOptions}>
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="home" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="addWorkout"
          options={{
            title: 'Add Workout',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="add-circle" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="AIchat"
          options={{
            title: 'AI Chat',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="chatbubble-ellipses" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="person" size={size} color={color} />
            ),
          }}
        />
      </Tabs>
    </PaperProvider>
  );
}