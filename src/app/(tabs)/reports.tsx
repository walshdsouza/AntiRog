import { Text, View } from 'react-native';

import { Badge, Card, EmptyState, Glyph, Inset, Note, Screen, SectionTitle } from '@/components/neu';

/*
 * Reports (scaffold). Will hold adherence graphs, report analysis and doctor-export comparisons.
 * The layout is in place with empty states so each feature can drop into its own card.
 */

const UPCOMING: { glyph: string; title: string; body: string }[] = [
  {
    glyph: '◔',
    title: 'Adherence',
    body: 'How regularly you take each medication, week by week, from your dose log.',
  },
  {
    glyph: '▤',
    title: 'Report analysis',
    body: 'Lab values read from scanned reports, tracked over time.',
  },
  {
    glyph: '⇄',
    title: 'Doctor export',
    body: 'A summary to share before a visit, comparing changes since the last one.',
  },
];

export default function ReportsScreen() {
  return (
    <Screen title="Reports" subtitle="Your health over time">
      <EmptyState
        glyph="◔"
        title="No reports yet"
        body="As you log doses and add visits, your adherence and report trends will appear here."
      />

      <SectionTitle>Coming soon</SectionTitle>
      {UPCOMING.map((item) => (
        <Card key={item.title} className="flex-row items-center gap-4 px-4 py-4">
          <Glyph size={44}>{item.glyph}</Glyph>
          <View className="flex-1">
            <View className="flex-row items-center justify-between gap-2">
              <Text className="text-base font-semibold text-ink dark:text-ink-dark">{item.title}</Text>
              <Badge label="Soon" />
            </View>
            <Text className="mt-1 text-sm text-muted dark:text-muted-dark">{item.body}</Text>
          </View>
        </Card>
      ))}

      {/* Chart placeholder: the graph card keeps its shape so the layout doesn't jump later. */}
      <Inset radius={24} className="h-40 items-center justify-center px-6">
        <Text className="text-center text-sm text-muted dark:text-muted-dark">Adherence chart</Text>
      </Inset>
      <Note>Reports are built on your phone from your own data.</Note>
    </Screen>
  );
}
