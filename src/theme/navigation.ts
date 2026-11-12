import { DarkTheme, DefaultTheme, type Theme } from 'expo-router';

import { useNeuTheme } from '@/hooks/use-theme-preference';
import { PALETTE } from '@/theme/neu';

/** React Navigation themes on the neumorphic canvas, so headers and screen backgrounds match. */
export const NAV_THEME: Record<'light' | 'dark', Theme> = {
  light: {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      primary: PALETTE.light.accent,
      background: PALETTE.light.canvas,
      card: PALETTE.light.canvas,
      text: PALETTE.light.ink,
      border: 'transparent',
    },
  },
  dark: {
    ...DarkTheme,
    colors: {
      ...DarkTheme.colors,
      primary: PALETTE.dark.accent,
      background: PALETTE.dark.canvas,
      card: PALETTE.dark.canvas,
      text: PALETTE.dark.ink,
      border: 'transparent',
    },
  },
};

/** Header options for the stacks inside tabs: flat, on the canvas, accent back button. */
export function useStackScreenOptions() {
  const { palette } = useNeuTheme();
  return {
    headerShadowVisible: false,
    headerStyle: { backgroundColor: palette.canvas },
    headerTintColor: palette.accent,
    headerTitleStyle: { color: palette.ink, fontWeight: '600' as const },
    contentStyle: { backgroundColor: palette.canvas },
  };
}
