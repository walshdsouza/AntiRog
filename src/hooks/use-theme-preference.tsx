import AsyncStorage from '@react-native-async-storage/async-storage';
import { colorScheme } from 'nativewind';
import { createContext, use, useEffect, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { PALETTE, type Palette, type Scheme } from '@/theme/neu';

/*
 * App-wide Light / Dark / System choice, set in Profile. NativeWind's colorScheme.set() overrides the
 * native Appearance, so `dark:` classes, useColorScheme() and the native tab bar all follow it.
 */

export type ThemePreference = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'antirog.theme-preference';

type ThemePreferenceContext = {
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
};

const Context = createContext<ThemePreferenceContext | null>(null);

function apply(preference: ThemePreference) {
  try {
    colorScheme.set(preference);
  } catch {
    // Web uses media-query dark mode, which can't be overridden: it follows the system setting.
  }
}

function isPreference(value: unknown): value is ThemePreference {
  return value === 'system' || value === 'light' || value === 'dark';
}

export function ThemePreferenceProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>('system');

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (active && isPreference(saved)) {
          setPreferenceState(saved);
          apply(saved);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  function setPreference(next: ThemePreference) {
    setPreferenceState(next);
    apply(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  }

  return <Context value={{ preference, setPreference }}>{children}</Context>;
}

export function useThemePreference() {
  const value = use(Context);
  if (!value) throw new Error('useThemePreference must be used inside ThemePreferenceProvider.');
  return value;
}

/** The scheme in effect right now and its neumorphic palette. */
export function useNeuTheme(): { scheme: Scheme; palette: Palette } {
  const scheme: Scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  return { scheme, palette: PALETTE[scheme] };
}
