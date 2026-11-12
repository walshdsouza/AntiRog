import { Q, type Database } from '@nozbe/watermelondb';
import { withObservables } from '@nozbe/watermelondb/react';
import { Link } from 'expo-router';
import type { ReactElement } from 'react';
import { FlatList, Text, View } from 'react-native';

import { Badge, EmptyState, NeuButton, PressableCard } from '@/components/neu';
import type { PrescriptionRecord } from '@/lib/prescriptions';
import { formatReminderTime } from '@/lib/reminders';

function PrescriptionList({
  prescriptions,
  header,
  onAdd,
}: {
  prescriptions: PrescriptionRecord[];
  header?: ReactElement;
  onAdd?: () => void;
}) {
  return (
    <FlatList
      data={prescriptions}
      keyExtractor={(item) => item.id}
      contentContainerClassName="gap-4 px-5 pb-10 pt-4"
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={header}
      ListEmptyComponent={
        <EmptyState
          glyph="℞"
          title="No medications yet"
          body="Add one by hand, from a prescription photo, or from a visit."
          action={onAdd ? <NeuButton title="Add Medication" variant="primary" onPress={onAdd} /> : undefined}
        />
      }
      renderItem={({ item }) => (
        <Link href={{ pathname: '/prescription/[id]', params: { id: item.id } }} asChild>
          <PressableCard accessibilityHint="Opens medication details">
            <View className="flex-row items-start gap-3">
              <View className="flex-1">
                <Text className="text-base font-semibold text-ink dark:text-ink-dark">{item.medication}</Text>
                <Text className="text-sm text-muted dark:text-muted-dark">{item.dosage}</Text>
                {item.reminderEnabled && item.reminderMinutes != null && (
                  <Text className="mt-1 text-xs text-muted dark:text-muted-dark">
                    Daily at {formatReminderTime(item.reminderMinutes)}
                  </Text>
                )}
              </View>
              {item.isHighRisk && <Badge label="High risk" tone="danger" />}
            </View>
          </PressableCard>
        </Link>
      )}
    />
  );
}

// Re-renders whenever prescriptions are added or removed, or a shown field changes (including
// changes that arrive from a sync).
const enhance = withObservables(
  [],
  ({ database }: { database: Database; header?: ReactElement; onAdd?: () => void }) => ({
    prescriptions: database
      .get<PrescriptionRecord>('prescriptions')
      .query(Q.sortBy('created_at', Q.desc))
      .observeWithColumns(['medication', 'dosage', 'is_high_risk', 'reminder_enabled', 'reminder_minutes']),
  }),
);

export const ObservedPrescriptionList = enhance(PrescriptionList);
