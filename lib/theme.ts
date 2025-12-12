import { MD3DarkTheme, MD3LightTheme, MD3Theme } from 'react-native-paper';
import { ColorSchemeName } from 'react-native';

export const lightTheme: MD3Theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#2C8EC9',
    background: '#f8fafc',
    surface: '#fff',
    onSurface: '#1e293b',
  },
};

export const darkTheme: MD3Theme = {
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
    secondary: '#eff0b0ff',
    onSurfaceVariant: '#d1d5db',
  },
};

export function getAppTheme(scheme: ColorSchemeName | null | undefined): MD3Theme {
  return scheme === 'dark' ? darkTheme : lightTheme;
}