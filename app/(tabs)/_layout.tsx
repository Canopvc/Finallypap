import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, Image, useColorScheme, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Provider as PaperProvider, MD3DarkTheme, MD3LightTheme } from 'react-native-paper';

export default function TabLayout() {
 const scheme = useColorScheme();
  const isDark = scheme === 'dark';

  const theme = isDark ? {
    ...MD3DarkTheme,
    colors: {
      ...MD3DarkTheme.colors,
      primary: '#4AA8FF',
      background: '#0f172a',
      surface: '#1e293b',
      onSurface: '#f9fafb',
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
  };

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        // Selected tab color: yellow in dark mode, blue in light mode
        tabBarActiveTintColor: isDark ? '#FFD60A' : '#2C8EC9',
        tabBarInactiveTintColor: isDark ? '#9ca3af' : '#6b7280',
        tabBarHideOnKeyboard: true,
        tabBarBackground: () => (
          <View style={{ flex: 1, backgroundColor: isDark ? '#111827' : '#fff' }} />
        ),
        tabBarStyle: Platform.select({
          ios: {
            position: 'absolute',
            height: 44,
            backgroundColor: isDark ? 'rgba(17,24,39,0.35)' : 'rgba(255,255,255,0.9)',
            borderTopWidth: 0,
            borderTopColor: 'transparent',
            shadowOpacity: 0,
          },
          default: {
            height: 44,
            backgroundColor: isDark ? 'rgba(17,24,39,0.35)' : 'rgba(255,255,255,0.9)',
            borderTopWidth: 0,
            borderTopColor: 'transparent',
            elevation: 0,
            shadowOpacity: 0,
          },
        }),
        tabBarItemStyle: {
          paddingVertical: 2,
        },
        tabBarLabelStyle: {
          marginBottom: 0,
        },
      }}
    >
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
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person" size={size} color={color} />
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
    </Tabs>
  );
}
