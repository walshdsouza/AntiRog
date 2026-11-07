import type { Session } from '@supabase/supabase-js';
import { createContext, use, useEffect, useState, type ReactNode } from 'react';

import { supabase } from '@/lib/supabase';

/** `undefined` while the stored session is still loading, `null` when signed out. */
const SessionContext = createContext<Session | null | undefined>(undefined);

/** Subscribes to Supabase auth once and shares the session with the whole app. */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (active) setSession(data.session);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  return <SessionContext value={session}>{children}</SessionContext>;
}

/** Current Supabase session. `undefined` while the stored session is still loading. */
export function useSession() {
  return use(SessionContext);
}
