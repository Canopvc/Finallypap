import { MD3DarkTheme, MD3LightTheme, MD3Theme } from 'react-native-paper';
import { ColorSchemeName } from 'react-native';

export const lightTheme: MD3Theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#5B5FEF',
    background: '#F5F5F7',
    surface: '#FFFFFF',
    onSurface: '#1C1C1E',
    onSurfaceVariant: '#6B6B70',
    surfaceVariant: '#E5E5EA',
    outline: '#D1D1D6',
    error: '#EF4444',
    onPrimary: '#FFFFFF',
    primaryContainer: '#5B5FEF20',
    onPrimaryContainer: '#5B5FEF',
  },
};

export const darkTheme: MD3Theme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: '#5B5FEF',
    background: '#0f0c29', // Dark gradient base
    surface: '#1e293b',
    onSurface: '#F9FAFB',
    onPrimary: '#FFFFFF',
    primaryContainer: '#5B5FEF',
    onPrimaryContainer: '#FFFFFF',
    secondary: '#8B5CF6',
    onSurfaceVariant: '#D1D5DB',
    surfaceVariant: '#2D3748',
    outline: '#4A5568',
    error: '#EF4444',
  },
};

export function getAppTheme(scheme: ColorSchemeName | null | undefined): MD3Theme {
  return scheme === 'dark' ? darkTheme : lightTheme;
}