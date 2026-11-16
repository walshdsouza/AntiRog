import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';

import { Badge, Card, Chevron, EmptyState, Glyph, Note, PressableCard, Screen, SectionTitle, Spinner, type Tone } from '@/components/neu';
import { useScannedPills, type ScannedPill } from '@/hooks/use-scanned-pills';
import { useNeuTheme } from '@/hooks/use-theme-preference';

/*
 * Scan: identify a pill with the camera (on-device), and the history of pills identified before.
 * Lab reports are scanned in Reports › Tests.
 */

function confidenceTone(confidence: number): Tone {
  if (confidence >= 0.9) return 'success';
  if (confidence >= 0.7) return 'accent';
  return 'warning';
}

function formatScannedAt(ms: number) {
  const date = new Date(ms);
  const time = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const today = new Date();
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return `Today, ${time}`;
  if (date.toDateString() === yesterday.toDateString()) return `Yesterday, ${time}`;
  const sameYear = date.getFullYear() === today.getFullYear();
  const day = date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
  return `${day}, ${time}`;
}

export default function ScanScreen() {
  const router = useRouter();
  const pills = useScannedPills();

  return (
    <Screen title="Scan" subtitle="Identify a pill with your camera">
      <PressableCard
        accessibilityLabel="Identify a Pill"
        accessibilityHint="Opens the camera to identify a pill on this device"
        onPress={() => router.push('/pill-scanner')}
        className="flex-row items-center gap-4 px-5 py-6">
        <Glyph>◉</Glyph>
        <View className="flex-1">
          <Text className="text-lg font-semibold text-ink dark:text-ink-dark">Identify a Pill</Text>
          <Text className="mt-1 text-sm text-muted dark:text-muted-dark">
            Point your camera at a loose pill. Checks it against your medications, offline.
          </Text>
        </View>
        <Chevron />
      </PressableCard>

      <SectionTitle>Previously Identified Pills</SectionTitle>
      {pills === undefined ? (
        <View className="items-center py-8">
          <Spinner />
        </View>
      ) : pills.length ? (
        <Card className="px-4 py-2">
          {pills.map((pill, i) => (
            <PillRow key={pill.id} pill={pill} first={i === 0} />
          ))}
        </Card>
      ) : (
        <EmptyState
          glyph="◌"
          title="No pills identified yet"
          body="Pills you identify with the camera are listed here with how sure AntiRog was."
        />
      )}

      <Note>
        Identification is a guide, not a guarantee. Check the label or ask your pharmacist before taking a pill you
        aren&apos;t sure about. Lab reports are scanned in Reports › Tests.
      </Note>
    </Screen>
  );
}

function PillRow({ pill, first }: { pill: ScannedPill; first: boolean }) {
  const { palette } = useNeuTheme();
  const percent = Math.round(pill.confidence * 100);
  const when = formatScannedAt(pill.scannedAt);
  return (
    <View
      accessible
      accessibilityLabel={`${pill.name}, ${percent}% match, ${when}${pill.drug ? '' : ', not a known medication'}`}
      className="flex-row items-center gap-3 py-3"
      style={first ? undefined : { borderTopWidth: 1, borderTopColor: palette.hairline }}>
      <View className="flex-1">
        <Text numberOfLines={1} className="text-base font-semibold text-ink dark:text-ink-dark">
          {pill.name}
        </Text>
        <Text numberOfLines={1} className="text-sm text-muted dark:text-muted-dark">
          {pill.drug ? when : `${when} · Not a known medication`}
        </Text>
      </View>
      <Badge label={`${percent}%`} tone={confidenceTone(pill.confidence)} />
    </View>
  );
}
