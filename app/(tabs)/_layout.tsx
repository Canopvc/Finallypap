import { Tabs } from 'expo-router';
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Platform, Keyboard, View } from 'react-native';
import { useTheme } from 'react-native-paper';
import type { BottomTabNavigationOptions } from '@react-navigation/bottom-tabs';
import { useTranslation } from '../../hooks/useTranslation';
import Svg, { Path } from 'react-native-svg';

// =====================
// Ícones HOME
// =====================
const HomeOutlineIcon = ({ color, size }: { color: string; size: number }) => (
  <View style={{ width: size, height: size }}>
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M2.25 12L11.204 3.045c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  </View>
);

const HomeFilledIcon = ({ color, size }: { color: string; size: number }) => (
  <View style={{ width: size, height: size }}>
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M11.47 3.841a.75.75 0 0 1 1.06 0l8.69 8.69a.75.75 0 1 0 1.06-1.061l-8.689-8.69a2.25 2.25 0 0 0-3.182 0l-8.69 8.69a.75.75 0 1 0 1.061 1.06l8.69-8.689Z" />
      <Path d="m12 5.432 8.159 8.159c.03.03.06.058.091.086v6.198c0 1.035-.84 1.875-1.875 1.875H15a.75.75 0 0 1-.75-.75v-4.5a.75.75 0 0 0-.75-.75h-3a.75.75 0 0 0-.75.75V21a.75.75 0 0 1-.75.75H5.625a1.875 1.875 0 0 1-1.875-1.875v-6.198a2.29 2.29 0 0 0 .091-.086L12 5.432Z" />
    </Svg>
  </View>
);

// =====================
// Ícones ADD WORKOUT
// =====================
const AddOutlineIcon = ({ color, size }: { color: string; size: number }) => (
  <View style={{ width: size, height: size }}>
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 9v6m3-3H9m12 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  </View>
);

const AddFilledIcon = ({ color, size }: { color: string; size: number }) => (
  <View style={{ width: size, height: size }}>
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path
        fillRule="evenodd"
        d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25ZM12.75 9a.75.75 0 0 0-1.5 0v2.25H9a.75.75 0 0 0 0 1.5h2.25V15a.75.75 0 0 0 1.5 0v-2.25H15a.75.75 0 0 0 0-1.5h-2.25V9Z"
        clipRule="evenodd"
      />
    </Svg>
  </View>
);

// =====================
// Ícones CHAT
// =====================
const ChatOutlineIcon = ({ color, size }: { color: string; size: number }) => (
  <View style={{ width: size, height: size }}>
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 0 1-.825-.242m9.345-8.334a2.126 2.126 0 0 0-.476-.095 48.64 48.64 0 0 0-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0 0 11.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  </View>
);

const ChatFilledIcon = ({ color, size }: { color: string; size: number }) => (
  <View style={{ width: size, height: size }}>
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M4.913 2.658c2.075-.27 4.19-.408 6.337-.408 2.147 0 4.262.139 6.337.408 1.922.25 3.291 1.861 3.405 3.727a4.403 4.403 0 0 0-1.032-.211 50.89 50.89 0 0 0-8.42 0c-2.358.196-4.04 2.19-4.04 4.434v4.286a4.47 4.47 0 0 0 2.433 3.984L7.28 21.53A.75.75 0 0 1 6 21v-4.03a48.527 48.527 0 0 1-1.087-.128C2.905 16.58 1.5 14.833 1.5 12.862V6.638c0-1.97 1.405-3.718 3.413-3.979Z" />
      <Path d="M15.75 7.5c-1.376 0-2.739.057-4.086.169C10.124 7.797 9 9.103 9 10.609v4.285c0 1.507 1.128 2.814 2.67 2.94 1.243.102 2.5.157 3.768.165l2.782 2.781a.75.75 0 0 0 1.28-.53v-2.39l.33-.026c1.542-.125 2.67-1.433 2.67-2.94v-4.286c0-1.505-1.125-2.811-2.664-2.94A49.392 49.392 0 0 0 15.75 7.5Z" />
    </Svg>
  </View>
);

// =====================
// Ícones PROFILE
// =====================
const ProfileOutlineIcon = ({ color, size }: { color: string; size: number }) => (
  <View style={{ width: size, height: size }}>
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  </View>
);

const ProfileFilledIcon = ({ color, size }: { color: string; size: number }) => (
  <View style={{ width: size, height: size }}>
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path
        fillRule="evenodd"
        d="M7.5 6a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM3.751 20.105a8.25 8.25 0 0 1 16.498 0 .75.75 0 0 1-.437.695A18.683 18.683 0 0 1 12 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 0 1-.437-.695Z"
        clipRule="evenodd"
      />
    </Svg>
  </View>
);

