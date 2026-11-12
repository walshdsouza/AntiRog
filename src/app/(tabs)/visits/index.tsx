import { Q, type Database } from '@nozbe/watermelondb';
import { useDatabase, withObservables } from '@nozbe/watermelondb/react';
import { useRouter } from 'expo-router';
import { FlatList, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState, NeuButton, PressableCard, ScreenHeader } from '@/components/neu';
import { formatVisitDate, visitTitle, type VisitRecord } from '@/lib/visits';

export default function VisitsScreen() {
  const database = useDatabase();
  const router = useRouter();
  const addVisit = () => router.push('/visits/edit');

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-canvas dark:bg-canvas-dark">
      <ObservedVisitList
        database={database}
        onAdd={addVisit}
        header={
          <View className="pb-1">
            <ScreenHeader
              title="Visits"
              subtitle="Hospital and clinic visits"
              right={<NeuButton size="sm" title="＋ Add" accessibilityLabel="Add visit" onPress={addVisit} />}
            />
          </View>
        }
      />
    </SafeAreaView>
  );
}

function VisitList({
  visits,
  header,
  onAdd,
}: {
  visits: VisitRecord[];
  header: React.ReactElement;
  onAdd: () => void;
}) {
  const router = useRouter();
  return (
    <FlatList
      data={visits}
      keyExtractor={(v) => v.id}
      contentContainerClassName="gap-4 px-5 pb-10 pt-4"
      contentInsetAdjustmentBehavior="automatic"
      ListHeaderComponent={header}
      ListEmptyComponent={
        <EmptyState
          glyph="✚"
          title="No visits yet"
          body="Log a hospital or clinic visit, attach its prescriptions and lab reports, and add the medications you were given."
          action={<NeuButton title="Add a Visit" variant="primary" onPress={onAdd} />}
        />
      }
      renderItem={({ item }) => (
        <PressableCard
          accessibilityHint="Opens this visit"
          onPress={() => router.push({ pathname: '/visits/[id]', params: { id: item.id } })}>
          <Text className="text-xs uppercase tracking-wide text-muted dark:text-muted-dark">
            {formatVisitDate(item.visitedAt)}
          </Text>
          <Text className="mt-1 text-base font-semibold text-ink dark:text-ink-dark">{visitTitle(item)}</Text>
          {(item.facility && item.doctor) || item.reason ? (
            <Text numberOfLines={1} className="text-sm text-muted dark:text-muted-dark">
              {[item.facility ? item.doctor : '', item.reason].filter(Boolean).join(' · ')}
            </Text>
          ) : null}
        </PressableCard>
      )}
    />
  );
}

const ObservedVisitList = withObservables(
  [],
  ({ database }: { database: Database; header: React.ReactElement; onAdd: () => void }) => ({
    visits: database
      .get<VisitRecord>('visits')
      .query(Q.sortBy('visited_at', Q.desc), Q.sortBy('created_at', Q.desc))
      .observeWithColumns(['visited_at', 'facility', 'doctor', 'reason']),
  }),
)(VisitList);
