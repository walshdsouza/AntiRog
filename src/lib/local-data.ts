import { Q, type Database } from '@nozbe/watermelondb';

import { supabase } from '@/lib/supabase';
import { syncData } from '@/lib/sync';

/** Id of the account whose data is in the local database. Stored in WatermelonDB, so a reset clears it too. */
const OWNER_KEY = 'owner_user_id';

// Claims and wipes must never overlap, so run them one at a time.
let queue: Promise<unknown> = Promise.resolve();
function exclusive<T>(task: () => Promise<T>): Promise<T> {
  const result = queue.then(task);
  queue = result.catch(() => {});
  return result;
}

let clearRequested = false;

/**
 * Signs out and asks for the local database to be wiped once the signed-in screens have unmounted
 * (see SessionProvider). Works offline: if the server can't be reached, only this device is signed out.
 */
export async function signOutAndClear() {
  clearRequested = true;
  const { error } = await supabase.auth.signOut();
  if (!error) return;
  const local = await supabase.auth.signOut({ scope: 'local' });
  if (local.error) {
    clearRequested = false;
    throw local.error;
  }
}

/** True once per sign-out started by signOutAndClear(). */
export function takeClearRequest() {
  const requested = clearRequested;
  clearRequested = false;
  return requested;
}

/**
 * Deletes every local record, including changes that never synced. Callers must make sure nothing
 * is subscribed to the database (no signed-in screens mounted).
 */
export function clearLocalData(database: Database) {
  return exclusive(async () => {
    // Let any sync that is still running finish first, so it can't write the old account's data back
    // after the reset. Signed out, the follow-up sync is skipped.
    await syncData();
    await database.write(async () => {
      await database.unsafeResetDatabase();
    });
  });
}

/**
 * Makes sure the local database only holds data for `userId` before the app shows it. Catches the
 * cases a sign-out wipe can miss: the session ending without the Sign Out button, or the app being
 * killed mid-wipe.
 */
export function claimLocalData(database: Database, userId: string) {
  return exclusive(async () => {
    const owner = await database.localStorage.get<string>(OWNER_KEY);
    if (owner === userId) return;

    // No owner recorded yet (data from before this check existed): look at the records themselves.
    const foreign = owner
      ? 1
      : await database
          .get('prescriptions')
          .query(Q.where('user_id', Q.notIn([userId, ''])))
          .fetchCount();

    if (foreign > 0) {
      // No sync here: the new account is already signed in and must not push the old account's records.
      await database.write(async () => {
        await database.unsafeResetDatabase();
      });
    }
    await database.localStorage.set(OWNER_KEY, userId);
  });
}
