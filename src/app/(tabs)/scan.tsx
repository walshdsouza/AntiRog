import { useRouter, type Href } from 'expo-router';
import { Text, View } from 'react-native';

import { Chevron, Glyph, Note, PressableCard, Screen } from '@/components/neu';

const CHOICES: { href: Href; glyph: string; title: string; body: string; hint: string }[] = [
  {
    href: '/pill-scanner',
    glyph: '◉',
    title: 'Identify a Pill',
    body: 'Point your camera at a loose pill. Checks it against your medications, offline.',
    hint: 'Opens the camera to identify a pill on this device',
  },
  {
    href: '/report-scanner',
    glyph: '▤',
    title: 'Scan a Report',
    body: 'Capture a lab report or discharge summary to keep with your visits.',
    hint: 'Opens the report scanner',
  },
];

export default function ScanScreen() {
  const router = useRouter();

  return (
    <Screen title="Scan" subtitle="What would you like to scan?">
      {CHOICES.map((choice) => (
        <PressableCard
          key={choice.title}
          accessibilityLabel={choice.title}
          accessibilityHint={choice.hint}
          onPress={() => router.push(choice.href)}
          className="flex-row items-center gap-4 px-5 py-6">
          <Glyph>{choice.glyph}</Glyph>
          <View className="flex-1">
            <Text className="text-lg font-semibold text-ink dark:text-ink-dark">{choice.title}</Text>
            <Text className="mt-1 text-sm text-muted dark:text-muted-dark">{choice.body}</Text>
          </View>
          <Chevron />
        </PressableCard>
      ))}
      <Note>
        To add a medication from a prescription photo or by hand, use ＋ Add in Medications, or add it from a
        visit.
      </Note>
    </Screen>
  );
}