// =====================
// Ícones NUTRITIVE TRACKER
// =====================
// =====================
// Ícones NUTRITIVE TRACKER (Coração) - CORRIGIDOS
// =====================
const NutritiveOutlineIcon = ({ color, size }: { color: string; size: number }) => (
  <View style={{ width: size, height: size }}>
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z"
      />
    </Svg>
  </View>
);

const NutritiveFilledIcon = ({ color, size }: { color: string; size: number }) => (
  <View style={{ width: size, height: size }}>
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="m11.645 20.91-.007-.003-.022-.012a15.247 15.247 0 0 1-.383-.218 25.18 25.18 0 0 1-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0 1 12 5.052 5.5 5.5 0 0 1 16.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 0 1-4.244 3.17 15.247 15.247 0 0 1-.383.219l-.022.012-.007.004-.003.001a.752.752 0 0 1-.704 0l-.003-.001Z" />
    </Svg>
  </View>
);

// =====================
// TABS LAYOUT
// =====================
export default function TabLayout() {
  const theme = useTheme();
  const isDark = theme.dark;
  const { t } = useTranslation();
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);
  const keyboardTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const keyboardDidShowListener = Keyboard.addListener(showEvent, () => {
      if (keyboardTimeoutRef.current) clearTimeout(keyboardTimeoutRef.current);
      setKeyboardVisible(true);
    });

    const keyboardDidHideListener = Keyboard.addListener(hideEvent, () => {
      if (keyboardTimeoutRef.current) clearTimeout(keyboardTimeoutRef.current);
      keyboardTimeoutRef.current = setTimeout(() => setKeyboardVisible(false), 100);
    });

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
      if (keyboardTimeoutRef.current) clearTimeout(keyboardTimeoutRef.current);
    };
  }, []);

  const screenOptions = useMemo<BottomTabNavigationOptions>(() => {
    const androidBaseStyle = {
      position: 'absolute' as const,
      bottom: 0,
      left: 0,
      right: 0,
      height: 60,
      paddingBottom: 8,
      paddingTop: 8,
      backgroundColor: theme.colors.surface,
      borderTopWidth: 1,
      borderTopColor: theme.colors.outline,
      elevation: 8,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -2 },
      shadowOpacity: 0.1,
      shadowRadius: 3,
    };

    const iosBaseStyle = {
      height: 85,
      paddingBottom: 30,
      paddingTop: 8,
      backgroundColor: theme.colors.surface,
      borderTopWidth: 1,
      borderTopColor: theme.colors.outline,
      elevation: 8,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -2 },
      shadowOpacity: 0.1,
      shadowRadius: 3,
    };

    const baseStyle = Platform.OS === 'android' ? androidBaseStyle : iosBaseStyle;

    return {
      headerShown: false,
      tabBarActiveTintColor: theme.colors.primary,
      tabBarInactiveTintColor: theme.colors.onSurfaceVariant,
      tabBarStyle: isKeyboardVisible ? { display: 'none' } : baseStyle,
      tabBarLabelStyle: {
        fontSize: 12,
        fontWeight: '500' as const,
        marginBottom: Platform.OS === 'ios' ? 0 : 4,
      },
      tabBarHideOnKeyboard: true,
    };
  }, [theme, isKeyboardVisible]);

  return (
    <Tabs screenOptions={screenOptions}>
        <Tabs.Screen
          name="index"
          options={{
            title: t('home'),
            tabBarIcon: ({ color, size, focused }) =>
              focused ? <HomeFilledIcon color={color} size={size} /> : <HomeOutlineIcon color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="addWorkout"
          options={{
            title: t('workouts'),
            tabBarIcon: ({ color, size, focused }) =>
              focused ? <AddFilledIcon color={color} size={size} /> : <AddOutlineIcon color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="AIchat"
          options={{
            title: t('aiChat'),
            tabBarIcon: ({ color, size, focused }) =>
              focused ? <ChatFilledIcon color={color} size={size} /> : <ChatOutlineIcon color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="calorie_tracker"
          options={{
            title: t('Calories'),
            tabBarIcon: ({ color, size, focused }) =>
              focused ? (
                <NutritiveFilledIcon color={color} size={size} />
              ) : (
                <NutritiveOutlineIcon color={color} size={size} />
              ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: t('profile'),
            tabBarIcon: ({ color, size, focused }) =>
              focused ? <ProfileFilledIcon color={color} size={size} /> : <ProfileOutlineIcon color={color} size={size} />,
          }}
        />
      </Tabs>
  );
}
