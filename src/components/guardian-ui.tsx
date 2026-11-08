import { Text, View } from 'react-native';

import type { GuardianFeedStatus } from '@/hooks/use-guardian-feed';
import { STATE_BADGE, STATE_LABEL, type DoseState } from '@/lib/guardian-status';

const CONNECTION: Record<GuardianFeedStatus, { dot: string; label: string }> = {
  live: { dot: 'bg-green-500', label: 'Live' },
  connecting: { dot: 'bg-gray-400', label: 'Connecting…' },
  reconnecting: { dot: 'bg-amber-500', label: 'Reconnecting…' },
  idle: { dot: 'bg-gray-400', label: 'Not connected' },
};

/** Whether the feed is receiving changes as they happen. */
export function ConnectionPill({ status }: { status: GuardianFeedStatus }) {
  const { dot, label } = CONNECTION[status];
  return (
    <View
      accessible
      accessibilityLabel={`Connection: ${label}`}
      className="flex-row items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 dark:bg-gray-900">
      <View className={`h-2 w-2 rounded-full ${dot}`} />
      <Text className="text-xs font-medium text-gray-600 dark:text-gray-400">{label}</Text>
    </View>
  );
}

export function StateBadge({ state }: { state: DoseState }) {
  const style = STATE_BADGE[state];
  return (
    <View className={`rounded-full px-2.5 py-0.5 ${style.box}`}>
      <Text className={`text-xs font-semibold ${style.text}`}>{STATE_LABEL[state]}</Text>
    </View>
  );
}
