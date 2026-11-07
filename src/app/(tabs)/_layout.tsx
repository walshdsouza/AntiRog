import AppTabs from '@/components/app-tabs';
import { useAutoSync } from '@/hooks/use-auto-sync';

export default function TabsLayout() {
  // Only mounted while signed in (see the root layout's Stack.Protected).
  useAutoSync();
  return <AppTabs />;
}
