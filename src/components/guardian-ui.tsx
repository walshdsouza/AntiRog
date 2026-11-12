import { Text, View } from 'react-native';

import { Badge, Inset, type Tone } from '@/components/neu';
import type { GuardianFeedStatus } from '@/hooks/use-guardian-feed';
import { STATE_LABEL, type DoseState } from '@/lib/guardian-status';

const CONNECTION: Record<GuardianFeedStatus, { dot: string; label: string }> = {
  live: { dot: 'bg-success dark:bg-success-dark', label: 'Live' },
  connecting: { dot: 'bg-muted dark:bg-muted-dark', label: 'Connecting…' },
  reconnecting: { dot: 'bg-warning dark:bg-warning-dark', label: 'Reconnecting…' },
  idle: { dot: 'bg-muted dark:bg-muted-dark', label: 'Not connected' },
};

/** Whether the feed is receiving changes as they happen. */
export function ConnectionPill({ status }: { status: GuardianFeedStatus }) {
  const { dot, label } = CONNECTION[status];
  return (
    <Inset
      radius={999}
      accessible
      accessibilityLabel={`Connection: ${label}`}
      className="flex-row items-center gap-1.5 px-3 py-1.5">
      <View className={`h-2 w-2 rounded-full ${dot}`} />
      <Text className="text-xs font-medium text-muted dark:text-muted-dark">{label}</Text>
    </Inset>
  );
}

const STATE_TONE: Record<DoseState, Tone> = {
  taken: 'success',
  skipped: 'default',
  missed: 'danger',
  unlogged: 'warning',
  upcoming: 'accent',
};

export function StateBadge({ state }: { state: DoseState }) {
  return <Badge label={STATE_LABEL[state]} tone={STATE_TONE[state] ?? 'default'} />;
}
