import AppTabs from '@/components/app-tabs';
import { useAutoSync } from '@/hooks/use-auto-sync';
import { GuardianFeedProvider } from '@/hooks/use-guardian-context';
import { useReminderScheduler, useReminderTaps } from '@/hooks/use-reminders';

export default function TabsLayout() {
  // Only mounted while signed in (see the root layout's Stack.Protected).
  useAutoSync();
  useReminderScheduler();
  useReminderTaps();
  // Guardian alerts arrive on any tab, so the Realtime feed lives here rather than in the Guardian tab.
  return (
    <GuardianFeedProvider>
      <AppTabs />
    </GuardianFeedProvider>
  );
}
