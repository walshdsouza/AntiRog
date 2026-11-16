import { useState } from 'react';
import { Text, View } from 'react-native';
import Svg, { Line, Polyline } from 'react-native-svg';

import { Badge, Inset, Segmented } from '@/components/neu';
import { useNeuTheme } from '@/hooks/use-theme-preference';
import { formatBiomarker, type Biomarker, type BiomarkerKey } from '@/lib/report-parser';
import { RADIUS } from '@/theme/neu';

/*
 * Placeholder for biomarker trends. Parsed readings aren't stored yet, so there is no history to
 * plot: the well shows faint gridlines and a dashed ghost line, plus the latest reading for the
 * selected biomarker when the user has just scanned one. Once readings are persisted, swap the ghost
 * line for a LineChart (react-native-gifted-charts, as in AdherenceChart) fed by that history.
 */

const TRACKED: { value: BiomarkerKey; label: string }[] = [
  { value: 'blood_pressure', label: 'BP' },
  { value: 'total_cholesterol', label: 'Cholesterol' },
  { value: 'glucose_fasting', label: 'Glucose' },
  { value: 'hba1c', label: 'HbA1c' },
];

const HEIGHT = 120;
// A gentle, obviously-illustrative wave in 0–1 coordinates.
const GHOST = [0.55, 0.42, 0.5, 0.36, 0.44, 0.3, 0.38];

export function BiomarkerTrendChart({ latest }: { latest: Biomarker[] }) {
  const { palette } = useNeuTheme();
  const [selected, setSelected] = useState<BiomarkerKey>('blood_pressure');
  const [width, setWidth] = useState(0);
  const reading = latest.find((b) => b.key === selected);
  const label = TRACKED.find((t) => t.value === selected)?.label ?? '';

  const points = GHOST.map((y, i) => `${(i / (GHOST.length - 1)) * width},${y * HEIGHT}`).join(' ');

  return (
    <View className="gap-3">
      <Segmented options={TRACKED} value={selected} onChange={setSelected} accessibilityLabel="Biomarker" />
      <Inset
        radius={RADIUS.lg}
        className="gap-3 px-4 py-4"
        accessible
        accessibilityLabel={`${label} trend. No history yet.${
          reading ? ` Latest reading ${formatBiomarker(reading)}.` : ''
        }`}>
        <View className="flex-row items-center justify-between">
          <Text className="text-xs font-semibold uppercase tracking-wide text-muted dark:text-muted-dark">
            {label} over time
          </Text>
          {reading ? <Badge label={`Latest ${formatBiomarker(reading)}`} tone="accent" /> : null}
        </View>

        <View style={{ height: HEIGHT }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
          {width ? (
            <Svg width={width} height={HEIGHT}>
              {[0.25, 0.5, 0.75].map((y) => (
                <Line
                  key={y}
                  x1={0}
                  x2={width}
                  y1={y * HEIGHT}
                  y2={y * HEIGHT}
                  stroke={palette.hairline}
                  strokeWidth={1}
                />
              ))}
              <Polyline
                points={points}
                fill="none"
                stroke={palette.outline}
                strokeWidth={2}
                strokeDasharray="6 6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          ) : null}
        </View>

        <Text className="text-center text-sm text-muted dark:text-muted-dark">
          Your trend appears here once two or more reports have been read.
        </Text>
      </Inset>
    </View>
  );
}
