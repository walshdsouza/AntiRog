import { useDatabase } from '@nozbe/watermelondb/react';
import type { Session } from '@supabase/supabase-js';
import { createContext, use, useEffect, useState, type ReactNode } from 'react';

import { claimLocalData, clearLocalData, takeClearRequest } from '@/lib/local-data';
import { supabase } from '@/lib/supabase';

/** `undefined` while the stored session is still loading, `null` when signed out. */
const SessionContext = createContext<Session | null | undefined>(undefined);

/**
 * Subscribes to Supabase auth once and shares the session with the whole app. A session is only
 * exposed after the local database has been checked to belong to that account.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const database = useDatabase();
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    let active = true;
    // Apply auth changes in order, each after the previous one's database check.
    let chain: Promise<void> = Promise.resolve();

    function apply(next: Session | null) {
      chain = chain.then(async () => {
        if (next) {
          try {
            await claimLocalData(database, next.user.id);
          } catch (e) {
            console.log('[auth] Could not check local data owner:', e instanceof Error ? e.message : e);
          }
        }
        if (active) setSession(next);
      });
    }

    supabase.auth.getSession().then(({ data }) => apply(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => apply(next));

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [database]);

  // Wipe after a sign-out only once this render has committed: by then the signed-in screens (and
  // their database subscriptions) have unmounted, which unsafeResetDatabase() requires.
  useEffect(() => {
    if (session === null && takeClearRequest()) {
      clearLocalData(database).catch((e) => {
        // The next sign-in's owner check still wipes the data before anyone can see it.
        console.log('[auth] Could not clear local data:', e instanceof Error ? e.message : e);
      });
    }
  }, [session, database]);

  return <SessionContext value={session}>{children}</SessionContext>;
}

/** Current Supabase session. `undefined` while the stored session is still loading. */
export function useSession() {
  return use(SessionContext);
}
