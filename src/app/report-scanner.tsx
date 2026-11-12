import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';

import { Badge, Card, Inset, NeuButton, Note, Screen } from '@/components/neu';

/**
 * Scaffold for the report scanner (lab reports, discharge summaries). The capture and analysis
 * pipeline comes later; until then this screen explains what it will do and points to Visits, where
 * reports can already be attached as documents.
 */
export default function ReportScannerScreen() {
  const router = useRouter();

  return (
    <Screen
      title="Scan a Report"
      edges={['top', 'bottom']}
      right={<NeuButton size="sm" title="Close" onPress={() => router.back()} />}>
      {/* Viewfinder placeholder */}
      <Inset radius={28} className="aspect-[3/4] w-full items-center justify-center gap-3 p-6">
        <View className="h-3/4 w-4/5 rounded-2xl border-2 border-dashed border-accent/60 dark:border-accent-dark/60" />
        <Text className="text-center text-sm text-muted dark:text-muted-dark">
          Line up the whole page inside the frame
        </Text>
      </Inset>

      <Card className="gap-2">
        <View className="flex-row items-center justify-between">
          <Text className="text-base font-semibold text-ink dark:text-ink-dark">Report reading</Text>
          <Badge label="Coming soon" />
        </View>
        <Text className="text-sm text-muted dark:text-muted-dark">
          AntiRog will read lab values from the page so you can track them over time in Reports and compare
          them before a doctor&apos;s visit.
        </Text>
      </Card>

      <NeuButton title="Capture · coming soon" size="lg" disabled accessibilityHint="Not available yet" />
      <NeuButton
        title="Attach a report to a visit instead"
        onPress={() => router.dismissTo('/visits')}
      />
      <Note>Reports you attach to a visit stay on this phone.</Note>
    </Screen>
  );
}
