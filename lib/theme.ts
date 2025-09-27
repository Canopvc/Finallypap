import { MD3DarkTheme, MD3LightTheme, MD3Theme } from 'react-native-paper';
import { ColorSchemeName } from 'react-native';

export const lightTheme: MD3Theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#2C8EC9',
    secondary: '#3d5afe',
    background: '#f5f6fa',
    surface: '#ffffff',
  },
};

export const darkTheme: MD3Theme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: '#D1C802',
    secondary: '#3d5afe',
    background: '#0f1216',
    surface: '#1b1f27',
  },
};

export function getAppTheme(scheme: ColorSchemeName | null | undefined): MD3Theme {
  return scheme === 'dark' ? darkTheme : lightTheme;
}