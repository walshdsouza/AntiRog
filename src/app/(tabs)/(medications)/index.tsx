import { useDatabase } from '@nozbe/watermelondb/react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TodaysDoses } from '@/components/dose-log';
import { InteractionReport } from '@/components/interaction-report';
import { NeuButton, ScreenHeader, Segmented } from '@/components/neu';
import { ObservedPrescriptionList } from '@/components/prescription-list';

type Section = 'list' | 'interactions';

const VIEWS: { value: Section; label: string }[] = [
  { value: 'list', label: 'Medications' },
  { value: 'interactions', label: 'Interactions' },
];

export default function MedicationsScreen() {
  const database = useDatabase();
  const router = useRouter();
  // Other screens can open the Interactions section directly with ?view=interactions.
  const params = useLocalSearchParams<{ view?: string }>();
  const [view, setView] = useState<Section>(params.view === 'interactions' ? 'interactions' : 'list');
  // This screen stays mounted under its stack, so follow the param when another screen changes it.
  const [lastParam, setLastParam] = useState(params.view);
  if (params.view !== lastParam) {
    setLastParam(params.view);
    if (params.view === 'interactions' || params.view === 'list') setView(params.view);
  }

  const header = (
    <View className="gap-5 pb-1">
      <ScreenHeader
        title="Medications"
        right={
          <NeuButton
            size="sm"
            title="＋ Add"
            accessibilityLabel="Add medication"
            onPress={() => router.push('/add-medication')}
          />
        }
      />
      <Segmented options={VIEWS} value={view} onChange={setView} accessibilityLabel="Medications view" />
      {view === 'list' && <TodaysDoses />}
    </View>
  );

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-canvas dark:bg-canvas-dark">
      {view === 'list' ? (
        <ObservedPrescriptionList
          database={database}
          header={header}
          onAdd={() => router.push('/add-medication')}
        />
      ) : (
        <ScrollView contentContainerClassName="gap-5 px-5 pb-10 pt-4" contentInsetAdjustmentBehavior="automatic">
          {header}
          <InteractionReport database={database} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
