import { MD3DarkTheme, MD3LightTheme, MD3Theme } from 'react-native-paper';
import { ColorSchemeName } from 'react-native';

export const lightTheme: MD3Theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#2C8EC9',
    secondary: '#798dfc',
    background: '#f5f6fa',
    surface: '#ffffff',
    onPrimary: '#000000', // ← Corrigido para preto
  },
};

export const darkTheme: MD3Theme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: '#faf361',
    secondary: '#8294fa',
    background: '#0f1216',
    surface: '#1b1f27',
    onPrimary: '#000000',
  },
};

export function getAppTheme(scheme: ColorSchemeName | null | undefined): MD3Theme {
  return scheme === 'dark' ? darkTheme : lightTheme;
}