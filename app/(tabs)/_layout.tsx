import { Tabs } from 'expo-router';
import React, { useMemo } from 'react';
import { Platform, useColorScheme } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Provider as PaperProvider, MD3DarkTheme, MD3LightTheme } from 'react-native-paper';
import type { BottomTabNavigationOptions } from '@react-navigation/bottom-tabs';

export default function TabLayout() {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';

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

  const screenOptions = useMemo<BottomTabNavigationOptions>(() => ({
    headerShown: false,
    tabBarActiveTintColor: '#2C8EC9',
    tabBarInactiveTintColor: isDark ? '#9ca3af' : '#6b7280',
    tabBarHideOnKeyboard: true, // Força esconder o teclado em ambas plataformas
    tabBarStyle: {
      height: Platform.OS === 'ios' ? 85 : 60,
      paddingBottom: Platform.OS === 'ios' ? 30 : 8,
      paddingTop: 8,
      backgroundColor: isDark ? '#111827' : '#fff',
      borderTopWidth: 1,
      borderTopColor: isDark ? '#374151' : '#e5e7eb',
      // Remove qualquer position que possa causar problemas
      elevation: 8,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -2 },
      shadowOpacity: 0.1,
      shadowRadius: 3,
    },
    tabBarItemStyle: { 
      paddingVertical: 4,
    },
    tabBarLabelStyle: {
      fontSize: 12,
      fontWeight: '500' as const,
      marginBottom: Platform.OS === 'ios' ? 0 : 4,
    },
  }), [isDark]);

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