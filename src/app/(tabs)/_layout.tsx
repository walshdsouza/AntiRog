import AppTabs from '@/components/app-tabs';
import { useAutoSync } from '@/hooks/use-auto-sync';
import { useReminderScheduler, useReminderTaps } from '@/hooks/use-reminders';

export default function TabsLayout() {
  // Only mounted while signed in (see the root layout's Stack.Protected).
  useAutoSync();
  useReminderScheduler();
  useReminderTaps();
  return <AppTabs />;
}
