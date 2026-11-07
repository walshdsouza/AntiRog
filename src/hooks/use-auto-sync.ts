import { useEffect } from 'react';
import { AppState } from 'react-native';

import { syncData } from '@/lib/sync';

/** Syncs once when mounted and again every time the app returns to the foreground. */
export function useAutoSync() {
  useEffect(() => {
    void syncData();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void syncData();
    });
    return () => subscription.remove();
  }, []);
}
